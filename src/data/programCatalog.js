/* Real, well-documented public training programs (not proprietary content).
   Each template is cloned into a real program object by addFromTemplate() in App.jsx,
   which stamps the runtime fields (active, startedAt, pausedAt, pausedMs, scheduleDays,
   lastReadiness, sourceTemplateId) — templates themselves only describe the plan.

   The library is deliberately just these two. Both run their real engines: 5/3/1 BBB on the
   four-week training-max wave with its volume block, GZCLP on the tiered T1/T2/T3 state
   machines. Per-exercise `progressionType` overrides the program-level one, which is how
   BBB's main lifts stay on the 5/3/1 wave while its assistance work runs on RIR.

   The linear and rir engines in lib/progression.js are still live — they carry custom
   programs built in the app, which is the other way to get a program. */

const ex = (id, sets, cfg) => ({ id, sets, last: { w: 0, reps: 5, rir: "amber", logged: false }, ...cfg });

/* dataset exercise ids used below (id : name) */
const SQUAT = "1436"; // Barbell High Bar Squat
const BENCH = "0025"; // Barbell Bench Press
const DEADLIFT = "0032"; // Barbell Deadlift
const OHP = "1457"; // Barbell Standing Wide Military Press
const CHINUP = "1326"; // Chin-Up
const DB_HAMMER_CURL = "0313"; // Dumbbell Hammer Curl
const LAT_PULLDOWN = "0198"; // Cable Pulldown
const TRICEPS_PUSHDOWN = "0241"; // Cable Triceps Pushdown (V-Bar)
const BARBELL_SHRUG = "0095"; // Barbell Shrug
const HANGING_LEG_RAISE = "0472"; // Hanging Leg Raise


export const PROGRAM_CATALOG = [
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
