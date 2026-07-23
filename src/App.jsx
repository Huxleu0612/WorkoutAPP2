import React, { useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip,
} from "recharts";
import {
  Home, Dumbbell, Layers, User, Plus, Minus, Check, ChevronLeft, ChevronRight,
  Search, X, TrendingDown, ArrowUp, ArrowRight, ArrowDown, Zap, Activity, Moon, BarChart3,
} from "lucide-react";

/* ================================================================
   DESIGN TOKENS  —  clinical · straight lines · graphite + electric blue
================================================================ */
const C = {
  page: "#EEF0F3", card: "#FFFFFF", ink: "#12141A", sub: "#6B7280", faint: "#A0A5AE",
  line: "#E2E5EA", lineSoft: "#EDEFF2", graphite: "#14161C", graphite2: "#1D2028",
  onDark: "#F4F6FA", onDarkSub: "#9AA0AC", onDarkLine: "#2A2E37",
  green: "#12A150", amber: "#E08600", red: "#E5484D",
  greenBg: "#E7F5EC", amberBg: "#FBF0DE", redBg: "#FBE9E9",
};
const ACC = "#2F6BFF";
const ACC_BG = "#E9F0FF";
const MONO = "'SF Mono','JetBrains Mono','Roboto Mono',ui-monospace,monospace";
const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,system-ui,sans-serif";

/* ---------- units (math in kg, convert at render) ---------- */
const KG_TO_LB = 2.20462;
const fmtW = (kg, unit) => (unit === "lb" ? kg * KG_TO_LB : kg);
const wStr = (kg, unit) => fmtW(kg, unit).toFixed(1);
const round5 = (v) => Math.round(v / 2.5) * 2.5;
const commas = (n) => Math.round(n).toLocaleString();

/* ---------- progression logic: hypertrophy 8–12, fatigue-aware, prescriptive ---------- */
function recommend(last, lastReadiness, todayReadiness) {
  const BAND = "8–12";
  if (last.w === 0)
    return { w: 0, band: `${last.reps + 1}`, dir: "up", action: "Add a rep",
      note: "Bodyweight — chase one more clean rep.", lastRir: last.rir };

  let out;
  if (last.rir === "green") {
    out = { w: round5(last.w + 2.5), band: BAND, dir: "up", action: "Increase weight",
      note: "You had 3+ reps in reserve — add load, reps will drop back toward 8.", lastRir: last.rir };
  } else if (last.rir === "amber") {
    out = { w: last.w, band: BAND, dir: "hold", action: "Hold, add a rep",
      note: "Right in the 8–12 zone — same weight, earn one more rep.", lastRir: last.rir };
  } else {
    if (lastReadiness === "tired")
      out = { w: last.w, band: BAND, dir: "hold", action: "Hold",
        note: "Hit failure, but you trained tired — repeat before adding load.", lastRir: last.rir };
    else if (lastReadiness === "energized" && last.reps < 8)
      out = { w: round5(Math.max(last.w - 2.5, 0)), band: BAND, dir: "down", action: "Ease off",
        note: "Fresh but under 8 reps — small drop to rebuild inside the range.", lastRir: last.rir };
    else
      out = { w: last.w, band: BAND, dir: "hold", action: "Hold",
        note: "True max effort — consolidate this weight before progressing.", lastRir: last.rir };
  }
  if (todayReadiness === "tired" && out.dir === "up")
    out = { ...out, w: last.w, dir: "hold", action: "Hold",
      note: "Tired today — match last week, push again when you're fresh." };
  return out;
}

/* ================================================================
   SEED DATA
================================================================ */
const EXERCISE_DB = [
  { id: "bb_bench", name: "Barbell Bench Press", muscle: "Chest", equip: "Barbell" },
  { id: "db_incline", name: "Incline Dumbbell Press", muscle: "Chest", equip: "Dumbbell" },
  { id: "pushup", name: "Push-Up", muscle: "Chest", equip: "Bodyweight" },
  { id: "bb_row", name: "Barbell Row", muscle: "Back", equip: "Barbell" },
  { id: "pullup", name: "Pull-Up", muscle: "Back", equip: "Bodyweight" },
  { id: "db_row", name: "One-Arm Dumbbell Row", muscle: "Back", equip: "Dumbbell" },
  { id: "band_pull", name: "Band Pull-Apart", muscle: "Back", equip: "Bands" },
  { id: "bb_squat", name: "Barbell Back Squat", muscle: "Legs", equip: "Barbell" },
  { id: "rdl", name: "Romanian Deadlift", muscle: "Legs", equip: "Barbell" },
  { id: "db_lunge", name: "Dumbbell Walking Lunge", muscle: "Legs", equip: "Dumbbell" },
  { id: "kb_swing", name: "Kettlebell Swing", muscle: "Legs", equip: "Kettlebell" },
  { id: "db_ohp", name: "Seated Dumbbell Press", muscle: "Shoulders", equip: "Dumbbell" },
  { id: "lat_raise", name: "Dumbbell Lateral Raise", muscle: "Shoulders", equip: "Dumbbell" },
  { id: "db_curl", name: "Dumbbell Bicep Curl", muscle: "Arms", equip: "Dumbbell" },
  { id: "skull", name: "EZ-Bar Skullcrusher", muscle: "Arms", equip: "Barbell" },
  { id: "plank", name: "Plank", muscle: "Core", equip: "Bodyweight" },
];
const exName = (id) => EXERCISE_DB.find((e) => e.id === id)?.name || id;
const exMuscle = (id) => EXERCISE_DB.find((e) => e.id === id)?.muscle || "";

const INITIAL_PROGRAMS = [
  {
    id: "p1", name: "Strength", lastRun: "Active now · week 7", active: true, lastReadiness: "tired",
    days: [
      { name: "Day A — Push", ex: [
        { id: "bb_bench", sets: 3, last: { w: 60, reps: 5, rir: "amber" } },
        { id: "db_incline", sets: 3, last: { w: 24, reps: 6, rir: "red" } },
        { id: "db_ohp", sets: 3, last: { w: 22, reps: 8, rir: "green" } },
        { id: "skull", sets: 2, last: { w: 25, reps: 10, rir: "green" } },
      ] },
      { name: "Day B — Pull", ex: [
        { id: "bb_row", sets: 3, last: { w: 50, reps: 6, rir: "amber" } },
        { id: "pullup", sets: 3, last: { w: 0, reps: 8, rir: "red" } },
        { id: "db_curl", sets: 3, last: { w: 14, reps: 11, rir: "green" } },
      ] },
      { name: "Day C — Legs", ex: [
        { id: "bb_squat", sets: 4, last: { w: 80, reps: 5, rir: "amber" } },
        { id: "rdl", sets: 3, last: { w: 70, reps: 8, rir: "green" } },
      ] },
      { name: "Day D — Full Body", ex: [
        { id: "db_lunge", sets: 3, last: { w: 20, reps: 10, rir: "amber" } },
        { id: "lat_raise", sets: 3, last: { w: 10, reps: 12, rir: "green" } },
        { id: "plank", sets: 3, last: { w: 0, reps: 45, rir: "amber" } },
      ] },
    ],
  },
  { id: "p2", name: "Hypertrophy", lastRun: "Last run 3 months ago", active: false, lastReadiness: "normal", days: [] },
  { id: "p3", name: "Conditioning", lastRun: "Last run 6 months ago", active: false, lastReadiness: "normal", days: [] },
];

// collated stats for the active program (kg canonical)
const PROGRAM_STATS = {
  workouts: 25, sets: 340, reps: 3120, volumeKg: 152400, prs: 6,
  lifts: [
    { id: "bb_squat", start: 72.5, now: 82.5 },
    { id: "rdl", start: 60, now: 72.5 },
    { id: "bb_bench", start: 55, now: 62.5 },
    { id: "bb_row", start: 45, now: 52.5 },
    { id: "db_ohp", start: 18, now: 22 },
    { id: "db_incline", start: 20, now: 24 },
  ],
};

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
const DAY_FULL = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
// scheduled workout days = Mon, Tue, Thu, Sat (indices 0,1,3,5); tied to program days
const DAY_WORKOUT_NAMES = ["Push", "Pull", "Rest", "Legs", "Rest", "Full Body", "Rest"];
// day = { sch: scheduled workout, done: completed, w: weight kg|null }
const S = (done, w) => ({ sch: true, done, w });
const R = (w) => ({ sch: false, done: false, w });
const WEEKS = [
  { label: "Week 5", days: [S(true, 82.9), S(true, 82.4), R(82.7), S(true, 82.5), R(82.6), S(true, 82.2), R(82.3)] },
  { label: "Week 6", days: [S(true, 82.3), S(true, 82.0), R(82.1), S(true, 81.7), R(81.9), S(false, null), R(81.8)] },
  { label: "Week 7", days: [S(true, 82.4), S(true, 82.1), R(82.3), S(true, 81.5), R(null), S(false, null), R(null)] },
];

const TREND = {
  "7D": { pts: [82.4, 82.1, 82.3, 81.8, 81.6, 81.9, 81.5], x: ["M", "T", "W", "T", "F", "S", "S"] },
  "1M": { pts: [83.2, 82.9, 82.6, 82.3, 82.0, 81.7, 81.5], x: ["", "W1", "", "W2", "", "W3", "W4"] },
  "6M": { pts: [86.0, 85.1, 84.2, 83.3, 82.4, 81.5], x: ["Feb", "Mar", "Apr", "May", "Jun", "Jul"] },
  "All": { pts: [92.0, 90.1, 88.0, 86.2, 84.1, 82.6, 81.5], x: ["'23", "", "'24", "", "'25", "", "'26"] },
};

const RIR = {
  green: { c: C.green, bg: C.greenBg, label: "Easy", note: "3+ reps left" },
  amber: { c: C.amber, bg: C.amberBg, label: "Working", note: "1–2 reps left" },
  red: { c: C.red, bg: C.redBg, label: "Max", note: "0 reps left" },
};
const READINESS = [
  { v: "energized", label: "Energized", Icon: Zap },
  { v: "normal", label: "Normal", Icon: Activity },
  { v: "tired", label: "Tired", Icon: Moon },
];
const GOALS = [{ v: "bulk", l: "Bulk" }, { v: "maintain", l: "Maintain" }, { v: "shred", l: "Shred" }];
const GOAL_RATE = { bulk: 0.25, maintain: 0, shred: -0.5 };

/* ================================================================
   SHARED UI
================================================================ */
const Card = ({ children, style }) => (
  <div style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.line}`, ...style }}>{children}</div>
);
const Eyebrow = ({ children, dark }) => (
  <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: 1.6, textTransform: "uppercase", color: dark ? C.onDarkSub : C.faint, fontWeight: 500 }}>{children}</div>
);
const PageTitle = ({ children, sub }) => (
  <>{sub && <Eyebrow>{sub}</Eyebrow>}
    <h1 style={{ fontFamily: SANS, fontSize: 30, fontWeight: 700, color: C.ink, margin: "4px 0 20px", letterSpacing: -0.7 }}>{children}</h1></>
);
const BigButton = ({ children, onClick, tone = "acc" }) => {
  const bg = tone === "done" ? C.greenBg : tone === "dark" ? C.ink : ACC;
  const col = tone === "done" ? C.green : "#fff";
  return (
    <button onClick={onClick} style={{ width: "100%", height: 58, borderRadius: 13, border: "none", cursor: "pointer",
      background: bg, color: col, fontFamily: SANS, fontSize: 16, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, WebkitTapHighlightColor: "transparent" }}>
      {tone === "done" && <Check size={18} strokeWidth={3} />}{children}
    </button>
  );
};
const Segmented = ({ options, value, onChange, small }) => (
  <div style={{ display: "flex", background: C.lineSoft, borderRadius: 11, padding: 3, gap: 3 }}>
    {options.map((o) => {
      const v = o.v ?? o, on = value === v;
      return (
        <button key={v} onClick={() => onChange(v)} style={{ flex: 1, height: small ? 32 : 38, border: "none", borderRadius: 8, cursor: "pointer",
          background: on ? C.card : "transparent", color: on ? C.ink : C.sub, fontFamily: SANS, fontSize: small ? 12 : 13.5, fontWeight: 600,
          boxShadow: on ? "0 1px 2px rgba(0,0,0,.07)" : "none", WebkitTapHighlightColor: "transparent" }}>{o.l ?? o}</button>
      );
    })}
  </div>
);
const Switch = ({ on, onToggle }) => (
  <button onClick={onToggle} style={{ width: 48, height: 29, borderRadius: 15, border: "none", cursor: "pointer", background: on ? ACC : C.line, position: "relative", transition: "background .15s", WebkitTapHighlightColor: "transparent" }}>
    <div style={{ position: "absolute", top: 3, left: on ? 22 : 3, width: 23, height: 23, borderRadius: 12, background: "#fff", transition: "left .15s", boxShadow: "0 1px 2px rgba(0,0,0,.2)" }} />
  </button>
);
const MiniStep = ({ onClick, children }) => (
  <button onClick={onClick} style={{ width: 34, height: 34, borderRadius: 9, border: `1.5px solid ${C.line}`, background: C.card, color: C.ink, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>{children}</button>
);
function Dial({ pct, size = 92, stroke = 9 }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, off = c * (1 - pct / 100);
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke={C.onDarkLine} strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={ACC} strokeWidth={stroke} fill="none" strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontFamily: MONO, fontSize: 22, fontWeight: 600, color: C.onDark, lineHeight: 1 }}>{pct}</span>
        <span style={{ fontFamily: MONO, fontSize: 10, color: C.onDarkSub }}>%</span>
      </div>
    </div>
  );
}
const stepBtn = { width: 64, height: 64, borderRadius: 16, border: `1.5px solid ${C.line}`, background: C.card, color: C.ink, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", WebkitTapHighlightColor: "transparent" };
const backBtn = { display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: C.sub, fontFamily: SANS, fontSize: 15, cursor: "pointer", padding: "6px 0", marginBottom: 6, WebkitTapHighlightColor: "transparent" };

/* ================================================================
   PROGRAM STATS  (clicked from dashboard hero)
================================================================ */
function ProgramStats({ unit, onBack }) {
  const s = PROGRAM_STATS;
  const tiles = [
    { k: "Workouts", v: commas(s.workouts) },
    { k: "Total volume", v: `${commas(fmtW(s.volumeKg, unit))}`, u: unit },
    { k: "Total sets", v: commas(s.sets) },
    { k: "Personal records", v: commas(s.prs) },
  ];
  return (
    <div style={{ padding: "6px 18px 24px" }}>
      <button onClick={onBack} style={backBtn}><ChevronLeft size={20} /> Dashboard</button>
      <PageTitle sub="Strength · week 7 of 12">Program stats</PageTitle>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        {tiles.map((t) => (
          <Card key={t.k} style={{ padding: 16 }}>
            <div style={{ fontFamily: MONO, fontSize: 24, fontWeight: 600, color: C.ink }}>{t.v}{t.u && <span style={{ fontSize: 12, color: C.sub }}> {t.u}</span>}</div>
            <div style={{ fontFamily: SANS, fontSize: 12.5, color: C.sub, marginTop: 4 }}>{t.k}</div>
          </Card>
        ))}
      </div>

      <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: 1.5, textTransform: "uppercase", color: C.faint, fontWeight: 500, margin: "0 4px 8px", display: "flex", alignItems: "center", gap: 6 }}>
        <BarChart3 size={13} /> Strength progress · since week 1
      </div>
      <Card style={{ padding: "6px 16px" }}>
        {s.lifts.map((l, i) => {
          const delta = l.now - l.start;
          return (
            <div key={l.id} style={{ display: "flex", alignItems: "center", padding: "13px 0", borderBottom: i < s.lifts.length - 1 ? `1px solid ${C.lineSoft}` : "none" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: SANS, fontSize: 14.5, fontWeight: 550, color: C.ink }}>{exName(l.id)}</div>
                <div style={{ fontFamily: MONO, fontSize: 11, color: C.faint, marginTop: 2 }}>{wStr(l.start, unit)} → {wStr(l.now, unit)} {unit}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, background: C.greenBg, borderRadius: 7, padding: "5px 9px" }}>
                <ArrowUp size={13} color={C.green} strokeWidth={2.6} />
                <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 600, color: C.green }}>{wStr(delta, unit)}</span>
              </div>
            </div>
          );
        })}
      </Card>
      <div style={{ fontFamily: SANS, fontSize: 12.5, color: C.sub, textAlign: "center", marginTop: 16, lineHeight: 1.5 }}>
        Totals are collated from every logged set in this program block.
      </div>
    </div>
  );
}

/* ================================================================
   DASHBOARD
================================================================ */
function Dashboard({ unit }) {
  const [view, setView] = useState("main");
  const [weightKg, setWeightKg] = useState(81.5);
  const [logged, setLogged] = useState(false);
  const [wkIdx, setWkIdx] = useState(WEEKS.length - 1);
  const [selDay, setSelDay] = useState(3);
  const [period, setPeriod] = useState("7D");

  if (view === "stats") return <ProgramStats unit={unit} onBack={() => setView("main")} />;

  const step = (d) => { setWeightKg((w) => Math.round((w + d) * 10) / 10); setLogged(false); };
  const week = WEEKS[wkIdx];
  const day = week.days[selDay];
  const t = TREND[period];
  const disp = t.pts.map((p) => +fmtW(p, unit).toFixed(1));
  const trendData = disp.map((w, i) => ({ x: t.x[i], w }));
  const lo = Math.floor(Math.min(...disp) / 5) * 5, hi = Math.ceil(Math.max(...disp) / 5) * 5;
  const ticks = []; for (let v = lo; v <= hi; v += 5) ticks.push(v);
  const delta = disp[disp.length - 1] - disp[0];

  const dayDetail = day.done ? `${DAY_WORKOUT_NAMES[selDay]} workout completed`
    : day.sch ? `${DAY_WORKOUT_NAMES[selDay]} — scheduled` : "Rest day";

  return (
    <div style={{ padding: "6px 18px 24px" }}>
      <PageTitle sub="Thursday · 23 Jul">Dashboard</PageTitle>

      {/* GRAPHITE HERO (tap → program stats) */}
      <button onClick={() => setView("stats")} style={{ display: "block", width: "100%", textAlign: "left", cursor: "pointer", border: `1px solid ${C.onDarkLine}`,
        background: `linear-gradient(150deg, ${C.graphite2}, ${C.graphite})`, borderRadius: 16, padding: 20, marginBottom: 16, WebkitTapHighlightColor: "transparent" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
          <div>
            <Eyebrow dark>Active program</Eyebrow>
            <div style={{ fontFamily: SANS, fontSize: 24, fontWeight: 680, color: C.onDark, marginTop: 6 }}>Strength</div>
            <div style={{ fontFamily: MONO, fontSize: 11, color: C.onDarkSub, marginTop: 5 }}>CYCLES TO HYPERTROPHY IN 5 WEEKS</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: MONO, fontSize: 26, fontWeight: 600, color: C.onDark, lineHeight: 1 }}>07</div>
            <div style={{ fontFamily: MONO, fontSize: 10, color: C.onDarkSub, marginTop: 3 }}>/ 12 WEEKS</div>
          </div>
        </div>
        <div style={{ height: 5, background: C.onDarkLine, borderRadius: 3, marginBottom: 20, overflow: "hidden" }}>
          <div style={{ width: "58%", height: "100%", background: ACC, borderRadius: 3 }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <Dial pct={90} />
          <div>
            <Eyebrow dark>Consistency</Eyebrow>
            <div style={{ fontFamily: SANS, fontSize: 15, color: C.onDark, fontWeight: 500, marginTop: 8, lineHeight: 1.4 }}>
              <span style={{ fontFamily: MONO, fontWeight: 600 }}>25</span> of <span style={{ fontFamily: MONO, fontWeight: 600 }}>28</span> scheduled<br />workouts done this block
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 5, marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.onDarkLine}` }}>
          <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: 1.2, color: C.onDarkSub, textTransform: "uppercase" }}>View full stats</span>
          <ChevronRight size={15} color={C.onDarkSub} />
        </div>
      </button>

      {/* WEEK STRIP with nav + dumbbell icons */}
      <Card style={{ padding: "14px 12px", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 4px", marginBottom: 14 }}>
          <MiniStep onClick={() => { setWkIdx(Math.max(0, wkIdx - 1)); setSelDay(0); }}><ChevronLeft size={18} /></MiniStep>
          <Eyebrow>{week.label} · 4 sessions</Eyebrow>
          <MiniStep onClick={() => { if (wkIdx < WEEKS.length - 1) { setWkIdx(wkIdx + 1); setSelDay(0); } }}><ChevronRight size={18} color={wkIdx < WEEKS.length - 1 ? C.ink : C.faint} /></MiniStep>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
          {DAY_LABELS.map((d, i) => {
            const s = week.days[i], sel = i === selDay;
            return (
              <button key={i} onClick={() => setSelDay(i)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, WebkitTapHighlightColor: "transparent" }}>
                <div style={{ fontFamily: MONO, fontSize: 10, color: sel ? C.ink : C.faint, fontWeight: sel ? 700 : 400, marginBottom: 7 }}>{d}</div>
                <div style={{ width: 32, height: 32, margin: "0 auto", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center",
                  background: s.done ? C.ink : C.card,
                  border: `1.5px solid ${sel ? ACC : s.done ? C.ink : s.sch ? C.line : C.lineSoft}`,
                  boxShadow: sel ? `0 0 0 2px ${ACC_BG}` : "none" }}>
                  {s.sch && <Dumbbell size={14} color={s.done ? "#fff" : C.faint} strokeWidth={2.2} />}
                </div>
                <div style={{ width: 6, height: 6, borderRadius: 3, margin: "7px auto 0", background: s.w != null ? C.green : C.line }} />
              </button>
            );
          })}
        </div>
        <div style={{ marginTop: 14, padding: "12px 14px", background: C.page, borderRadius: 11, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontFamily: SANS, fontSize: 14, fontWeight: 650, color: C.ink }}>{DAY_FULL[selDay]}</div>
            <div style={{ fontFamily: SANS, fontSize: 12, color: C.sub, marginTop: 2 }}>{dayDetail}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: MONO, fontSize: 16, fontWeight: 600, color: day.w != null ? C.ink : C.faint }}>{day.w != null ? wStr(day.w, unit) : "—"}</div>
            <div style={{ fontFamily: MONO, fontSize: 9, color: C.faint, marginTop: 2 }}>{unit.toUpperCase()}</div>
          </div>
        </div>
      </Card>

      {/* MORNING WEIGH-IN */}
      <Card style={{ padding: 20, marginBottom: 16 }}>
        <Eyebrow>Morning weigh-in</Eyebrow>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "16px 0" }}>
          <button onClick={() => step(-0.1)} style={stepBtn}><Minus size={26} strokeWidth={2.5} /></button>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: MONO, fontSize: 46, fontWeight: 600, color: C.ink, lineHeight: 1 }}>{wStr(weightKg, unit)}</div>
            <div style={{ fontFamily: MONO, fontSize: 12, color: C.sub, marginTop: 4 }}>{unit.toUpperCase()}</div>
          </div>
          <button onClick={() => step(0.1)} style={stepBtn}><Plus size={26} strokeWidth={2.5} /></button>
        </div>
        <BigButton tone={logged ? "done" : "acc"} onClick={() => setLogged(true)}>{logged ? "Logged for today" : "Log weight"}</BigButton>
      </Card>

      {/* TREND with 5-unit gridlines + period toggle */}
      <Card style={{ padding: "16px 8px 12px" }}>
        <div style={{ padding: "0 12px", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
            <Eyebrow>Weight trend</Eyebrow>
            <span style={{ fontFamily: MONO, fontSize: 11, color: delta <= 0 ? C.green : C.red, marginLeft: "auto", display: "flex", alignItems: "center", gap: 3 }}>
              <TrendingDown size={13} />{delta >= 0 ? "+" : ""}{delta.toFixed(1)} {unit.toUpperCase()}
            </span>
          </div>
          <Segmented small options={["7D", "1M", "6M", "All"]} value={period} onChange={setPeriod} />
        </div>
        <ResponsiveContainer width="100%" height={150}>
          <LineChart data={trendData} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={C.lineSoft} />
            <XAxis dataKey="x" tick={{ fontFamily: MONO, fontSize: 10, fill: C.faint }} axisLine={false} tickLine={false} interval={0} />
            <YAxis domain={[lo, hi]} ticks={ticks} tick={{ fontFamily: MONO, fontSize: 10, fill: C.faint }} axisLine={false} tickLine={false} width={34} />
            <Tooltip contentStyle={{ fontFamily: MONO, fontSize: 12, borderRadius: 8, border: `1px solid ${C.line}` }} />
            <Line type="monotone" dataKey="w" stroke={ACC} strokeWidth={2.5} dot={{ r: 3, fill: ACC }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
        <div style={{ fontFamily: MONO, fontSize: 9.5, color: C.faint, textAlign: "right", padding: "0 14px 2px" }}>GRIDLINES EVERY 5 {unit.toUpperCase()}</div>
      </Card>
    </div>
  );
}

/* ================================================================
   TRAIN
================================================================ */
function Train({ unit }) {
  const program = INITIAL_PROGRAMS[0];
  const day = program.days[0];
  const [phase, setPhase] = useState("ready");
  const [readiness, setReadiness] = useState(null);
  const [done, setDone] = useState({});
  const [openRating, setOpenRating] = useState(null);
  const [feeling, setFeeling] = useState(null);

  const totalSets = day.ex.reduce((n, e) => n + e.sets, 0);
  const doneCount = Object.keys(done).length;

  if (phase === "ready") return (
    <div style={{ padding: "6px 18px 24px" }}>
      <PageTitle sub="Strength · Week 7 · Day A">Push</PageTitle>
      <Card style={{ padding: 22 }}>
        <Eyebrow>Before you start</Eyebrow>
        <div style={{ fontFamily: SANS, fontSize: 20, fontWeight: 650, color: C.ink, margin: "8px 0 4px" }}>How are you feeling?</div>
        <div style={{ fontFamily: SANS, fontSize: 13, color: C.sub, marginBottom: 20, lineHeight: 1.4 }}>This tunes today's targets — a tough set won't be read as a plateau if you're just tired.</div>
        <div style={{ display: "grid", gap: 10 }}>
          {READINESS.map(({ v, label, Icon }) => (
            <button key={v} onClick={() => { setReadiness(v); setPhase("active"); }} style={{ display: "flex", alignItems: "center", gap: 14, height: 62, borderRadius: 13, border: `1.5px solid ${C.line}`, background: C.card, cursor: "pointer", padding: "0 18px", WebkitTapHighlightColor: "transparent" }}>
              <div style={{ width: 40, height: 40, borderRadius: 11, background: ACC_BG, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon size={20} color={ACC} /></div>
              <span style={{ fontFamily: SANS, fontSize: 16, fontWeight: 600, color: C.ink }}>{label}</span>
              <ChevronRight size={18} color={C.faint} style={{ marginLeft: "auto" }} />
            </button>
          ))}
        </div>
      </Card>
    </div>
  );

  if (phase === "done") return (
    <div style={{ padding: "6px 18px 24px" }}>
      <PageTitle sub="Strength · Week 7 · Day A">Push</PageTitle>
      <Card style={{ padding: 28, textAlign: "center" }}>
        <div style={{ width: 60, height: 60, borderRadius: 30, background: C.greenBg, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}><Check size={30} color={C.green} strokeWidth={3} /></div>
        <div style={{ fontFamily: SANS, fontSize: 21, fontWeight: 680, color: C.ink }}>Session logged</div>
        <div style={{ fontFamily: SANS, fontSize: 14, color: C.sub, marginTop: 8, lineHeight: 1.5 }}>
          {doneCount} sets recorded · felt <b style={{ color: C.ink }}>{feeling}</b> · you were <b style={{ color: C.ink }}>{readiness}</b>.<br />Next week's targets are set from your ratings.
        </div>
      </Card>
    </div>
  );

  if (phase === "review") return (
    <div style={{ padding: "6px 18px 24px" }}>
      <PageTitle sub="Strength · Week 7 · Day A">Push</PageTitle>
      <Card style={{ padding: 22 }}>
        <Eyebrow>Session complete</Eyebrow>
        <div style={{ fontFamily: SANS, fontSize: 20, fontWeight: 650, color: C.ink, margin: "8px 0 4px" }}>How did that go overall?</div>
        <div style={{ fontFamily: SANS, fontSize: 13, color: C.sub, marginBottom: 20, lineHeight: 1.4 }}>Combined with your ratings, this decides whether to push, hold, or ease off next week.</div>
        <div style={{ display: "grid", gap: 10 }}>
          {[{ v: "too easy", c: C.green }, { v: "just right", c: ACC }, { v: "too hard", c: C.red }].map(({ v, c }) => (
            <button key={v} onClick={() => { setFeeling(v); setPhase("done"); }} style={{ height: 62, borderRadius: 13, border: `1.5px solid ${C.line}`, background: C.card, cursor: "pointer", fontFamily: SANS, fontSize: 16, fontWeight: 600, color: C.ink, textTransform: "capitalize", display: "flex", alignItems: "center", gap: 12, padding: "0 18px", WebkitTapHighlightColor: "transparent" }}>
              <div style={{ width: 12, height: 12, borderRadius: 6, background: c }} />{v}
            </button>
          ))}
        </div>
      </Card>
    </div>
  );

  return (
    <div style={{ padding: "6px 18px 24px" }}>
      <PageTitle sub="Strength · Week 7 · Day A">Push</PageTitle>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: -12, marginBottom: 16 }}>
        <span style={{ fontFamily: MONO, fontSize: 12, color: C.sub }}>{doneCount} / {totalSets} SETS</span>
        {readiness === "tired" && <span style={{ fontFamily: SANS, fontSize: 12, color: ACC, background: ACC_BG, padding: "3px 9px", borderRadius: 6, display: "flex", alignItems: "center", gap: 4 }}><Moon size={12} /> Tired today — targets held</span>}
      </div>

      {day.ex.map((ex, ei) => {
        const rec = recommend(ex.last, program.lastReadiness, readiness);
        const Arrow = rec.dir === "up" ? ArrowUp : rec.dir === "down" ? ArrowDown : ArrowRight;
        const dirColor = rec.dir === "up" ? C.green : rec.dir === "down" ? C.red : C.sub;
        const lr = RIR[rec.lastRir];
        return (
          <Card key={ei} style={{ padding: 18, marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div style={{ fontFamily: SANS, fontSize: 17, fontWeight: 650, color: C.ink, maxWidth: 210 }}>{exName(ex.id)}</div>
              <div style={{ fontFamily: MONO, fontSize: 10.5, color: C.faint }}>{exMuscle(ex.id).toUpperCase()}</div>
            </div>

            {/* intelligent recommendation w/ traffic-light of last week */}
            <div style={{ background: C.page, borderRadius: 11, padding: "12px 14px", margin: "12px 0 14px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 9 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, background: lr.bg, borderRadius: 6, padding: "4px 9px" }}>
                  <div style={{ width: 9, height: 9, borderRadius: 5, background: lr.c }} />
                  <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: .4, color: lr.c, fontWeight: 600 }}>LAST: {lr.label.toUpperCase()}</span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: MONO, fontSize: 17, fontWeight: 600, color: C.ink }}>{rec.w === 0 ? "BW" : wStr(rec.w, unit)}</div>
                  <div style={{ fontFamily: MONO, fontSize: 9.5, color: C.faint }}>{rec.w === 0 ? `${rec.band} REPS` : `${unit.toUpperCase()} · ${rec.band} REPS`}</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <div style={{ width: 22, height: 22, borderRadius: 6, background: C.card, border: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                  <Arrow size={14} color={dirColor} strokeWidth={2.6} />
                </div>
                <div>
                  <span style={{ fontFamily: SANS, fontSize: 13.5, fontWeight: 650, color: dirColor }}>{rec.action}. </span>
                  <span style={{ fontFamily: SANS, fontSize: 13, color: C.sub }}>{rec.note}</span>
                </div>
              </div>
            </div>

            {Array.from({ length: ex.sets }).map((_, si) => {
              const key = `${ei}-${si}`, rated = done[key];
              return (
                <div key={si}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0" }}>
                    <div style={{ fontFamily: MONO, fontSize: 12, color: C.faint, width: 16 }}>{si + 1}</div>
                    <Field label={unit.toUpperCase()} val={rec.w === 0 ? "BW" : wStr(rec.w, unit)} />
                    <Field label="REPS" val={rec.w === 0 ? rec.band : "10"} />
                    <button onClick={() => setOpenRating(openRating === key ? null : key)} style={{ marginLeft: "auto", width: 48, height: 48, borderRadius: 13, cursor: "pointer", border: rated ? "none" : `1.5px solid ${C.line}`, background: rated ? RIR[rated].c : C.card, display: "flex", alignItems: "center", justifyContent: "center", WebkitTapHighlightColor: "transparent" }}>
                      {rated ? <Check size={20} color="#fff" strokeWidth={3} /> : <div style={{ width: 12, height: 12, borderRadius: 6, border: `2px solid ${C.faint}` }} />}
                    </button>
                  </div>
                  {openRating === key && (
                    <div style={{ padding: "6px 0 12px" }}>
                      <div style={{ fontFamily: MONO, fontSize: 10, color: C.faint, letterSpacing: 1, marginBottom: 8 }}>HOW HARD WAS THAT SET?</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                        {["green", "amber", "red"].map((c) => (
                          <button key={c} onClick={() => { setDone({ ...done, [key]: c }); setOpenRating(null); }} style={{ height: 64, borderRadius: 13, border: "none", background: RIR[c].bg, cursor: "pointer", WebkitTapHighlightColor: "transparent", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 }}>
                            <div style={{ width: 16, height: 16, borderRadius: 8, background: RIR[c].c }} />
                            <span style={{ fontFamily: SANS, fontSize: 12, fontWeight: 650, color: RIR[c].c }}>{RIR[c].label}</span>
                            <span style={{ fontFamily: MONO, fontSize: 8.5, color: RIR[c].c, opacity: .85 }}>{RIR[c].note}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {si < ex.sets - 1 && <div style={{ height: 1, background: C.lineSoft }} />}
                </div>
              );
            })}
          </Card>
        );
      })}
      <BigButton tone="dark" onClick={() => setPhase("review")}>Finish workout</BigButton>
    </div>
  );
}
const Field = ({ label, val }) => (
  <div style={{ background: C.page, borderRadius: 11, padding: "8px 14px", minWidth: 64, textAlign: "center" }}>
    <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 600, color: C.ink, lineHeight: 1 }}>{val}</div>
    <div style={{ fontFamily: MONO, fontSize: 9, color: C.faint, marginTop: 3 }}>{label}</div>
  </div>
);

/* ================================================================
   PROGRAMS
================================================================ */
function Programs() {
  const [programs, setPrograms] = useState(INITIAL_PROGRAMS);
  const [openId, setOpenId] = useState(null);
  if (openId) {
    const idx = programs.findIndex((p) => p.id === openId);
    return <ProgramDetail program={programs[idx]} onBack={() => setOpenId(null)} onChange={(np) => setPrograms(programs.map((p) => (p.id === openId ? np : p)))} />;
  }
  return (
    <div style={{ padding: "6px 18px 24px" }}>
      <PageTitle sub="Rotation · 3 programs">Programs</PageTitle>
      {programs.map((p, i) => (
        <button key={p.id} onClick={() => setOpenId(p.id)} style={{ display: "block", width: "100%", textAlign: "left", background: C.card, cursor: "pointer", borderRadius: 14, border: `${p.active ? 1.5 : 1}px solid ${p.active ? C.ink : C.line}`, padding: 18, marginBottom: 12, WebkitTapHighlightColor: "transparent" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontFamily: MONO, fontSize: 13, color: p.active ? C.ink : C.faint, fontWeight: 700 }}>{String(i + 1).padStart(2, "0")}</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: SANS, fontSize: 18, fontWeight: 650, color: C.ink }}>{p.name}</span>
                {p.active && <span style={{ fontFamily: MONO, fontSize: 9, background: ACC, color: "#fff", padding: "2px 7px", borderRadius: 5, letterSpacing: .5 }}>ACTIVE</span>}
              </div>
              <div style={{ fontFamily: SANS, fontSize: 12.5, color: C.sub, marginTop: 4 }}>{p.lastRun} · {p.days.length} day{p.days.length !== 1 ? "s" : ""}</div>
            </div>
            <ChevronRight size={20} color={C.faint} />
          </div>
        </button>
      ))}
    </div>
  );
}
function ProgramDetail({ program, onBack, onChange }) {
  const [picker, setPicker] = useState(null);
  const days = program.days;
  const addDay = () => onChange({ ...program, days: [...days, { name: `Day ${String.fromCharCode(65 + days.length)}`, ex: [] }] });
  const removeExercise = (di, exId) => onChange({ ...program, days: days.map((d, i) => i === di ? { ...d, ex: d.ex.filter((e) => e.id !== exId) } : d) });
  const toggleExercise = (di, exId) => {
    const d = days[di]; const has = d.ex.some((e) => e.id === exId);
    onChange({ ...program, days: days.map((x, i) => i === di ? { ...x, ex: has ? x.ex.filter((e) => e.id !== exId) : [...x.ex, { id: exId, sets: 3, last: { w: 0, reps: 10, rir: "amber" } }] } : x) });
  };
  if (picker != null) return <Picker inDay={days[picker].ex.map((e) => e.id)} onToggle={(id) => toggleExercise(picker, id)} onBack={() => setPicker(null)} dayName={days[picker].name} />;
  return (
    <div style={{ padding: "6px 18px 24px" }}>
      <button onClick={onBack} style={backBtn}><ChevronLeft size={20} /> Programs</button>
      <PageTitle sub={program.lastRun}>{program.name}</PageTitle>
      {days.length === 0 && (
        <Card style={{ padding: 26, textAlign: "center", marginBottom: 12 }}>
          <div style={{ fontFamily: SANS, fontSize: 15, fontWeight: 600, color: C.ink }}>No training days yet</div>
          <div style={{ fontFamily: SANS, fontSize: 13, color: C.sub, marginTop: 6 }}>Add a day, then fill it with exercises from your home gym.</div>
        </Card>
      )}
      {days.map((d, di) => (
        <Card key={di} style={{ padding: 16, marginBottom: 12 }}>
          <div style={{ fontFamily: SANS, fontSize: 16, fontWeight: 650, color: C.ink, marginBottom: d.ex.length ? 12 : 8 }}>{d.name}</div>
          {d.ex.map((e) => (
            <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderTop: `1px solid ${C.lineSoft}` }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: SANS, fontSize: 14.5, fontWeight: 550, color: C.ink }}>{exName(e.id)}</div>
                <div style={{ fontFamily: MONO, fontSize: 10, color: C.faint, marginTop: 2 }}>{exMuscle(e.id).toUpperCase()} · {e.sets} SETS</div>
              </div>
              <button onClick={() => removeExercise(di, e.id)} style={{ width: 32, height: 32, borderRadius: 9, border: `1.5px solid ${C.line}`, background: C.card, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", WebkitTapHighlightColor: "transparent" }}><X size={16} color={C.sub} /></button>
            </div>
          ))}
          <button onClick={() => setPicker(di)} style={{ width: "100%", height: 46, borderRadius: 11, border: `1.5px dashed ${C.line}`, background: C.card, color: ACC, fontFamily: SANS, fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: d.ex.length ? 12 : 0, WebkitTapHighlightColor: "transparent" }}><Plus size={16} strokeWidth={2.5} /> Add exercise</button>
        </Card>
      ))}
      <button onClick={addDay} style={{ width: "100%", height: 54, borderRadius: 13, border: "none", background: C.ink, color: "#fff", fontFamily: SANS, fontSize: 15, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4, WebkitTapHighlightColor: "transparent" }}><Plus size={18} strokeWidth={2.5} /> Add training day</button>
    </div>
  );
}
function Picker({ inDay, onToggle, onBack, dayName }) {
  const [q, setQ] = useState("");
  const [equip, setEquip] = useState("All");
  const equips = ["All", "Barbell", "Dumbbell", "Bodyweight", "Kettlebell", "Bands"];
  const filtered = EXERCISE_DB.filter((e) => (equip === "All" || e.equip === equip) && e.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div style={{ padding: "6px 18px 24px" }}>
      <button onClick={onBack} style={backBtn}><ChevronLeft size={20} /> {dayName}</button>
      <PageTitle sub="Home gym library">Add exercise</PageTitle>
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.card, border: `1.5px solid ${C.line}`, borderRadius: 13, padding: "0 14px", height: 54, marginBottom: 12 }}>
        <Search size={18} color={C.faint} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search exercises" style={{ border: "none", outline: "none", fontFamily: SANS, fontSize: 16, flex: 1, color: C.ink, background: "transparent" }} />
        {q && <X size={18} color={C.faint} onClick={() => setQ("")} style={{ cursor: "pointer" }} />}
      </div>
      <div style={{ display: "flex", gap: 7, overflowX: "auto", marginBottom: 16, paddingBottom: 2 }}>
        {equips.map((eq) => (
          <button key={eq} onClick={() => setEquip(eq)} style={{ whiteSpace: "nowrap", padding: "8px 15px", borderRadius: 20, cursor: "pointer", border: `1.5px solid ${equip === eq ? C.ink : C.line}`, background: equip === eq ? C.ink : C.card, color: equip === eq ? "#fff" : C.sub, fontFamily: SANS, fontSize: 13, fontWeight: 550, WebkitTapHighlightColor: "transparent" }}>{eq}</button>
        ))}
      </div>
      {filtered.map((e) => {
        const on = inDay.includes(e.id);
        return (
          <button key={e.id} onClick={() => onToggle(e.id)} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", background: C.card, border: `1px solid ${on ? ACC : C.line}`, borderRadius: 13, padding: "14px 16px", marginBottom: 8, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: SANS, fontSize: 15, fontWeight: 600, color: C.ink }}>{e.name}</div>
              <div style={{ fontFamily: MONO, fontSize: 10, color: C.faint, marginTop: 3 }}>{e.muscle.toUpperCase()} · {e.equip.toUpperCase()}</div>
            </div>
            <div style={{ width: 30, height: 30, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", background: on ? ACC : C.card, border: `1.5px solid ${on ? ACC : C.line}` }}>
              {on ? <Check size={16} color="#fff" strokeWidth={3} /> : <Plus size={16} color={C.faint} />}
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ================================================================
   PROFILE / SETTINGS
================================================================ */
const cmToFtIn = (cm) => { const t = cm / 2.54; const f = Math.floor(t / 12); const i = Math.round(t - f * 12); return `${f}'${i}"`; };

function Profile({ unit, setUnit, heightUnit, setHeightUnit, profile, setProfile }) {
  const set = (k, v) => setProfile({ ...profile, [k]: v });
  const setGoal = (g) => setProfile({ ...profile, goal: g, rateKg: GOAL_RATE[g] });
  const inputStyle = { border: "none", outline: "none", fontFamily: SANS, fontSize: 15, color: C.ink, textAlign: "right", background: "transparent", width: 150 };
  const mag = Math.abs(profile.rateKg);
  const sign = profile.goal === "bulk" ? 1 : -1;
  const setMag = (m) => set("rateKg", +(sign * Math.max(0.1, +m.toFixed(1))).toFixed(1));

  return (
    <div style={{ padding: "6px 18px 24px" }}>
      <PageTitle sub="Account">Profile</PageTitle>

      <Card style={{ padding: 20, marginBottom: 16, display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ width: 60, height: 60, borderRadius: 30, background: C.graphite, color: C.onDark, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SANS, fontSize: 22, fontWeight: 650 }}>
          {profile.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
        </div>
        <div style={{ flex: 1 }}>
          <input value={profile.name} onChange={(e) => set("name", e.target.value)} style={{ ...inputStyle, textAlign: "left", width: "100%", fontSize: 19, fontWeight: 680 }} />
          <div style={{ fontFamily: MONO, fontSize: 12, color: C.sub, marginTop: 2 }}>@{profile.username}</div>
        </div>
      </Card>

      <SectionLabel>Your details</SectionLabel>
      <Card style={{ padding: "4px 16px", marginBottom: 16 }}>
        <Row label="Username"><input value={profile.username} onChange={(e) => set("username", e.target.value)} style={inputStyle} /></Row>
        <Row label="Age"><Stepper value={profile.age} onChange={(v) => set("age", v)} suffix="yrs" /></Row>
        <Row label="Height">{heightUnit === "cm" ? <Stepper value={profile.heightCm} onChange={(v) => set("heightCm", v)} suffix="cm" /> : <span style={{ fontFamily: MONO, fontSize: 15, color: C.ink }}>{cmToFtIn(profile.heightCm)}</span>}</Row>
        <Row label="Goal weight" last><span style={{ fontFamily: MONO, fontSize: 15, color: C.ink }}>{wStr(profile.goalKg, unit)} {unit}</span></Row>
      </Card>

      <SectionLabel>Goal</SectionLabel>
      <Card style={{ padding: "4px 16px", marginBottom: 16 }}>
        <Row label="Current goal" sub="Sets your default weekly target"><div style={{ width: 210 }}><Segmented small options={GOALS} value={profile.goal} onChange={setGoal} /></div></Row>
        <Row label="Weekly weight goal" sub={profile.goal === "bulk" ? "Lean gain" : profile.goal === "shred" ? "Fat loss" : "Stay steady"} last>
          {profile.goal === "maintain"
            ? <span style={{ fontFamily: MONO, fontSize: 15, color: C.ink }}>Maintain</span>
            : <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button onClick={() => setMag(mag - 0.1)} style={miniRound}><Minus size={16} strokeWidth={2.5} /></button>
                <span style={{ fontFamily: MONO, fontSize: 15, color: C.ink, minWidth: 78, textAlign: "center" }}>{sign < 0 ? "−" : "+"}{wStr(mag, unit)} {unit}/wk</span>
                <button onClick={() => setMag(mag + 0.1)} style={miniRound}><Plus size={16} strokeWidth={2.5} /></button>
              </div>}
        </Row>
      </Card>

      <SectionLabel>Units</SectionLabel>
      <Card style={{ padding: "4px 16px", marginBottom: 16 }}>
        <Row label="Weight"><div style={{ width: 132 }}><Segmented small options={[{ v: "kg", l: "kg" }, { v: "lb", l: "lb" }]} value={unit} onChange={setUnit} /></div></Row>
        <Row label="Height" last><div style={{ width: 132 }}><Segmented small options={[{ v: "cm", l: "cm" }, { v: "ft", l: "ft / in" }]} value={heightUnit} onChange={setHeightUnit} /></div></Row>
      </Card>

      <SectionLabel>Preferences</SectionLabel>
      <Card style={{ padding: "4px 16px", marginBottom: 16 }}>
        <Row label="Workout reminders" sub="Daily push notification"><Switch on={profile.notifications} onToggle={() => set("notifications", !profile.notifications)} /></Row>
        <Row label="Sync with Health app" sub="Apple Health / Health Connect" last><Switch on={profile.healthSync} onToggle={() => set("healthSync", !profile.healthSync)} /></Row>
      </Card>

      <SectionLabel>About</SectionLabel>
      <Card style={{ padding: "4px 16px" }}>
        <Row label="Version"><span style={{ fontFamily: MONO, fontSize: 14, color: C.sub }}>0.4.0 · prototype</span></Row>
        <Row label="Sign out" last><ChevronRight size={18} color={C.faint} /></Row>
      </Card>
    </div>
  );
}
const SectionLabel = ({ children }) => (
  <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: 1.5, textTransform: "uppercase", color: C.faint, fontWeight: 500, margin: "0 4px 8px" }}>{children}</div>
);
const Row = ({ label, sub, children, last }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderBottom: last ? "none" : `1px solid ${C.lineSoft}`, minHeight: 30 }}>
    <div><div style={{ fontFamily: SANS, fontSize: 15, color: C.ink, fontWeight: 500 }}>{label}</div>{sub && <div style={{ fontFamily: SANS, fontSize: 12, color: C.sub, marginTop: 2 }}>{sub}</div>}</div>
    <div>{children}</div>
  </div>
);
const Stepper = ({ value, onChange, step = 1, suffix }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
    <button onClick={() => onChange(value - step)} style={miniRound}><Minus size={16} strokeWidth={2.5} /></button>
    <span style={{ fontFamily: MONO, fontSize: 15, color: C.ink, minWidth: 54, textAlign: "center" }}>{value}{suffix ? ` ${suffix}` : ""}</span>
    <button onClick={() => onChange(value + step)} style={miniRound}><Plus size={16} strokeWidth={2.5} /></button>
  </div>
);
const miniRound = { width: 32, height: 32, borderRadius: 9, border: `1.5px solid ${C.line}`, background: C.card, color: C.ink, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", WebkitTapHighlightColor: "transparent" };

/* ================================================================
   APP SHELL
================================================================ */
export default function App() {
  const [tab, setTab] = useState("home");
  const [unit, setUnit] = useState("kg");
  const [heightUnit, setHeightUnit] = useState("cm");
  const [profile, setProfile] = useState({
    name: "Alex Carter", username: "alexc", age: 31, heightCm: 180, goalKg: 78,
    goal: "shred", rateKg: -0.5, notifications: true, healthSync: false,
  });
  const tabs = [
    { id: "home", icon: Home, label: "Dashboard" },
    { id: "train", icon: Dumbbell, label: "Train" },
    { id: "programs", icon: Layers, label: "Programs" },
    { id: "profile", icon: User, label: "Profile" },
  ];
  return (
    <div style={{ minHeight: "100vh", background: C.page, display: "flex", justifyContent: "center", fontFamily: SANS }}>
      <div style={{ width: "100%", maxWidth: 430, background: C.page, position: "relative", paddingBottom: 96, minHeight: "100vh" }}>
        <div style={{ paddingTop: 14 }}>
          {tab === "home" && <Dashboard unit={unit} />}
          {tab === "train" && <Train unit={unit} />}
          {tab === "programs" && <Programs />}
          {tab === "profile" && <Profile unit={unit} setUnit={setUnit} heightUnit={heightUnit} setHeightUnit={setHeightUnit} profile={profile} setProfile={setProfile} />}
        </div>
        <div style={{ position: "fixed", bottom: 0, width: "100%", maxWidth: 430, background: "rgba(255,255,255,0.92)", backdropFilter: "blur(12px)", borderTop: `1px solid ${C.line}`, display: "flex", padding: "8px 8px 22px" }}>
          {tabs.map((t) => {
            const on = tab === t.id, Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "8px 0", WebkitTapHighlightColor: "transparent" }}>
                <Icon size={23} color={on ? ACC : C.faint} strokeWidth={on ? 2.4 : 2} />
                <span style={{ fontFamily: SANS, fontSize: 11, fontWeight: on ? 650 : 500, color: on ? C.ink : C.faint }}>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
