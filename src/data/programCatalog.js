/* Real, well-documented public training programs (not proprietary content).
   Each template is cloned into a real program object by addFromTemplate() in App.jsx,
   which stamps the runtime fields (active, startedAt, pausedAt, pausedMs, scheduleDays,
   lastReadiness, sourceTemplateId) — templates themselves only describe the plan.

   progressionType "linear" is a deliberate Phase-1 stand-in for the 5/3/1 family and GZCLP
   (531 Original, 531 BBB, nSuns, GZCLP) — their real training-max/AMRAP/tiered engines land in
   a later phase. Exercise selection and day structure below are already the real thing; only
   the week-to-week math is simplified for now. Per-exercise `progressionType` overrides the
   program-level one (used to mix linear main lifts with RIR-based accessory work, matching how
   PHUL/PHAT/Reddit PPL/ICF actually program their assistance exercises in practice). */

const ex = (id, sets, cfg) => ({ id, sets, last: { w: 0, reps: 5, rir: "amber", logged: false }, ...cfg });

/* dataset exercise ids used below (id : name) */
const SQUAT = "1436"; // Barbell High Bar Squat
const FRONT_SQUAT = "0042"; // Barbell Front Squat
const BENCH = "0025"; // Barbell Bench Press
const INCLINE_BB_BENCH = "0047"; // Barbell Incline Bench Press
const DEADLIFT = "0032"; // Barbell Deadlift
const RDL = "0085"; // Barbell Romanian Deadlift
const SUMO_DEADLIFT = "0117"; // Barbell Sumo Deadlift
const OHP = "1457"; // Barbell Standing Wide Military Press
const ROW = "0027"; // Barbell Bent Over Row
const PULLUP = "0652"; // Pull-Up
const CHINUP = "1326"; // Chin-Up
const DIP_TRICEPS = "0814"; // Triceps Dip
const DIP_CHEST = "0251"; // Chest Dip
const BARBELL_CURL = "0031"; // Barbell Curl
const EZ_CURL = "0447"; // EZ Barbell Curl
const DB_HAMMER_CURL = "0313"; // Dumbbell Hammer Curl
const DB_INCLINE_PRESS = "0314"; // Dumbbell Incline Bench Press
const DB_FLAT_PRESS = "0289"; // Dumbbell Bench Press
const DB_SHOULDER_PRESS = "0405"; // Dumbbell Seated Shoulder Press
const DB_LATERAL_RAISE = "0334"; // Dumbbell Lateral Raise
const DB_ROW = "0292"; // Dumbbell One Arm Bent-Over Row
const CABLE_SEATED_ROW = "0861"; // Cable Seated Row
const LAT_PULLDOWN = "0198"; // Cable Pulldown
const LEG_EXTENSION = "0585"; // Lever Leg Extension
const LEG_CURL = "0586"; // Lever Lying Leg Curl
const LEG_PRESS = "0760"; // Smith Leg Press
const CALF_RAISE_DB = "0417"; // Dumbbell Standing Calf Raise
const CALF_RAISE_BB = "1372"; // Barbell Standing Calf Raise
const TRICEPS_PUSHDOWN = "0241"; // Cable Triceps Pushdown (V-Bar)
const REAR_DELT_CABLE = "0202"; // Cable Rear Delt Row (Stirrups)
const BARBELL_SHRUG = "0095"; // Barbell Shrug
const HANGING_LEG_RAISE = "0472"; // Hanging Leg Raise
const SKULLCRUSHER = "0060"; // Barbell Lying Triceps Extension Skull Crusher
const PLANK = "plank"; // custom, no dataset match (see App.jsx)

const LINEAR_5 = { targetReps: 5, incrementKg: 2.5, failsToDeload: 3, deloadPct: 0.9 };
const LINEAR_531 = { targetReps: 5, incrementKg: 2.5, failsToDeload: 4, deloadPct: 0.9 };

export const PROGRAM_CATALOG = [
  {
    templateId: "cat_ss", name: "Starting Strength", style: "strength", progressionType: "linear",
    tags: ["powerlifting", "full body", "novice"], difficulty: "beginner", daysPerWeek: 3, weeks: 12,
    linearConfig: LINEAR_5,
    days: [
      { name: "Workout A", ex: [ex(SQUAT, 3, { incrementKg: 5 }), ex(BENCH, 3), ex(DEADLIFT, 1, { incrementKg: 5 })] },
      { name: "Workout B", ex: [ex(SQUAT, 3, { incrementKg: 5 }), ex(OHP, 3), ex(CHINUP, 3, { progressionType: "rir" })] },
    ],
  },
  {
    templateId: "cat_sl5x5", name: "StrongLifts 5x5", style: "strength", progressionType: "linear",
    tags: ["powerlifting", "full body", "novice"], difficulty: "beginner", daysPerWeek: 3, weeks: 12,
    linearConfig: LINEAR_5,
    days: [
      { name: "Workout A", ex: [ex(SQUAT, 5, { incrementKg: 5 }), ex(BENCH, 5), ex(ROW, 5)] },
      { name: "Workout B", ex: [ex(SQUAT, 5, { incrementKg: 5 }), ex(OHP, 5), ex(DEADLIFT, 1, { incrementKg: 5 })] },
    ],
  },
  {
    templateId: "cat_icf", name: "Ice Cream Fitness 5x5", style: "hypertrophy", progressionType: "linear",
    tags: ["powerlifting", "full body", "novice"], difficulty: "beginner", daysPerWeek: 3, weeks: 12,
    linearConfig: LINEAR_5,
    days: [
      { name: "Workout A", ex: [ex(SQUAT, 5, { incrementKg: 5 }), ex(BENCH, 5), ex(ROW, 5), ex(CHINUP, 3, { progressionType: "rir" }), ex(HANGING_LEG_RAISE, 3, { progressionType: "rir" })] },
      { name: "Workout B", ex: [ex(SQUAT, 5, { incrementKg: 5 }), ex(OHP, 5), ex(DEADLIFT, 1, { incrementKg: 5 }), ex(DIP_TRICEPS, 3, { progressionType: "rir" }), ex(BARBELL_CURL, 3, { progressionType: "rir" })] },
    ],
  },
  {
    templateId: "cat_greyskull", name: "Greyskull LP", style: "strength", progressionType: "linear",
    tags: ["powerlifting", "full body"], difficulty: "beginner", daysPerWeek: 3, weeks: 12,
    linearConfig: LINEAR_5,
    days: [
      { name: "Workout A", ex: [ex(BENCH, 3), ex(SQUAT, 3, { incrementKg: 5 }), ex(ROW, 3, { progressionType: "rir" })] },
      { name: "Workout B", ex: [ex(OHP, 3), ex(SQUAT, 3, { incrementKg: 5 }), ex(DEADLIFT, 1, { incrementKg: 5 })] },
    ],
  },
  {
    templateId: "cat_redditppl", name: "Reddit PPL", style: "hypertrophy", progressionType: "linear",
    tags: ["push/pull/legs", "intermediate"], difficulty: "intermediate", daysPerWeek: 6, weeks: 12,
    linearConfig: LINEAR_5,
    days: [
      { name: "Push A", ex: [ex(BENCH, 3), ex(OHP, 3, { progressionType: "rir" }), ex(DB_INCLINE_PRESS, 3, { progressionType: "rir" }), ex(TRICEPS_PUSHDOWN, 3, { progressionType: "rir" })] },
      { name: "Pull A", ex: [ex(DEADLIFT, 1, { incrementKg: 5 }), ex(ROW, 3, { progressionType: "rir" }), ex(PULLUP, 3, { progressionType: "rir" }), ex(BARBELL_CURL, 3, { progressionType: "rir" })] },
      { name: "Legs A", ex: [ex(SQUAT, 3, { incrementKg: 5 }), ex(LEG_PRESS, 3, { progressionType: "rir" }), ex(LEG_CURL, 3, { progressionType: "rir" }), ex(CALF_RAISE_DB, 3, { progressionType: "rir" })] },
      { name: "Push B", ex: [ex(OHP, 3), ex(DB_FLAT_PRESS, 3, { progressionType: "rir" }), ex(DIP_TRICEPS, 3, { progressionType: "rir" }), ex(TRICEPS_PUSHDOWN, 3, { progressionType: "rir" })] },
      { name: "Pull B", ex: [ex(ROW, 3), ex(LAT_PULLDOWN, 3, { progressionType: "rir" }), ex(REAR_DELT_CABLE, 3, { progressionType: "rir" }), ex(DB_HAMMER_CURL, 3, { progressionType: "rir" })] },
      { name: "Legs B", ex: [ex(FRONT_SQUAT, 3, { progressionType: "rir" }), ex(RDL, 3, { progressionType: "rir" }), ex(LEG_EXTENSION, 3, { progressionType: "rir" }), ex(CALF_RAISE_BB, 3, { progressionType: "rir" })] },
    ],
  },
  {
    templateId: "cat_phul", name: "PHUL", style: "hypertrophy", progressionType: "linear",
    tags: ["upper/lower", "power + hypertrophy"], difficulty: "intermediate", daysPerWeek: 4, weeks: 12,
    linearConfig: LINEAR_5,
    days: [
      { name: "Upper Power", ex: [ex(BENCH, 4), ex(ROW, 4), ex(OHP, 3, { progressionType: "rir" }), ex(LAT_PULLDOWN, 3, { progressionType: "rir" }), ex(BARBELL_CURL, 3, { progressionType: "rir" }), ex(TRICEPS_PUSHDOWN, 3, { progressionType: "rir" })] },
      { name: "Lower Power", ex: [ex(SQUAT, 4, { incrementKg: 5 }), ex(DEADLIFT, 3, { incrementKg: 5 }), ex(LEG_PRESS, 3, { progressionType: "rir" }), ex(LEG_CURL, 3, { progressionType: "rir" }), ex(CALF_RAISE_BB, 4, { progressionType: "rir" })] },
      { name: "Upper Hypertrophy", ex: [ex(DB_INCLINE_PRESS, 4, { progressionType: "rir" }), ex(CABLE_SEATED_ROW, 4, { progressionType: "rir" }), ex(DB_SHOULDER_PRESS, 3, { progressionType: "rir" }), ex(DB_LATERAL_RAISE, 3, { progressionType: "rir" }), ex(DB_HAMMER_CURL, 3, { progressionType: "rir" }), ex(SKULLCRUSHER, 3, { progressionType: "rir" })] },
      { name: "Lower Hypertrophy", ex: [ex(FRONT_SQUAT, 4, { progressionType: "rir" }), ex(RDL, 3, { progressionType: "rir" }), ex(LEG_EXTENSION, 3, { progressionType: "rir" }), ex(LEG_CURL, 3, { progressionType: "rir" }), ex(CALF_RAISE_DB, 4, { progressionType: "rir" })] },
    ],
  },
  {
    templateId: "cat_phat", name: "PHAT", style: "hypertrophy", progressionType: "linear",
    tags: ["power + hypertrophy", "5-day"], difficulty: "advanced", daysPerWeek: 5, weeks: 12,
    linearConfig: { targetReps: 3, incrementKg: 2.5, failsToDeload: 3, deloadPct: 0.9 },
    days: [
      { name: "Upper Power", ex: [ex(BENCH, 3), ex(ROW, 3), ex(OHP, 3, { progressionType: "rir" }), ex(CHINUP, 3, { progressionType: "rir" }), ex(BARBELL_CURL, 3, { progressionType: "rir" })] },
      { name: "Lower Power", ex: [ex(SQUAT, 3, { incrementKg: 5 }), ex(DEADLIFT, 3, { incrementKg: 5 }), ex(LEG_PRESS, 3, { progressionType: "rir" }), ex(CALF_RAISE_BB, 4, { progressionType: "rir" })] },
      { name: "Back & Shoulders Hypertrophy", ex: [ex(LAT_PULLDOWN, 4, { progressionType: "rir" }), ex(CABLE_SEATED_ROW, 4, { progressionType: "rir" }), ex(DB_SHOULDER_PRESS, 3, { progressionType: "rir" }), ex(DB_LATERAL_RAISE, 3, { progressionType: "rir" }), ex(REAR_DELT_CABLE, 3, { progressionType: "rir" })] },
      { name: "Lower Hypertrophy", ex: [ex(FRONT_SQUAT, 4, { progressionType: "rir" }), ex(RDL, 4, { progressionType: "rir" }), ex(LEG_EXTENSION, 3, { progressionType: "rir" }), ex(LEG_CURL, 3, { progressionType: "rir" }), ex(CALF_RAISE_DB, 4, { progressionType: "rir" })] },
      { name: "Chest & Arms Hypertrophy", ex: [ex(DB_INCLINE_PRESS, 4, { progressionType: "rir" }), ex(DB_FLAT_PRESS, 3, { progressionType: "rir" }), ex(DIP_TRICEPS, 3, { progressionType: "rir" }), ex(EZ_CURL, 3, { progressionType: "rir" }), ex(SKULLCRUSHER, 3, { progressionType: "rir" })] },
    ],
  },
  {
    templateId: "cat_gvt", name: "German Volume Training", style: "hypertrophy", progressionType: "linear",
    tags: ["hypertrophy", "high volume"], difficulty: "advanced", daysPerWeek: 3, weeks: 6,
    linearConfig: { targetReps: 10, incrementKg: 2.5, failsToDeload: 3, deloadPct: 0.9 },
    days: [
      { name: "Squat Day", ex: [ex(SQUAT, 10, { incrementKg: 5 }), ex(LEG_CURL, 3, { progressionType: "rir" }), ex(CALF_RAISE_BB, 3, { progressionType: "rir" })] },
      { name: "Bench & Row Day", ex: [ex(BENCH, 10), ex(ROW, 10), ex(TRICEPS_PUSHDOWN, 3, { progressionType: "rir" })] },
      { name: "Deadlift & Shoulders Day", ex: [ex(DEADLIFT, 10, { incrementKg: 5 }), ex(OHP, 10), ex(DB_LATERAL_RAISE, 3, { progressionType: "rir" })] },
    ],
  },
  {
    templateId: "cat_fullbody3x", name: "Full Body 3x", style: "strength", progressionType: "rir",
    tags: ["full body", "beginner friendly"], difficulty: "beginner", daysPerWeek: 3, weeks: 12,
    days: [
      { name: "Workout A", ex: [ex(SQUAT, 3), ex(BENCH, 3), ex(ROW, 3), ex(PLANK, 3)] },
      { name: "Workout B", ex: [ex(DEADLIFT, 1), ex(OHP, 3), ex(LAT_PULLDOWN, 3), ex(HANGING_LEG_RAISE, 3)] },
      { name: "Workout C", ex: [ex(FRONT_SQUAT, 3), ex(DB_INCLINE_PRESS, 3), ex(DB_ROW, 3), ex(PLANK, 3)] },
    ],
  },
  {
    templateId: "cat_upperlower4", name: "Upper/Lower 4-Day", style: "hypertrophy", progressionType: "rir",
    tags: ["upper/lower", "intermediate"], difficulty: "intermediate", daysPerWeek: 4, weeks: 12,
    days: [
      { name: "Upper A", ex: [ex(BENCH, 4), ex(ROW, 4), ex(DB_SHOULDER_PRESS, 3), ex(DB_HAMMER_CURL, 3), ex(TRICEPS_PUSHDOWN, 3)] },
      { name: "Lower A", ex: [ex(SQUAT, 4), ex(RDL, 3), ex(LEG_PRESS, 3), ex(CALF_RAISE_DB, 3)] },
      { name: "Upper B", ex: [ex(DB_INCLINE_PRESS, 4), ex(CABLE_SEATED_ROW, 4), ex(DB_LATERAL_RAISE, 3), ex(EZ_CURL, 3), ex(SKULLCRUSHER, 3)] },
      { name: "Lower B", ex: [ex(FRONT_SQUAT, 4), ex(DEADLIFT, 3), ex(LEG_EXTENSION, 3), ex(LEG_CURL, 3)] },
    ],
  },
  {
    templateId: "cat_brosplit", name: "Bro Split", style: "hypertrophy", progressionType: "rir",
    tags: ["body part split", "5-day"], difficulty: "intermediate", daysPerWeek: 5, weeks: 12,
    days: [
      { name: "Chest", ex: [ex(BENCH, 4), ex(INCLINE_BB_BENCH, 3), ex(DB_FLAT_PRESS, 3), ex(DIP_CHEST, 3)] },
      { name: "Back", ex: [ex(ROW, 4), ex(LAT_PULLDOWN, 3), ex(CABLE_SEATED_ROW, 3), ex(BARBELL_SHRUG, 3)] },
      { name: "Shoulders", ex: [ex(OHP, 4), ex(DB_LATERAL_RAISE, 3), ex(REAR_DELT_CABLE, 3), ex(BARBELL_SHRUG, 3)] },
      { name: "Legs", ex: [ex(SQUAT, 4), ex(RDL, 3), ex(LEG_PRESS, 3), ex(LEG_CURL, 3), ex(CALF_RAISE_BB, 4)] },
      { name: "Arms", ex: [ex(BARBELL_CURL, 3), ex(EZ_CURL, 3), ex(SKULLCRUSHER, 3), ex(TRICEPS_PUSHDOWN, 3), ex(DB_HAMMER_CURL, 3)] },
    ],
  },
  {
    templateId: "cat_531", name: "5/3/1 (Original)", style: "strength", progressionType: "linear",
    tags: ["531", "powerlifting", "training max"], difficulty: "intermediate", daysPerWeek: 4, weeks: 16,
    linearConfig: LINEAR_531,
    days: [
      { name: "Squat Day", ex: [ex(SQUAT, 5, { incrementKg: 5 }), ex(HANGING_LEG_RAISE, 3, { progressionType: "rir" })] },
      { name: "Bench Day", ex: [ex(BENCH, 5), ex(TRICEPS_PUSHDOWN, 3, { progressionType: "rir" })] },
      { name: "Deadlift Day", ex: [ex(DEADLIFT, 5, { incrementKg: 5 }), ex(BARBELL_SHRUG, 3, { progressionType: "rir" })] },
      { name: "OHP Day", ex: [ex(OHP, 5), ex(CHINUP, 3, { progressionType: "rir" })] },
    ],
  },
  {
    templateId: "cat_531bbb", name: "5/3/1 Boring But Big", style: "hypertrophy", progressionType: "linear",
    tags: ["531", "high volume", "training max"], difficulty: "intermediate", daysPerWeek: 4, weeks: 16,
    linearConfig: LINEAR_531,
    days: [
      { name: "Squat Day", ex: [ex(SQUAT, 5, { incrementKg: 5 }), ex(FRONT_SQUAT, 5, { progressionType: "rir" }), ex(HANGING_LEG_RAISE, 3, { progressionType: "rir" })] },
      { name: "Bench Day", ex: [ex(BENCH, 5), ex(DB_INCLINE_PRESS, 5, { progressionType: "rir" }), ex(TRICEPS_PUSHDOWN, 3, { progressionType: "rir" })] },
      { name: "Deadlift Day", ex: [ex(DEADLIFT, 5, { incrementKg: 5 }), ex(RDL, 5, { progressionType: "rir" }), ex(BARBELL_SHRUG, 3, { progressionType: "rir" })] },
      { name: "OHP Day", ex: [ex(OHP, 5), ex(DB_SHOULDER_PRESS, 5, { progressionType: "rir" }), ex(CHINUP, 3, { progressionType: "rir" })] },
    ],
  },
  {
    templateId: "cat_nsuns", name: "nSuns 5/3/1 LP", style: "strength", progressionType: "linear",
    tags: ["531", "high frequency", "training max"], difficulty: "advanced", daysPerWeek: 4, weeks: 16,
    linearConfig: { targetReps: 3, incrementKg: 2.5, failsToDeload: 4, deloadPct: 0.9 },
    days: [
      { name: "Bench + OHP", ex: [ex(BENCH, 9), ex(OHP, 8, { progressionType: "rir" })] },
      { name: "Squat + Sumo Deadlift", ex: [ex(SQUAT, 9, { incrementKg: 5 }), ex(SUMO_DEADLIFT, 6, { progressionType: "rir" })] },
      { name: "OHP + Incline Bench", ex: [ex(OHP, 9), ex(INCLINE_BB_BENCH, 8, { progressionType: "rir" })] },
      { name: "Deadlift + Front Squat", ex: [ex(DEADLIFT, 6, { incrementKg: 5 }), ex(FRONT_SQUAT, 8, { progressionType: "rir" })] },
    ],
  },
  {
    templateId: "cat_gzclp", name: "GZCLP", style: "strength", progressionType: "linear",
    tags: ["gzcl", "tiered"], difficulty: "intermediate", daysPerWeek: 4, weeks: 16,
    linearConfig: { targetReps: 3, incrementKg: 2.5, failsToDeload: 3, deloadPct: 0.85 },
    days: [
      { name: "Day A", ex: [ex(SQUAT, 5, { incrementKg: 5, tier: "T1" }), ex(BENCH, 3, { tier: "T2" }), ex(LAT_PULLDOWN, 3, { progressionType: "rir", tier: "T3" })] },
      { name: "Day B", ex: [ex(OHP, 5, { tier: "T1" }), ex(DEADLIFT, 3, { incrementKg: 5, tier: "T2" }), ex(DB_HAMMER_CURL, 3, { progressionType: "rir", tier: "T3" })] },
      { name: "Day C", ex: [ex(BENCH, 5, { tier: "T1" }), ex(SQUAT, 3, { incrementKg: 5, tier: "T2" }), ex(TRICEPS_PUSHDOWN, 3, { progressionType: "rir", tier: "T3" })] },
      { name: "Day D", ex: [ex(DEADLIFT, 5, { incrementKg: 5, tier: "T1" }), ex(OHP, 3, { tier: "T2" }), ex(CHINUP, 3, { progressionType: "rir", tier: "T3" })] },
    ],
  },
];
