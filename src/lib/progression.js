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

export const STRATEGIES = { rir };

export function progressionOf(program) {
  return STRATEGIES[program?.progressionType] || STRATEGIES.rir;
}
