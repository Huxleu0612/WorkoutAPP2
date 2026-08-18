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

/* Garage-gym ids: barbell, dumbbells, rack, bench, cable machine, pull-up bar.
   Nothing below needs a leverage machine, a GHD or a resistance band. */
const LOW_BAR_SQUAT = "1435";     // Barbell Low Bar Squat
const FRONT_SQUAT = "0042";       // Barbell Front Squat
const INCLINE_BENCH = "0047";     // Barbell Incline Bench Press
const RDL = "0085";               // Barbell Romanian Deadlift
const DB_RDL = "1459";            // Dumbbell Romanian Deadlift
const RACK_PULL = "0074";         // Barbell Rack Pull
const BB_GLUTE_BRIDGE = "1409";   // Barbell Glute Bridge
const GLUTE_BRIDGE_MARCH = "3561";// Glute Bridge March
const DB_ONE_ARM_ROW = "0292";    // Dumbbell One Arm Bent-Over Row
const CABLE_SEATED_ROW = "0180";  // Cable Low Seated Row
const DB_STEP_UP = "0431";        // Dumbbell Step-Up
const DB_GOBLET_SQUAT = "1760";   // Dumbbell Goblet Squat
const DB_INCLINE_BENCH = "0314";  // Dumbbell Incline Bench Press
const DB_SHOULDER_PRESS = "0405"; // Dumbbell Seated Shoulder Press
const DB_LATERAL_RAISE = "0334";  // Dumbbell Lateral Raise
const DB_CALF_RAISE = "0417";     // Dumbbell Standing Calf Raise
const SIDE_HIP_ABDUCTION = "0710";// Side Hip Abduction
const SIDE_BRIDGE_ABDUCTION = "1774"; // Side Bridge Hip Abduction
const CABLE_TWIST = "0243";       // Cable Twist
const PLANK = "plank";            // Plank
const SIDE_PLANK = "3544";        // Bodyweight Incline Side Plank
const WIDE_PULLUP = "1429";       // Wide Grip Pull-Up


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

  /* Strong Curves: Bootyful Beginnings — Bret Contreras.
     8 weeks, 3 days, glute-led with balanced upper and core work. Runs on `rir` because the
     real program progresses by adding load or reps as sessions get easier, not on a fixed
     weekly increment.

     Four movements are not in the exercise dataset and are substituted, closest pattern first:
       Box squat            -> low bar squat  (same hip-dominant squat pattern)
       Single-leg glute bridge -> glute bridge march (the unilateral bridge that does exist)
       Single-leg RDL       -> dumbbell RDL   (hinge kept, balance demand dropped)
       X-band walk / clam   -> side bridge hip abduction (no bands in the equipment list)
     Back extension is also swapped for a dumbbell RDL, since it needs a GHD or ball. */
  {
    templateId: "cat_strongcurves", name: "Strong Curves: Bootyful Beginnings", style: "hypertrophy", progressionType: "rir",
    tags: ["glutes", "lower body", "beginner friendly", "garage gym"], difficulty: "beginner", daysPerWeek: 3, weeks: 8,
    days: [
      { name: "Workout A", ex: [
        ex(BB_GLUTE_BRIDGE, 3), ex(DB_ONE_ARM_ROW, 3), ex(LOW_BAR_SQUAT, 3), ex(BENCH, 3),
        ex(RDL, 3), ex(SIDE_HIP_ABDUCTION, 2), ex(PLANK, 2), ex(SIDE_PLANK, 2),
      ] },
      { name: "Workout B", ex: [
        ex(GLUTE_BRIDGE_MARCH, 3), ex(LAT_PULLDOWN, 3), ex(DB_STEP_UP, 3), ex(OHP, 3),
        ex(DB_RDL, 3), ex(SIDE_BRIDGE_ABDUCTION, 2), ex(PLANK, 2), ex(SIDE_PLANK, 2),
      ] },
      { name: "Workout C", ex: [
        ex(GLUTE_BRIDGE_MARCH, 3), ex(CABLE_SEATED_ROW, 3), ex(DB_GOBLET_SQUAT, 3), ex(INCLINE_BENCH, 3),
        ex(DB_RDL, 3), ex(SIDE_BRIDGE_ABDUCTION, 2), ex(PLANK, 2), ex(CABLE_TWIST, 2),
      ] },
    ],
  },

  /* Basement Bodybuilding: Home Gym Upper Lower.
     8 weeks, 4 days, written for exactly a rack / barbell / dumbbells setup, so nothing here
     is substituted. Upper A chest and biceps, Lower A quads and calves, Upper B shoulders and
     triceps, Lower B hamstrings and traps. `rir` for the same reason as above. */
  {
    templateId: "cat_basementbb", name: "Basement Bodybuilding: Upper/Lower", style: "hypertrophy", progressionType: "rir",
    tags: ["upper/lower", "garage gym", "beginner friendly", "high volume"], difficulty: "beginner", daysPerWeek: 4, weeks: 8,
    days: [
      { name: "Upper A", ex: [
        ex(BENCH, 4), ex(DB_INCLINE_BENCH, 3), ex(DB_ONE_ARM_ROW, 4), ex(LAT_PULLDOWN, 3), ex(DB_HAMMER_CURL, 3),
      ] },
      { name: "Lower A", ex: [
        ex(LOW_BAR_SQUAT, 4), ex(DB_STEP_UP, 3), ex(RACK_PULL, 3), ex(DB_CALF_RAISE, 4), ex(PLANK, 2),
      ] },
      { name: "Upper B", ex: [
        ex(OHP, 4), ex(DB_SHOULDER_PRESS, 3), ex(WIDE_PULLUP, 4), ex(DB_LATERAL_RAISE, 3), ex(TRICEPS_PUSHDOWN, 3),
      ] },
      { name: "Lower B", ex: [
        ex(FRONT_SQUAT, 4), ex(RDL, 4), ex(BB_GLUTE_BRIDGE, 3), ex(BARBELL_SHRUG, 3), ex(HANGING_LEG_RAISE, 3),
      ] },
    ],
  },
];
