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
const CLOSE_GRIP_BENCH = "0030"; // Barbell Close-Grip Bench Press
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
const DB_BICEP_CURL = "0294"; // Dumbbell Biceps Curl
const DB_SHRUG = "0406"; // Dumbbell Shrug
const WHEEL_ROLLOUT = "0857"; // Wheel Rollerout (ab wheel)
const DB_TRICEP_EXT = "0430"; // Dumbbell Standing Triceps Extension
const SEATED_CALF_RAISE = "0594"; // Lever Seated Calf Raise
const DB_FLY = "0308"; // Dumbbell Fly
const DB_INCLINE_CURL = "0318"; // Dumbbell Incline Curl
const BARBELL_LUNGE = "0054"; // Barbell Lunge
const HACK_SQUAT = "0046"; // Barbell Hack Squat
const PENDLAY_ROW = "3017"; // Barbell Pendlay Row
const DB_BENT_ROW = "0293"; // Dumbbell Bent Over Row
const MACHINE_ROW = "0606"; // Lever T Bar Row (chest-supported machine row substitute)
const UPRIGHT_ROW_DB = "0437"; // Dumbbell Upright Row
const STIFF_LEG_DEADLIFT = "0432"; // Dumbbell Stiff Leg Deadlift
const DONKEY_CALF_RAISE = "1253"; // Lever Donkey Calf Raise
const INCLINE_CABLE_FLY = "0171"; // Cable Incline Fly
const PREACHER_CURL_BB = "0070"; // Barbell Preacher Curl
const CONCENTRATION_CURL = "0297"; // Dumbbell Concentration Curl
const SPIDER_CURL = "0454"; // EZ Barbell Spider Curl
const CABLE_KICKBACK = "0860"; // Cable Kickback
const SEATED_LEG_CURL = "0599"; // Lever Seated Leg Curl

const LINEAR_5 = { targetReps: 5, incrementKg: 2.5, failsToDeload: 3, deloadPct: 0.9 };

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
    tags: ["powerlifting", "full body"], difficulty: "beginner", daysPerWeek: 3, weeks: 8,
    linearConfig: LINEAR_5,
    days: [
      { name: "Workout A", ex: [ex(BENCH, 3), ex(ROW, 3), ex(SQUAT, 3, { incrementKg: 5 }), ex(TRICEPS_PUSHDOWN, 3, { progressionType: "rir" }), ex(WHEEL_ROLLOUT, 3, { progressionType: "rir" })] },
      { name: "Workout B", ex: [ex(OHP, 3), ex(CHINUP, 3), ex(DEADLIFT, 3, { incrementKg: 5 }), ex(DB_BICEP_CURL, 3, { progressionType: "rir" }), ex(DB_SHRUG, 3, { progressionType: "rir" })] },
    ],
  },
  {
    templateId: "cat_redditppl", name: "Reddit PPL", style: "hypertrophy", progressionType: "linear",
    tags: ["push/pull/legs", "intermediate"], difficulty: "intermediate", daysPerWeek: 6, weeks: 12,
    linearConfig: LINEAR_5,
    days: [
      { name: "Pull A (Deadlift)", ex: [ex(DEADLIFT, 3, { incrementKg: 5 }), ex(LAT_PULLDOWN, 3, { progressionType: "rir" }), ex(DB_ROW, 3, { progressionType: "rir" }), ex(REAR_DELT_CABLE, 5, { progressionType: "rir" }), ex(DB_HAMMER_CURL, 4, { progressionType: "rir" }), ex(DB_BICEP_CURL, 4, { progressionType: "rir" })] },
      { name: "Push A (Bench)", ex: [ex(BENCH, 5), ex(OHP, 3, { progressionType: "rir" }), ex(DB_INCLINE_PRESS, 3, { progressionType: "rir" }), ex(TRICEPS_PUSHDOWN, 3, { progressionType: "rir" }), ex(DB_LATERAL_RAISE, 3, { progressionType: "rir" }), ex(DB_TRICEP_EXT, 3, { progressionType: "rir" }), ex(DB_LATERAL_RAISE, 3, { progressionType: "rir" })] },
      { name: "Legs A", ex: [ex(SQUAT, 3), ex(RDL, 3, { progressionType: "rir" }), ex(LEG_PRESS, 3, { progressionType: "rir" }), ex(LEG_CURL, 3, { progressionType: "rir" }), ex(SEATED_CALF_RAISE, 5, { progressionType: "rir" })] },
      { name: "Pull B (Row)", ex: [ex(ROW, 5), ex(LAT_PULLDOWN, 3, { progressionType: "rir" }), ex(DB_ROW, 3, { progressionType: "rir" }), ex(REAR_DELT_CABLE, 5, { progressionType: "rir" }), ex(DB_HAMMER_CURL, 4, { progressionType: "rir" }), ex(DB_BICEP_CURL, 4, { progressionType: "rir" })] },
      { name: "Push B (OHP)", ex: [ex(OHP, 5), ex(BENCH, 3, { progressionType: "rir" }), ex(DB_INCLINE_PRESS, 3, { progressionType: "rir" }), ex(TRICEPS_PUSHDOWN, 3, { progressionType: "rir" }), ex(DB_LATERAL_RAISE, 3, { progressionType: "rir" }), ex(DB_TRICEP_EXT, 3, { progressionType: "rir" }), ex(DB_LATERAL_RAISE, 3, { progressionType: "rir" })] },
      { name: "Legs B", ex: [ex(SQUAT, 3), ex(RDL, 3, { progressionType: "rir" }), ex(LEG_PRESS, 3, { progressionType: "rir" }), ex(LEG_CURL, 3, { progressionType: "rir" }), ex(SEATED_CALF_RAISE, 5, { progressionType: "rir" })] },
    ],
  },
  {
    templateId: "cat_phul", name: "PHUL", style: "hypertrophy", progressionType: "rir",
    tags: ["upper/lower", "power + hypertrophy"], difficulty: "intermediate", daysPerWeek: 4, weeks: 12,
    days: [
      { name: "Upper Power", ex: [ex(BENCH, 3), ex(DB_INCLINE_PRESS, 3), ex(ROW, 3), ex(LAT_PULLDOWN, 3), ex(OHP, 2), ex(BARBELL_CURL, 2), ex(SKULLCRUSHER, 2)] },
      { name: "Lower Power", ex: [ex(SQUAT, 3), ex(DEADLIFT, 3), ex(LEG_PRESS, 3), ex(LEG_CURL, 3), ex(SEATED_CALF_RAISE, 4)] },
      { name: "Upper Hypertrophy", ex: [ex(INCLINE_BB_BENCH, 3), ex(DB_FLY, 3), ex(CABLE_SEATED_ROW, 3), ex(DB_ROW, 3), ex(DB_LATERAL_RAISE, 3), ex(DB_INCLINE_CURL, 3), ex(TRICEPS_PUSHDOWN, 3)] },
      { name: "Lower Hypertrophy", ex: [ex(FRONT_SQUAT, 3), ex(BARBELL_LUNGE, 3), ex(LEG_EXTENSION, 3), ex(LEG_CURL, 3), ex(SEATED_CALF_RAISE, 3), ex(CALF_RAISE_BB, 3)] },
    ],
  },
  {
    templateId: "cat_phat", name: "PHAT", style: "hypertrophy", progressionType: "linear",
    tags: ["power + hypertrophy", "5-day"], difficulty: "advanced", daysPerWeek: 5, weeks: 4,
    linearConfig: { targetReps: 4, incrementKg: 2.5, failsToDeload: 2, deloadPct: 0.9 },
    days: [
      {
        name: "Upper Body Power", ex: [
          ex(BENCH, 3), ex(PULLUP, 2, { progressionType: "rir" }), ex(MACHINE_ROW, 2, { progressionType: "rir" }),
          ex(DIP_CHEST, 2, { progressionType: "rir" }), ex(PENDLAY_ROW, 3, { progressionType: "rir" }),
          ex(DB_SHOULDER_PRESS, 3, { progressionType: "rir" }), ex(BARBELL_CURL, 3, { progressionType: "rir" }),
          ex(SKULLCRUSHER, 3, { progressionType: "rir" }),
        ],
      },
      {
        name: "Lower Body Power", ex: [
          ex(SQUAT, 3), ex(HACK_SQUAT, 2, { progressionType: "rir" }), ex(LEG_EXTENSION, 2, { progressionType: "rir" }),
          ex(STIFF_LEG_DEADLIFT, 3, { progressionType: "rir" }), ex(LEG_CURL, 2, { progressionType: "rir" }),
          ex(CALF_RAISE_BB, 3, { progressionType: "rir" }), ex(SEATED_CALF_RAISE, 2, { progressionType: "rir" }),
        ],
      },
      {
        name: "Back & Shoulders Hypertrophy", ex: [
          ex(PENDLAY_ROW, 6, { progressionType: "rir" }), ex(DB_BENT_ROW, 3, { progressionType: "rir" }),
          ex(CABLE_SEATED_ROW, 3, { progressionType: "rir" }), ex(MACHINE_ROW, 2, { progressionType: "rir" }),
          ex(LAT_PULLDOWN, 2, { progressionType: "rir" }), ex(DB_SHOULDER_PRESS, 3, { progressionType: "rir" }),
          ex(UPRIGHT_ROW_DB, 2, { progressionType: "rir" }), ex(DB_LATERAL_RAISE, 3, { progressionType: "rir" }),
        ],
      },
      {
        name: "Lower Body Hypertrophy", ex: [
          ex(SQUAT, 6, { progressionType: "rir" }), ex(HACK_SQUAT, 3, { progressionType: "rir" }),
          ex(LEG_PRESS, 2, { progressionType: "rir" }), ex(LEG_EXTENSION, 3, { progressionType: "rir" }),
          ex(RDL, 3, { progressionType: "rir" }), ex(LEG_CURL, 2, { progressionType: "rir" }),
          ex(SEATED_LEG_CURL, 2, { progressionType: "rir" }), ex(DONKEY_CALF_RAISE, 4, { progressionType: "rir" }),
          ex(SEATED_CALF_RAISE, 3, { progressionType: "rir" }),
        ],
      },
      {
        name: "Chest & Arms Hypertrophy", ex: [
          ex(DB_FLAT_PRESS, 6, { progressionType: "rir" }), ex(DB_INCLINE_PRESS, 3, { progressionType: "rir" }),
          ex(INCLINE_BB_BENCH, 3, { progressionType: "rir" }), ex(INCLINE_CABLE_FLY, 2, { progressionType: "rir" }),
          ex(PREACHER_CURL_BB, 3, { progressionType: "rir" }), ex(CONCENTRATION_CURL, 2, { progressionType: "rir" }),
          ex(SPIDER_CURL, 2, { progressionType: "rir" }), ex(SKULLCRUSHER, 3, { progressionType: "rir" }),
          ex(TRICEPS_PUSHDOWN, 2, { progressionType: "rir" }), ex(CABLE_KICKBACK, 2, { progressionType: "rir" }),
        ],
      },
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
    templateId: "cat_531", name: "5/3/1 (Original)", style: "strength", progressionType: "531",
    tags: ["531", "powerlifting", "training max"], difficulty: "intermediate", daysPerWeek: 4, weeks: 16,
    days: [
      { name: "Squat Day", ex: [ex(SQUAT, 3, { liftKey: "squat" }), ex(HANGING_LEG_RAISE, 3, { progressionType: "rir" })] },
      { name: "Bench Day", ex: [ex(BENCH, 3, { liftKey: "bench" }), ex(TRICEPS_PUSHDOWN, 3, { progressionType: "rir" })] },
      { name: "Deadlift Day", ex: [ex(DEADLIFT, 3, { liftKey: "deadlift" }), ex(BARBELL_SHRUG, 3, { progressionType: "rir" })] },
      { name: "OHP Day", ex: [ex(OHP, 3, { liftKey: "ohp" }), ex(CHINUP, 3, { progressionType: "rir" })] },
    ],
  },
  {
    templateId: "cat_531bbb", name: "5/3/1 Boring But Big", style: "hypertrophy", progressionType: "531",
    tags: ["531", "high volume", "training max"], difficulty: "intermediate", daysPerWeek: 4, weeks: 16,
    bbbVolume: true,
    days: [
      { name: "Squat Day", ex: [ex(SQUAT, 8, { liftKey: "squat" }), ex(HANGING_LEG_RAISE, 3, { progressionType: "rir" })] },
      { name: "Bench Day", ex: [ex(BENCH, 8, { liftKey: "bench" }), ex(TRICEPS_PUSHDOWN, 3, { progressionType: "rir" })] },
      { name: "Deadlift Day", ex: [ex(DEADLIFT, 8, { liftKey: "deadlift" }), ex(BARBELL_SHRUG, 3, { progressionType: "rir" })] },
      { name: "OHP Day", ex: [ex(OHP, 8, { liftKey: "ohp" }), ex(CHINUP, 3, { progressionType: "rir" })] },
    ],
  },
  {
    templateId: "cat_nsuns", name: "nSuns 5/3/1 LP", style: "strength", progressionType: "nsuns",
    tags: ["531", "high frequency", "training max"], difficulty: "advanced", daysPerWeek: 4, weeks: 16,
    days: [
      { name: "Bench + OHP", ex: [ex(BENCH, 9, { liftKey: "bench", tier: "T1", t1Variant: "benchLight" }), ex(OHP, 8, { liftKey: "ohp", tier: "T2", t2Base: 50 })] },
      { name: "Squat + Sumo Deadlift", ex: [ex(SQUAT, 9, { liftKey: "squat", tier: "T1", t1Variant: "squat" }), ex(SUMO_DEADLIFT, 8, { liftKey: "deadlift", tier: "T2", t2Base: 50 })] },
      { name: "Bench + Close-Grip Bench", ex: [ex(BENCH, 9, { liftKey: "bench", tier: "T1", t1Variant: "benchHeavy" }), ex(CLOSE_GRIP_BENCH, 8, { liftKey: "bench", tier: "T2", t2Base: 40 })] },
      { name: "Deadlift + Front Squat", ex: [ex(DEADLIFT, 9, { liftKey: "deadlift", tier: "T1", t1Variant: "deadlift" }), ex(FRONT_SQUAT, 8, { liftKey: "squat", tier: "T2", t2Base: 35 })] },
    ],
  },
  {
    templateId: "cat_gzclp", name: "GZCLP", style: "strength", progressionType: "gzclp",
    tags: ["gzcl", "tiered"], difficulty: "intermediate", daysPerWeek: 4, weeks: 16,
    days: [
      { name: "Day A", ex: [ex(SQUAT, 5, { liftKey: "squat", tier: "T1" }), ex(BENCH, 3, { liftKey: "bench", tier: "T2" }), ex(LAT_PULLDOWN, 3, { tier: "T3" })] },
      { name: "Day B", ex: [ex(OHP, 5, { liftKey: "ohp", tier: "T1" }), ex(DEADLIFT, 3, { liftKey: "deadlift", tier: "T2" }), ex(DB_HAMMER_CURL, 3, { tier: "T3" })] },
      { name: "Day C", ex: [ex(BENCH, 5, { liftKey: "bench", tier: "T1" }), ex(SQUAT, 3, { liftKey: "squat", tier: "T2" }), ex(TRICEPS_PUSHDOWN, 3, { tier: "T3" })] },
      { name: "Day D", ex: [ex(DEADLIFT, 5, { liftKey: "deadlift", tier: "T1" }), ex(OHP, 3, { liftKey: "ohp", tier: "T2" }), ex(CHINUP, 3, { tier: "T3" })] },
    ],
  },
];
