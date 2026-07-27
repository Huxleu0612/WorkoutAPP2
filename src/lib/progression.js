/* ===== rir strategy: reps-in-reserve auto-regulation (today's only progression system) ===== */
const round5 = (v) => Math.round(v / 2.5) * 2.5;

function recommendRir(last, lastReadiness, todayReadiness) {
  const BAND = "8–12";
  if (!last || last.logged === false)
    return { first: true, w: null, band: BAND, dir: "hold", action: "First session", note: "Enter the weight you use — it becomes your baseline. No target yet.", lastRir: null };
  if (last.w === 0)
    return { w: 0, band: `${last.reps + 1}`, dir: "up", action: "Add a rep", note: "Bodyweight — chase one more clean rep.", lastRir: last.rir };
  let out;
  if (last.rir === "green") out = { w: round5(last.w + 2.5), band: BAND, dir: "up", action: "Increase weight", note: "You had 3+ reps in reserve — add load, reps drop back toward 8.", lastRir: last.rir };
  else if (last.rir === "amber") out = { w: last.w, band: BAND, dir: "hold", action: "Hold, add a rep", note: "Right in the 8–12 zone — same weight, earn one more rep.", lastRir: last.rir };
  else {
    if (lastReadiness === "tired") out = { w: last.w, band: BAND, dir: "hold", action: "Hold", note: "Hit failure, but you trained tired — repeat before adding load.", lastRir: last.rir };
    else if (lastReadiness === "energized" && last.reps < 8) out = { w: round5(Math.max(last.w - 2.5, 0)), band: BAND, dir: "down", action: "Ease off", note: "Fresh but under 8 reps — small drop to rebuild in range.", lastRir: last.rir };
    else out = { w: last.w, band: BAND, dir: "hold", action: "Hold", note: "True max effort — consolidate before progressing.", lastRir: last.rir };
  }
  if (todayReadiness === "tired" && out.dir === "up") out = { ...out, w: last.w, dir: "hold", action: "Hold", note: "Tired today — match last week, push when you're fresh." };
  return out;
}

const rir = {
  setRatingKind: "rir3",
  editable: { sets: true, exercises: true },
  needsMaxes: false,
  recommend(exx, { lastReadiness, todayReadiness = null } = {}) {
    return recommendRir(exx.last, lastReadiness, todayReadiness);
  },
  finishExercise(exx, loggedSets, { isBodyweight } = {}) {
    if (!loggedSets.length) return null;
    const last = loggedSets[loggedSets.length - 1];
    const wLast = last.w || (isBodyweight ? 0 : (exx.last?.w || 0));
    const repsLast = last.reps || exx.last?.reps || 10;
    return { last: { w: wLast, reps: repsLast, rir: last.rating, logged: true } };
  },
  weekLabel() {
    return null;
  },
};

/* ===== linear strategy: fixed-increment weight bump on hitting reps, deload on repeated misses =====
   Shared by Starting Strength, StrongLifts 5x5, Ice Cream Fitness 5x5, Greyskull LP, German Volume
   Training, and the linear-progression side of PHUL/PHAT/Reddit PPL's mixed programs. Parameterized by
   program.linearConfig ({ targetReps, incrementKg, failsToDeload, deloadPct }), with an optional
   per-exercise incrementKg override for lifts that progress faster/slower than the program default
   (e.g. squat/deadlift +5kg vs bench/press +2.5kg). */
const linear = {
  setRatingKind: "hitmiss",
  editable: { sets: true, exercises: true },
  needsMaxes: false,
  recommend(exx, { program } = {}) {
    const cfg = program?.linearConfig || {};
    const targetReps = cfg.targetReps ?? 5;
    const last = exx.last;
    if (!last || last.logged === false)
      return { first: true, w: null, dir: "hold", action: "First session", note: `Enter the weight you use for ${targetReps} reps — it becomes your baseline.` };
    if (last.w === 0)
      return { w: 0, dir: "up", action: "Add a rep", note: `Bodyweight — chase ${targetReps}+ clean reps.` };
    const inc = exx.incrementKg ?? cfg.incrementKg ?? 2.5;
    if (last.hit)
      return { w: round5(last.w + inc), dir: "up", action: "Add weight", note: `Hit ${targetReps} reps last time — add ${inc}kg.` };
    const failsToDeload = cfg.failsToDeload ?? 3;
    const missStreak = last.missStreak || 0;
    if (missStreak >= failsToDeload) {
      const deloadPct = cfg.deloadPct ?? 0.9;
      return { w: round5(last.w * deloadPct), dir: "down", action: "Deload", note: `Missed ${failsToDeload} times in a row — back off and rebuild.` };
    }
    return { w: last.w, dir: "hold", action: "Repeat weight", note: "Missed last time — same weight, try again." };
  },
  finishExercise(exx, loggedSets, { isBodyweight } = {}) {
    if (!loggedSets.length) return null;
    const last = loggedSets[loggedSets.length - 1];
    const wLast = last.w || (isBodyweight ? 0 : (exx.last?.w || 0));
    const repsLast = last.reps || exx.last?.reps || 5;
    const hit = last.rating === "hit";
    const missStreak = hit ? 0 : (exx.last?.missStreak || 0) + 1;
    return { last: { w: wLast, reps: repsLast, hit, missStreak, logged: true } };
  },
  weekLabel() {
    return null;
  },
};

/* ===== percent-of-training-max strategies: nSuns 5/3/1 LP and 5/3/1 Boring But Big =====
   Shared machinery for both: a training max (90% of an estimated 1RM) drives every set's weight as
   a percentage, looked up from a per-lift table. Nothing here mutates state session-to-session —
   the "current" training max and (for 531bbb) which week of the 4-week wave you're on are both
   derived from how many sessions of this program you've logged so far, via ctx.sessionCount. This
   avoids a separate counter that could ever drift out of sync with your actual training history. */
export const epley1RM = (w, reps) => w * (1 + reps / 30);

const LIFT_INCREMENT_KG = { squat: 5, deadlift: 5, bench: 2.5, ohp: 2.5 };
const REQUIRED_LIFT_KEYS = ["squat", "bench", "deadlift", "ohp"];

// 5/3/1's 4-week wave: 5s week, 3s week, 1s week, deload week
const WAVE_531 = [
  [{ pct: 0.65, reps: 5, kind: "fixed" }, { pct: 0.75, reps: 5, kind: "fixed" }, { pct: 0.85, reps: 5, kind: "amrap" }],
  [{ pct: 0.70, reps: 3, kind: "fixed" }, { pct: 0.80, reps: 3, kind: "fixed" }, { pct: 0.90, reps: 3, kind: "amrap" }],
  [{ pct: 0.75, reps: 5, kind: "fixed" }, { pct: 0.85, reps: 3, kind: "fixed" }, { pct: 0.95, reps: 1, kind: "amrap" }],
  [{ pct: 0.40, reps: 5, kind: "fixed" }, { pct: 0.50, reps: 5, kind: "fixed" }, { pct: 0.60, reps: 5, kind: "fixed" }],
];
const WAVE_LABEL = ["5s week", "3s week", "1s week", "deload week"];
// BBB volume sets are 50% of true 1RM, not 50% of training max — since TM is ~90% of 1RM, that's
// 5/9 of TM once converted. Deload week keeps the volume work but drops to 3 sets instead of 5.
const BBB_PCT = 5 / 9;
const BBB_VOLUME = Array.from({ length: 5 }, () => ({ pct: BBB_PCT, reps: 10, kind: "volume" }));
const BBB_VOLUME_DELOAD = Array.from({ length: 3 }, () => ({ pct: BBB_PCT, reps: 10, kind: "volume" }));

// nSuns' classic 4-day LP: T1 is the main lift (9 sets), T2 a related lift at lower %s (8 sets) —
// both tables are fixed every week; only the training max (and so the resulting weight) changes.
// T1 isn't one universal table — bench runs a lighter variant on its first day and a heavier one
// (matching squat/deadlift's top-single structure) on its second, so each T1 slot names which table
// it uses via exx.t1Variant.
const f = (pct, reps) => ({ pct, reps, kind: "fixed" });
const a = (pct, reps) => ({ pct, reps, kind: "amrap" });
const NSUNS_T1_TABLES = {
  benchLight: [f(.65, 8), f(.75, 6), f(.75, 6), f(.85, 4), f(.85, 4), f(.85, 4), f(.80, 5), f(.70, 7), a(.65, 8)],
  squat: [f(.75, 5), f(.75, 5), f(.85, 3), f(.85, 3), a(.95, 1), f(.90, 3), f(.80, 3), f(.70, 5), a(.65, 5)],
  benchHeavy: [f(.75, 5), f(.75, 5), f(.85, 3), a(.95, 1), f(.90, 3), f(.85, 5), f(.80, 3), f(.70, 3), a(.65, 5)],
  deadlift: [f(.75, 5), f(.85, 3), f(.85, 3), a(.95, 1), f(.90, 3), f(.80, 3), f(.75, 3), f(.70, 3), a(.65, 3)],
};
// T2's rep pattern is constant (6,5,3,5,7,4,6,8); only the starting percentage shifts per exercise —
// OHP/Sumo Deadlift start at 50%, Close-Grip Bench at 40%, Front Squat at 35%, each stepping up by
// 10 points twice before holding flat for the remaining 6 sets.
const nsunsT2Table = (base) => [6, 5, 3, 5, 7, 4, 6, 8].map((reps, i) => f((base + Math.min(i, 2) * 10) / 100, reps));

const weekIndexFor = (ctx) => Math.floor((ctx.sessionCount || 0) / (ctx.program?.days?.length || 1));
const seedTM = (exx, ctx) => ctx.program?.periodization?.[exx.liftKey]?.tm || 0;
const increment = (exx) => LIFT_INCREMENT_KG[exx.liftKey] ?? 2.5;
const weightForSpec = (tm, spec) => round5(tm * spec.pct);
const applyMaxesAsTM = (maxInputs) => ({ periodization: Object.fromEntries(REQUIRED_LIFT_KEYS.map((lk) => [lk, { tm: parseFloat(maxInputs[lk]) || 0 }])) });

const nsuns = {
  setRatingKind: "log",
  editable: { sets: false, exercises: false },
  needsMaxes: true,
  requiredLiftKeys: REQUIRED_LIFT_KEYS,
  maxesInputLabel: "training max",
  maxesHint: "Every set's weight is calculated from these. A training max is usually about 90% of your true 1-rep max — better to start conservative than to grind failed reps in week one.",
  applyMaxes(program, maxInputs) {
    return applyMaxesAsTM(maxInputs);
  },
  getSetSpecs(exx) {
    if (exx.tier === "T2") return nsunsT2Table(exx.t2Base ?? 50);
    return NSUNS_T1_TABLES[exx.t1Variant] || NSUNS_T1_TABLES.benchLight;
  },
  effectiveTM(exx, ctx) {
    return seedTM(exx, ctx) + weekIndexFor(ctx) * increment(exx);
  },
  weightForSpec,
  recommend(exx, ctx) {
    const tm = this.effectiveTM(exx, ctx);
    if (!tm) return { first: true, w: null, dir: "hold", action: "Set your training max", note: "Enter a training max for this lift in Profile or when you start the program." };
    return { first: false, w: tm, dir: "up", action: `Training max ${tm}kg`, note: `Week ${weekIndexFor(ctx) + 1} — increases ${increment(exx)}kg every week on this lift.` };
  },
  finishExercise(exx, loggedSets) {
    if (!loggedSets.length) return null;
    const last = loggedSets[loggedSets.length - 1];
    return { last: { w: last.w, reps: last.reps, logged: true } };
  },
  weekLabel(program, ctx) {
    return `Week ${weekIndexFor(ctx) + 1}`;
  },
};

// shared by both "5/3/1 (Original)" and "5/3/1 Boring But Big" — the BBB volume block is added
// only when program.bbbVolume is set, so the two catalog entries can reuse one strategy
const wave531 = {
  setRatingKind: "log",
  editable: { sets: false, exercises: false },
  needsMaxes: true,
  requiredLiftKeys: REQUIRED_LIFT_KEYS,
  maxesInputLabel: "training max",
  maxesHint: "Every set's weight is calculated from these. A training max is usually about 90% of your true 1-rep max — better to start conservative than to grind failed reps in week one.",
  applyMaxes(program, maxInputs) {
    return applyMaxesAsTM(maxInputs);
  },
  getSetSpecs(exx, ctx) {
    const waveWeek = weekIndexFor(ctx) % 4;
    const main = WAVE_531[waveWeek];
    if (!ctx.program?.bbbVolume) return main;
    return [...main, ...(waveWeek === 3 ? BBB_VOLUME_DELOAD : BBB_VOLUME)];
  },
  effectiveTM(exx, ctx) {
    const cycle = Math.floor(weekIndexFor(ctx) / 4);
    return seedTM(exx, ctx) + cycle * increment(exx);
  },
  weightForSpec,
  recommend(exx, ctx) {
    const tm = this.effectiveTM(exx, ctx);
    const waveWeek = weekIndexFor(ctx) % 4;
    if (!tm) return { first: true, w: null, dir: "hold", action: "Set your training max", note: "Enter a training max for this lift in Profile or when you start the program." };
    return { first: false, w: tm, dir: "up", action: `Training max ${tm}kg`, note: `${WAVE_LABEL[waveWeek]} — the max goes up ${increment(exx)}kg at the start of every new 4-week wave.` };
  },
  finishExercise(exx, loggedSets) {
    if (!loggedSets.length) return null;
    const last = loggedSets[loggedSets.length - 1];
    return { last: { w: last.w, reps: last.reps, logged: true } };
  },
  weekLabel(program, ctx) {
    const weekIndex = weekIndexFor(ctx);
    const waveWeek = weekIndex % 4;
    return `Week ${weekIndex + 1} · Wave ${Math.floor(weekIndex / 4) + 1} (${WAVE_LABEL[waveWeek]})`;
  },
};

/* ===== gzclp: tiered stage/miss-streak engine =====
   Unlike nsuns/531 above, GZCLP's "current week" isn't derivable from session count — whether a
   lift moves forward or resets a stage depends on whether the last AMRAP/rep target was actually
   hit, so each exercise entry carries its own small state machine in exx.periodization ({ stage,
   weight, cycleStartWeight }), advanced by finishExercise every time that exercise is logged. T1/T2/T3
   are three independent tiers — a lift used as T1 on one day and T2 on another progresses separately,
   since each exercise entry (not each lift) owns its own stage/weight.
   Onboarding asks for a tested 5-rep max (5RM) per lift, not a training max — T1 starts at 85% of it,
   T2 at 70% of the SAME lift's 5RM (matching how the real program bases T2's load on its related T1
   lift, e.g. "Bench Press (T2)" on squat day is 70% of your bench 5RM, not an independently-tracked max). */
const T1_STAGES = [{ sets: 5, reps: 3 }, { sets: 6, reps: 2 }, { sets: 10, reps: 1 }];
const T1_LABEL = ["5×3+", "6×2+", "10×1+"];
const T2_STAGES = [{ reps: 10 }, { reps: 8 }, { reps: 6 }];
const T2_LABEL = ["3×10", "3×8", "3×6"];
const T3_FLOOR_REPS = 15;
const T3_BONUS_REPS = 25;
const T3_INCREMENT_KG = 2.5;
const T1_START_PCT = 0.85;
const T2_START_PCT = 0.70;
const T1_STAGE_RESET_PCT = 0.9; // T1: an app can't force a real 5RM retest, so this approximates one
const T2_CYCLE_RESTART_KG = 10; // T2: real protocol restarts ~10kg heavier than the last cycle's start

const gzclpWeight = (exx) => exx.periodization?.weight || 0;
const gzclpStage = (exx) => exx.periodization?.stage || 1;

const gzclp = {
  setRatingKind: "log",
  editable: { sets: false, exercises: false },
  needsMaxes: true,
  maxesInputLabel: "5-rep max",
  maxesHint: "T1 starts at 85% of this and T2 at 70% — enter your actual tested 5-rep max (5RM), not a 1-rep max. Be conservative; you'll be adding weight almost every session.",
  applyMaxes(program, maxInputs) {
    const days = program.days.map((d) => ({
      ...d,
      ex: d.ex.map((exx) => {
        if (!exx.liftKey || exx.tier === "T3") return exx;
        const fiveRM = parseFloat(maxInputs[exx.liftKey]) || 0;
        const pct = exx.tier === "T1" ? T1_START_PCT : T2_START_PCT;
        const weight = round5(fiveRM * pct);
        return { ...exx, periodization: { stage: 1, weight, cycleStartWeight: weight } };
      }),
    }));
    return { days };
  },
  getSetSpecs(exx) {
    const stage = gzclpStage(exx);
    if (exx.tier === "T2") return Array.from({ length: 3 }, () => ({ reps: T2_STAGES[stage - 1].reps, kind: "fixed" }));
    if (exx.tier === "T3") return Array.from({ length: 3 }, () => ({ reps: T3_FLOOR_REPS, kind: "amrap" }));
    const { sets, reps } = T1_STAGES[stage - 1];
    return Array.from({ length: sets }, (_, i) => ({ reps, kind: i === sets - 1 ? "amrap" : "fixed" }));
  },
  effectiveTM(exx) {
    return gzclpWeight(exx);
  },
  weightForSpec(tm) {
    return round5(tm);
  },
  recommend(exx) {
    const w = gzclpWeight(exx);
    if (!w) return { first: true, w: null, dir: "hold", action: "First session", note: "Enter the weight you use — it becomes your stage 1 starting point." };
    const stage = gzclpStage(exx);
    if (exx.tier === "T3") return { first: false, w, dir: "up", action: `${w}kg`, note: `3×${T3_FLOOR_REPS}+ — add ${T3_INCREMENT_KG}kg once your last set hits ${T3_BONUS_REPS}+ reps.` };
    const label = exx.tier === "T2" ? T2_LABEL[stage - 1] : T1_LABEL[stage - 1];
    return { first: false, w, dir: "up", action: `${w}kg · Stage ${stage}`, note: `${label} — hit every rep and next session adds ${increment(exx)}kg. Miss and it moves to the next stage.` };
  },
  finishExercise(exx, loggedSets) {
    if (!loggedSets.length) return null;
    const last = loggedSets[loggedSets.length - 1];
    if (!exx.periodization?.weight) {
      // defensive fallback — shouldn't normally trigger once a program's been through the 5RM wizard
      const w = loggedSets[0].w || last.w;
      return { last: { w: last.w, reps: last.reps, logged: true }, periodization: { stage: 1, weight: w, cycleStartWeight: w } };
    }
    const stage = gzclpStage(exx);
    const w = gzclpWeight(exx);
    const inc = increment(exx);
    const cycleStart = exx.periodization?.cycleStartWeight ?? w;
    let success;
    if (exx.tier === "T2") success = loggedSets.every((s) => s.reps >= T2_STAGES[stage - 1].reps);
    else if (exx.tier === "T3") success = last.reps >= T3_BONUS_REPS;
    else success = last.reps >= T1_STAGES[stage - 1].reps;

    let stage2, weight2, cycleStart2 = cycleStart;
    if (exx.tier === "T3") { stage2 = stage; weight2 = success ? round5(w + T3_INCREMENT_KG) : w; }
    else if (success) { stage2 = stage; weight2 = round5(w + inc); }
    else if (stage < 3) { stage2 = stage + 1; weight2 = w; }
    else if (exx.tier === "T2") { stage2 = 1; weight2 = round5(cycleStart + T2_CYCLE_RESTART_KG); cycleStart2 = weight2; }
    else { stage2 = 1; weight2 = round5(w * T1_STAGE_RESET_PCT); cycleStart2 = weight2; }

    return { last: { w: last.w, reps: last.reps, logged: true }, periodization: { stage: stage2, weight: weight2, cycleStartWeight: cycleStart2 } };
  },
  weekLabel() {
    return null;
  },
};

export const STRATEGIES = { rir, linear, nsuns, "531": wave531, gzclp };

export function progressionOf(program, exx) {
  const type = exx?.progressionType || program?.progressionType;
  return STRATEGIES[type] || STRATEGIES.rir;
}
