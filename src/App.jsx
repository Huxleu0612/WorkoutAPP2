import React, { useState, useEffect, useRef, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from "recharts";
import {
  Home, Dumbbell, Layers, User, Plus, Minus, Check, ChevronLeft, ChevronRight,
  Search, X, TrendingDown, ArrowUp, ArrowRight, ArrowDown, Zap, Activity, Moon,
  Play, Pause, Square, Trash2, RotateCcw, BarChart3, Clock, Pencil, Target, Calendar,
  Info, Calculator, Settings2, Sparkles,
} from "lucide-react";
import EXERCISES_DATA from "./data/exercises.json";
import { PROGRAM_CATALOG } from "./data/programCatalog";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS as DndCSS } from "@dnd-kit/utilities";
import { progressionOf } from "./lib/progression";
import { calcPlateLoad, DEFAULT_EQUIPMENT } from "./lib/plates";

/* ===== TOKENS ===== */
const C = {
  page: "#EEF0F3", card: "#FFFFFF", ink: "#12141A", sub: "#6B7280", faint: "#A0A5AE",
  line: "#E2E5EA", lineSoft: "#EDEFF2", graphite: "#14161C", graphite2: "#1D2028",
  onDark: "#F4F6FA", onDarkSub: "#9AA0AC", onDarkLine: "#2A2E37",
  green: "#12A150", amber: "#E08600", red: "#E5484D",
  greenBg: "#E7F5EC", amberBg: "#FBF0DE", redBg: "#FBE9E9",
};
const ACC = "#2F6BFF", ACC_BG = "#E9F0FF";
const AI_ACC = "#7C3AED", AI_BG = "#F1EBFF", AI_BORDER = "#DDD0FF";
const MONO = "'SF Mono','JetBrains Mono','Roboto Mono',ui-monospace,monospace";
const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,system-ui,sans-serif";
const VER = 6;

/* ===== persistence ===== */
const loadLS = (k, fb) => { try { const v = localStorage.getItem(k); return v != null ? JSON.parse(v) : fb; } catch { return fb; } };
const saveLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
function usePersist(key, initial) {
  const [s, setS] = useState(() => loadLS(key, initial));
  useEffect(() => { saveLS(key, s); }, [key, s]);
  return [s, setS];
}

/* ===== units ===== */
const KG_TO_LB = 2.20462;
const fmtW = (kg, u) => (u === "lb" ? kg * KG_TO_LB : kg);
const wStr = (kg, u) => fmtW(kg, u).toFixed(1);
const commas = (n) => Math.round(n).toLocaleString();

/* ===== dates (device-local = user's timezone) ===== */
const DAYMS = 86400000;
const startOfDay = (d) => { const z = new Date(d); z.setHours(0, 0, 0, 0); return z; };
const ymd = (d) => { const z = startOfDay(d); return `${z.getFullYear()}-${String(z.getMonth() + 1).padStart(2, "0")}-${String(z.getDate()).padStart(2, "0")}`; };
const mondayOf = (d) => { const z = startOfDay(d); const g = z.getDay(); z.setDate(z.getDate() + (g === 0 ? -6 : 1 - g)); return z; };
const addDays = (d, n) => { const z = new Date(d); z.setDate(z.getDate() + n); return z; };
const sameDay = (a, b) => ymd(a) === ymd(b);
const WD_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WD_LETTER = ["S", "M", "T", "W", "T", "F", "S"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const ageFrom = (iso) => { if (!iso) return "—"; const b = new Date(iso); const t = new Date(); let a = t.getFullYear() - b.getFullYear(); const m = t.getMonth() - b.getMonth(); if (m < 0 || (m === 0 && t.getDate() < b.getDate())) a--; return a; };
const fmtDate = (iso) => { if (!iso) return "—"; const d = new Date(iso); return `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`; };
const DEFAULT_DAYS = { 1: [1], 2: [1, 4], 3: [1, 3, 5], 4: [1, 2, 4, 6], 5: [1, 2, 3, 4, 5], 6: [1, 2, 3, 4, 5, 6], 7: [0, 1, 2, 3, 4, 5, 6] };

/* ===== goal (evidence-based) ===== */
const DEFAULT_RATE = { shred: 0.5, bulk: 0.25, maintain: 0 };
const GOAL_WORD = { shred: "Fat loss", bulk: "Lean bulk", maintain: "Maintain" };

const STYLE_INFO = {
  strength: { title: "Strength", reps: "3–6 reps · heavy · long rest", what: "Heavy loads (around 85%+ of your max) for low reps with full rest between sets. It trains your nervous system to produce maximal force.", best: "Getting stronger and lifting heavier on the big compound lifts.", tradeoff: "Less muscle-size stimulus per session, and it's demanding on joints and your nervous system, so it needs more recovery." },
  hypertrophy: { title: "Hypertrophy", reps: "8–12 reps · moderate · short rest", what: "Moderate loads for moderate-to-high reps with shorter rest and more total sets. It maximises muscle growth by piling up quality volume.", best: "Building visible muscle size and shape.", tradeoff: "Less focus on peak strength, and the higher volume is more fatiguing to grind through." },
  conditioning: { title: "Conditioning", reps: "circuits · light · minimal rest", what: "Lighter loads run as circuits with high reps and little rest, keeping your heart rate up throughout.", best: "Work capacity, endurance, and burning more calories per session.", tradeoff: "Limited gains in maximal strength or muscle size compared with the other two." },
  custom: { title: "Custom program", reps: "your own mix", what: "A program you build yourself — pick the days, exercises and sets that suit you.", best: "Whatever goal you design it around.", tradeoff: "You decide the trade-offs." },
};
function deriveGoal(profile, curKg) {
  const cur = curKg ?? profile.currentKg ?? profile.goalKg ?? 0;
  const goal = profile.goalKg ?? cur;
  const diff = goal - cur;
  const type = Math.abs(diff) < 1 ? "maintain" : diff < 0 ? "shred" : "bulk";
  const mag = profile.rateMag != null ? profile.rateMag : DEFAULT_RATE[type];
  const weeklyRate = type === "maintain" ? 0 : type === "shred" ? -Math.abs(mag) : Math.abs(mag);
  return { type, mag, weeklyRate, cur, goal };
}

/* ===== progression logic lives in ./lib/progression.js (progressionOf(program)) ===== */

/* ===== exercises + default programs (no seeded history) ===== */
const EXERCISE_DB = EXERCISES_DATA;
const EXERCISE_MAP = new Map(EXERCISE_DB.map((e) => [e.id, e]));
const EQUIP_OPTIONS = ["All", ...Array.from(new Set(EXERCISE_DB.map((e) => e.equipment))).sort()];
const cap = (s) => (s || "").replace(/\b\w/g, (c) => c.toUpperCase());
const exName = (id) => EXERCISE_MAP.get(id)?.name || id;
const exMuscle = (id) => EXERCISE_MAP.get(id)?.bodyPart || "";
const isBW = (id) => EXERCISE_MAP.get(id)?.equipment === "body weight";
const exFull = (id) => EXERCISE_MAP.get(id);
const setCount = (exx) => (typeof exx.sets === "number" ? exx.sets : exx.sets.length);
const dayIdCache = new WeakMap();
let dayIdSeq = 0;
const dayKey = (d) => { if (!dayIdCache.has(d)) dayIdCache.set(d, `day-${dayIdSeq++}`); return dayIdCache.get(d); };
const exIdCache = new WeakMap();
let exIdSeq = 0;
const exKey = (e) => { if (!exIdCache.has(e)) exIdCache.set(e, `ex-${exIdSeq++}`); return exIdCache.get(e); };
const N = (sets) => ({ id: null, sets, last: { w: 0, reps: 10, rir: "amber", logged: false } });
const ex = (id, sets, cfg) => ({ ...N(sets), id, ...cfg });

const RIR = { green: { c: C.green, bg: C.greenBg, label: "Easy", note: "3+ reps left" }, amber: { c: C.amber, bg: C.amberBg, label: "Working", note: "1–2 reps left" }, red: { c: C.red, bg: C.redBg, label: "Max", note: "0 reps left" } };
const HITMISS = { hit: { c: C.green, bg: C.greenBg, label: "Hit", note: "Made the target reps" }, miss: { c: C.red, bg: C.redBg, label: "Miss", note: "Under the target" } };
const ratingTable = (kind) => (kind === "hitmiss" ? HITMISS : RIR);
const READINESS = [{ v: "energized", label: "Energized", Icon: Zap }, { v: "normal", label: "Normal", Icon: Activity }, { v: "tired", label: "Tired", Icon: Moon }];

/* ===== program helpers (pause-aware) ===== */
const activeProgram = (ps) => ps.find((p) => p.active) || null;
const isPaused = (p) => !!(p && p.active && p.pausedAt);
const effMs = (p) => { if (!p || !p.startedAt) return 0; const now = Date.now(); const paused = (p.pausedMs || 0) + (p.pausedAt ? now - new Date(p.pausedAt).getTime() : 0); return Math.max(0, now - new Date(p.startedAt).getTime() - paused); };
const effWeeks = (p) => effMs(p) / (7 * DAYMS);
const programWeek = (p) => Math.min(p?.weeks || 12, Math.floor(effWeeks(p)) + 1);
const durStr = (p) => { const d = Math.floor(effMs(p) / DAYMS); const w = Math.floor(d / 7), rd = d % 7; if (d < 7) return `${d} day${d !== 1 ? "s" : ""}`; return `${w} week${w !== 1 ? "s" : ""}${rd ? ` ${rd}d` : ""}`; };
const sessionsFor = (h, pid) => h.filter((x) => x.programId === pid);
const nextDayIndex = (h, p) => { if (!p || !p.days.length) return 0; return sessionsFor(h, p.id).length % p.days.length; };
const lastWeight = (wl) => { const ks = Object.keys(wl).sort(); return ks.length ? wl[ks[ks.length - 1]] : null; };

const WLETTER = ["A", "B", "C", "D", "E", "F", "G", "H"];
const wLabel = (i) => "Workout " + (WLETTER[i] || i + 1);
const monFirst = (d) => (d === 0 ? 6 : d - 1);
function assignedIdx(program, date) {
  if (!program || !program.days.length || !(program.scheduleDays || []).length) return null;
  const dow = date.getDay();
  if (!program.scheduleDays.includes(dow)) return null;
  const sorted = [...program.scheduleDays].sort((a, b) => monFirst(a) - monFirst(b));
  return sorted.indexOf(dow) % program.days.length;
}
const weekKeysOf = (d) => { const m = mondayOf(d); return Array.from({ length: 7 }).map((_, i) => ymd(addDays(m, i))); };
const matchesWorkout = (h, ai) => (h.dayIdx != null ? h.dayIdx === ai : h.dayName === wLabel(ai));
function sessionForWorkout(history, program, date, ai) {
  if (!program || ai == null) return null;
  const keys = weekKeysOf(date);
  return history.find((h) => h.programId === program.id && keys.includes(h.date) && matchesWorkout(h, ai)) || null;
}
// how many scheduled sessions should have happened by today (pause-aware)
function scheduledSoFar(p) {
  if (!p || !p.startedAt || !(p.scheduleDays || []).length) return 0;
  const start = startOfDay(new Date(p.startedAt));
  const today = startOfDay(new Date());
  let n = 0, guard = 0;
  for (let d = new Date(start); d <= today && guard < 2000; d = addDays(d, 1), guard++) if (p.scheduleDays.includes(d.getDay())) n++;
  const pausedWeeks = ((p.pausedMs || 0) + (p.pausedAt ? Date.now() - new Date(p.pausedAt).getTime() : 0)) / (7 * DAYMS);
  return Math.max(0, n - Math.round(pausedWeeks * p.scheduleDays.length));
}

/* ================================================================
   SHARED UI
================================================================ */
const Card = ({ children, style }) => <div style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.line}`, ...style }}>{children}</div>;
const Eyebrow = ({ children, dark }) => <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: 1.6, textTransform: "uppercase", color: dark ? C.onDarkSub : C.faint, fontWeight: 500 }}>{children}</div>;
const PageTitle = ({ children, sub }) => (<>{sub && <Eyebrow>{sub}</Eyebrow>}<h1 style={{ fontFamily: SANS, fontSize: 30, fontWeight: 700, color: C.ink, margin: "4px 0 20px", letterSpacing: -0.7 }}>{children}</h1></>);
const SectionLabel = ({ children, icon }) => <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: 1.5, textTransform: "uppercase", color: C.faint, fontWeight: 500, margin: "0 4px 8px", display: "flex", alignItems: "center", gap: 6 }}>{icon}{children}</div>;
const BigButton = ({ children, onClick, tone = "acc", disabled }) => {
  const map = { acc: [ACC, "#fff"], dark: [C.ink, "#fff"], done: [C.greenBg, C.green], ghost: [C.card, C.ink] };
  let [bg, col] = map[tone]; if (disabled) { bg = C.line; col = C.faint; }
  return <button onClick={disabled ? undefined : onClick} style={{ width: "100%", height: 56, borderRadius: 13, border: tone === "ghost" ? `1.5px solid ${C.line}` : "none", cursor: disabled ? "default" : "pointer", background: bg, color: col, fontFamily: SANS, fontSize: 15.5, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, WebkitTapHighlightColor: "transparent" }}>{tone === "done" && <Check size={18} strokeWidth={3} />}{children}</button>;
};
const Segmented = ({ options, value, onChange, small }) => (
  <div style={{ display: "flex", background: C.lineSoft, borderRadius: 11, padding: 3, gap: 3 }}>
    {options.map((o) => { const v = o.v ?? o, on = value === v; return (
      <button key={v} onClick={() => onChange(v)} style={{ flex: 1, height: small ? 32 : 38, border: "none", borderRadius: 8, cursor: "pointer", background: on ? C.card : "transparent", color: on ? C.ink : C.sub, fontFamily: SANS, fontSize: small ? 12 : 13.5, fontWeight: 600, boxShadow: on ? "0 1px 2px rgba(0,0,0,.07)" : "none", WebkitTapHighlightColor: "transparent" }}>{o.l ?? o}</button>); })}
  </div>
);
const Switch = ({ on, onToggle }) => (<button onClick={onToggle} style={{ width: 48, height: 29, borderRadius: 15, border: "none", cursor: "pointer", background: on ? ACC : C.line, position: "relative", transition: "background .15s", WebkitTapHighlightColor: "transparent" }}><div style={{ position: "absolute", top: 3, left: on ? 22 : 3, width: 23, height: 23, borderRadius: 12, background: "#fff", transition: "left .15s", boxShadow: "0 1px 2px rgba(0,0,0,.2)" }} /></button>);
const miniRound = { width: 34, height: 34, borderRadius: 9, border: `1.5px solid ${C.line}`, background: C.card, color: C.ink, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", WebkitTapHighlightColor: "transparent", flexShrink: 0 };
const MiniStep = ({ onClick, children }) => <button onClick={onClick} style={miniRound}>{children}</button>;
const stepBtn = { width: 64, height: 64, borderRadius: 16, border: `1.5px solid ${C.line}`, background: C.card, color: C.ink, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", WebkitTapHighlightColor: "transparent" };
const backBtn = { display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: C.sub, fontFamily: SANS, fontSize: 15, cursor: "pointer", padding: "6px 0", marginBottom: 6, WebkitTapHighlightColor: "transparent" };
const pill = { display: "flex", alignItems: "center", gap: 6, background: C.page, borderRadius: 9, padding: "7px 11px" };
const Row = ({ label, sub, children, last }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderBottom: last ? "none" : `1px solid ${C.lineSoft}`, minHeight: 30, gap: 12 }}>
    <div><div style={{ fontFamily: SANS, fontSize: 15, color: C.ink, fontWeight: 500 }}>{label}</div>{sub && <div style={{ fontFamily: SANS, fontSize: 12, color: C.sub, marginTop: 2 }}>{sub}</div>}</div><div>{children}</div></div>
);
function Dial({ pct, size = 92, stroke = 9 }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, off = c * (1 - pct / 100);
  return (<div style={{ position: "relative", width: size, height: size }}>
    <svg width={size} height={size}><circle cx={size / 2} cy={size / 2} r={r} stroke={C.onDarkLine} strokeWidth={stroke} fill="none" /><circle cx={size / 2} cy={size / 2} r={r} stroke={ACC} strokeWidth={stroke} fill="none" strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} /></svg>
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}><span style={{ fontFamily: MONO, fontSize: 22, fontWeight: 600, color: C.onDark, lineHeight: 1 }}>{pct}</span><span style={{ fontFamily: MONO, fontSize: 10, color: C.onDarkSub }}>%</span></div></div>);
}
function EditableNumber({ initial, onCommit, suffix, width = 66 }) {
  const [s, setS] = useState(initial);
  useEffect(() => { setS(initial); }, [initial]);
  return (<div style={pill}>
    <input inputMode="decimal" value={s} onChange={(e) => setS(e.target.value)} onBlur={() => onCommit(s)} style={{ border: "none", outline: "none", background: "transparent", fontFamily: MONO, fontSize: 15, color: C.ink, textAlign: "right", width }} />
    {suffix && <span style={{ fontFamily: MONO, fontSize: 12, color: C.sub }}>{suffix}</span>}<Pencil size={12} color={C.faint} /></div>);
}
function DOBPicker({ value, onChange }) {
  const d = value ? new Date(value) : null;
  const [day, setDay] = useState(d ? d.getDate() : "");
  const [mon, setMon] = useState(d ? d.getMonth() : "");
  const [yr, setYr] = useState(d ? d.getFullYear() : "");
  const emit = (dd, mm, yy) => { if (dd && mm !== "" && yy) onChange(`${yy}-${String(+mm + 1).padStart(2, "0")}-${String(dd).padStart(2, "0")}`); };
  const now = new Date().getFullYear();
  const years = []; for (let y = now - 13; y >= now - 100; y--) years.push(y);
  const sel = { flex: 1, height: 52, borderRadius: 12, border: `1.5px solid ${C.line}`, background: C.card, padding: "0 10px", fontFamily: SANS, fontSize: 15, color: C.ink, outline: "none", WebkitAppearance: "none", appearance: "none" };
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <select style={sel} value={day} onChange={(e) => { setDay(e.target.value); emit(e.target.value, mon, yr); }}><option value="">Day</option>{Array.from({ length: 31 }).map((_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}</select>
      <select style={{ ...sel, flex: 1.3 }} value={mon} onChange={(e) => { setMon(e.target.value); emit(day, e.target.value, yr); }}><option value="">Month</option>{MON.map((m, i) => <option key={i} value={i}>{m}</option>)}</select>
      <select style={sel} value={yr} onChange={(e) => { setYr(e.target.value); emit(day, mon, e.target.value); }}><option value="">Year</option>{years.map((y) => <option key={y} value={y}>{y}</option>)}</select>
    </div>
  );
}
function SlideConfirm({ label, color = C.red, onConfirm }) {
  const trackRef = useRef(null), posRef = useRef(0);
  const [x, setX] = useState(0), [confd, setConfd] = useState(false);
  const KNOB = 52, PAD = 4;
  const onDown = () => {
    if (confd) return;
    const move = (ev) => { const cx = ev.clientX ?? (ev.touches && ev.touches[0].clientX); if (cx == null || !trackRef.current) return; const r = trackRef.current.getBoundingClientRect(); const max = r.width - KNOB - PAD * 2; let nx = Math.max(0, Math.min(cx - r.left - KNOB / 2, max)); posRef.current = nx; setX(nx); };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); const r = trackRef.current?.getBoundingClientRect(); const max = r ? r.width - KNOB - PAD * 2 : 0; if (posRef.current >= max - 8) { setX(max); setConfd(true); setTimeout(onConfirm, 160); } else { posRef.current = 0; setX(0); } };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };
  return (
    <div ref={trackRef} style={{ position: "relative", height: 58, borderRadius: 13, background: C.page, border: `1px solid ${C.line}`, overflow: "hidden", userSelect: "none", touchAction: "none" }}>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SANS, fontSize: 14, fontWeight: 600, color: confd ? color : C.faint }}>{confd ? "Confirmed ✓" : label}</div>
      <div onPointerDown={onDown} style={{ position: "absolute", top: PAD, left: PAD, transform: `translateX(${x}px)`, width: KNOB, height: 58 - PAD * 2, borderRadius: 10, background: color, display: "flex", alignItems: "center", justifyContent: "center", cursor: "grab", touchAction: "none" }}><ChevronRight size={22} color="#fff" strokeWidth={2.6} /></div>
    </div>
  );
}
function ConfirmPanel({ title, body, slideLabel, color = C.red, onConfirm, onCancel }) {
  return (
    <Card style={{ padding: 18, marginBottom: 12, borderColor: color }}>
      <div style={{ fontFamily: SANS, fontSize: 15, fontWeight: 700, color: C.ink }}>{title}</div>
      <div style={{ fontFamily: SANS, fontSize: 13, color: C.sub, margin: "6px 0 14px", lineHeight: 1.5 }}>{body}</div>
      <SlideConfirm label={slideLabel} color={color} onConfirm={onConfirm} />
      <button onClick={onCancel} style={{ width: "100%", height: 44, marginTop: 8, borderRadius: 11, border: "none", background: "transparent", color: C.sub, fontFamily: SANS, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
    </Card>
  );
}

function Sortable({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div ref={setNodeRef} style={{ transform: DndCSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}>
      {children({ attributes, listeners, isDragging })}
    </div>
  );
}
/* Swipe right to delete, press and hold to reorder — raced from the same touchdown,
   tuned against real gesture-design references rather than guessed:
     - long-press activation is 500ms (the iOS/Android standard for a "long tap"),
       with a 15px tolerance since a still finger naturally drifts a little over
       half a second — a deliberate swipe covers far more distance far faster and
       won't survive that window, so the two gestures don't fight for the touch.
     - once axis intent is decided, off-axis drift is forgiven up to 1/3 of the
       horizontal distance travelled (not a one-shot lock) before it's treated as
       "not a clean swipe anymore" and springs back — closer to how production
       gesture libraries (e.g. use-gesture) keep re-evaluating axis intent rather
       than freezing a decision from the first few pixels.
     - the rubber-band past the reveal cap uses a 0.15 elasticity coefficient,
       a widely-used default for this kind of resistance curve.
   `hint` plays a one-shot peek shortly after mount so first-time users see the reveal. */
function SwipeToDelete({ onDelete, disabled, hint, radius = 0, dragProps, children }) {
  const [dragX, setDragX] = useState(0);
  const [lifted, setLifted] = useState(false);
  const dragXRef = useRef(0);
  const rowRef = useRef(null);
  const gesture = useRef({ active: false, x: 0, y: 0, pointerId: null, locked: null });
  const hinted = useRef(false);
  const HALF = 60;
  const CAP = 130;

  const applyDragX = (v) => { dragXRef.current = v; setDragX(v); };

  useEffect(() => {
    if (disabled) { gesture.current.active = false; applyDragX(0); }
  }, [disabled]);

  useEffect(() => {
    if (!hint || hinted.current) return;
    hinted.current = true;
    const timers = [
      setTimeout(() => setLifted(true), 500),
      setTimeout(() => setLifted(false), 820),
      setTimeout(() => applyDragX(HALF + 14), 900),
      setTimeout(() => applyDragX(0), 1900),
    ];
    return () => timers.forEach(clearTimeout);
  }, [hint]);

  const finish = (commit) => {
    gesture.current.active = false;
    if (commit) { applyDragX(Math.max(640, window.innerWidth)); setTimeout(onDelete, 340); }
    else applyDragX(0);
  };

  const onPointerDown = (e) => {
    try { dragProps?.onPointerDown?.(e); } catch { /* dnd-kit's own long-press activation timer, not ours */ }
    if (disabled) return;
    e.stopPropagation();
    gesture.current = { active: true, x: e.clientX, y: e.clientY, pointerId: e.pointerId, locked: null };
  };
  const onPointerMove = (e) => {
    const g = gesture.current;
    if (!g.active) return;
    e.stopPropagation();
    const dx = e.clientX - g.x, dy = e.clientY - g.y;
    if (g.locked === null) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      g.locked = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
      if (g.locked !== "x") { g.active = false; return; } // vertical-first = page scroll, not ours
      try { rowRef.current?.setPointerCapture(g.pointerId); } catch { /* synthetic/edge-case pointer session, harmless */ }
    }
    // forgiving axis re-check: only bail on real diagonal drift, not a one-shot lock
    if (Math.abs(dy) > Math.abs(dx) / 3 + 10) { g.active = false; applyDragX(0); return; }
    e.preventDefault?.();
    applyDragX(dx <= 0 ? 0 : dx > CAP ? CAP + (dx - CAP) * 0.15 : dx);
  };
  const onPointerUp = (e) => {
    const g = gesture.current;
    if (!g.active) return;
    e.stopPropagation();
    finish(dragXRef.current >= HALF);
  };
  const onPointerCancel = (e) => {
    const g = gesture.current;
    if (!g.active) return;
    e.stopPropagation();
    finish(false); // a cancel is the browser/OS interrupting the touch, never a deliberate commit
  };

  const past = dragX >= HALF;
  return (
    <div style={{ position: "relative", overflow: "hidden", borderRadius: radius }}>
      <div style={{ position: "absolute", inset: 0, background: C.red, display: "flex", alignItems: "center", gap: 8, paddingLeft: 22, opacity: Math.min(1, dragX / HALF) }}>
        <Trash2 size={17} color="#fff" strokeWidth={2.2} />
        {past && <span style={{ fontFamily: SANS, fontSize: 13, fontWeight: 700, color: "#fff" }}>Delete</span>}
      </div>
      <div
        ref={rowRef}
        {...dragProps?.attributes}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        style={{
          position: "relative",
          zIndex: 1,
          touchAction: "pan-y",
          transform: `translateX(${dragX}px)${lifted ? " scale(1.015)" : ""}`,
          boxShadow: lifted ? "0 6px 16px rgba(20,20,30,0.14)" : "none",
          transition: gesture.current.active ? "none" : "transform 380ms cubic-bezier(.16,1,.3,1), box-shadow 380ms ease",
        }}
      >
        {children}
      </div>
    </div>
  );
}
function InfoModal({ styleKey, onClose }) {
  const info = STYLE_INFO[styleKey] || STYLE_INFO.custom;
  const L = ({ children }) => <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 1.2, color: C.faint, marginBottom: 5 }}>{children}</div>;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(10,12,16,0.55)", zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 430, background: C.card, borderRadius: "20px 20px 0 0", padding: "18px 20px 34px", maxHeight: "82vh", overflowY: "auto" }}>
        <div style={{ width: 38, height: 4, borderRadius: 2, background: C.line, margin: "0 auto 16px" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ fontFamily: SANS, fontSize: 22, fontWeight: 720, color: C.ink, margin: 0 }}>{info.title}</h2>
          <button onClick={onClose} style={miniRound}><X size={18} /></button>
        </div>
        <div style={{ fontFamily: MONO, fontSize: 11, color: ACC, letterSpacing: .4, marginTop: 6 }}>{info.reps.toUpperCase()}</div>
        <p style={{ fontFamily: SANS, fontSize: 14.5, color: C.ink, lineHeight: 1.55, margin: "14px 0 16px" }}>{info.what}</p>
        <div style={{ marginBottom: 14 }}><L>BEST FOR</L><div style={{ fontFamily: SANS, fontSize: 14, color: C.ink, lineHeight: 1.45 }}>{info.best}</div></div>
        <div style={{ marginBottom: 4 }}><L>TRADE-OFF</L><div style={{ fontFamily: SANS, fontSize: 14, color: C.sub, lineHeight: 1.45 }}>{info.tradeoff}</div></div>
        <div style={{ marginTop: 16, padding: 14, background: C.page, borderRadius: 12, fontFamily: SANS, fontSize: 12.5, color: C.sub, lineHeight: 1.55 }}>
          <b style={{ color: C.ink }}>Quick compare:</b> Strength = heavier weight, fewer reps, for force. Hypertrophy = moderate weight, more volume, for size. Conditioning = light and fast, for endurance and calorie burn.
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   ONBOARDING
================================================================ */
function Onboarding({ onDone }) {
  const [f, setF] = useState({ name: "", birthDate: "", unit: "kg", height: "175", current: "80", goal: "75" });
  const [pace, setPace] = useState("steady");
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const hUnit = f.unit === "lb" ? "" : "cm"; // height stays cm for simplicity
  const num = (s) => parseFloat(s);
  const ready = f.name.trim() && f.birthDate && num(f.height) > 0 && num(f.current) > 0 && num(f.goal) > 0;
  const inp = { width: "100%", height: 52, borderRadius: 12, border: `1.5px solid ${C.line}`, background: C.card, padding: "0 14px", fontFamily: SANS, fontSize: 16, color: C.ink, outline: "none" };
  const lab = { fontFamily: SANS, fontSize: 13, fontWeight: 600, color: C.ink, margin: "0 0 7px 2px", display: "block" };
  const toKg = (s) => (f.unit === "lb" ? num(s) / KG_TO_LB : num(s));
  return (
    <div style={{ minHeight: "100vh", background: C.page, display: "flex", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 430, padding: "40px 20px 60px" }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: C.graphite, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18 }}><Dumbbell size={26} color={ACC} /></div>
        <h1 style={{ fontFamily: SANS, fontSize: 27, fontWeight: 720, color: C.ink, margin: "0 0 6px", letterSpacing: -0.6 }}>Welcome</h1>
        <p style={{ fontFamily: SANS, fontSize: 14.5, color: C.sub, margin: "0 0 26px", lineHeight: 1.5 }}>A few details to set up your training. You can change all of these later in Profile.</p>

        <label style={lab}>Your name</label>
        <input style={inp} value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Sam" />
        <div style={{ height: 16 }} />
        <label style={lab}>Date of birth <span style={{ color: C.faint, fontWeight: 400 }}>· sets your age</span></label>
        <DOBPicker value={f.birthDate} onChange={(v) => set("birthDate", v)} />
        <div style={{ height: 16 }} />
        <label style={lab}>Height (cm)</label>
        <input style={inp} inputMode="decimal" value={f.height} onChange={(e) => set("height", e.target.value)} placeholder="175" />
        <div style={{ height: 16 }} />
        <label style={lab}>Weight units</label>
        <Segmented options={[{ v: "kg", l: "Kilograms" }, { v: "lb", l: "Pounds" }]} value={f.unit} onChange={(v) => set("unit", v)} />
        <div style={{ height: 16 }} />
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}><label style={lab}>Current ({f.unit})</label><input style={{ ...inp, textAlign: "center" }} inputMode="decimal" value={f.current} onChange={(e) => set("current", e.target.value)} /></div>
          <div style={{ flex: 1 }}><label style={lab}>Goal ({f.unit})</label><input style={{ ...inp, textAlign: "center" }} inputMode="decimal" value={f.goal} onChange={(e) => set("goal", e.target.value)} /></div>
        </div>
        {ready && (() => {
          const g = deriveGoal({ currentKg: toKg(f.current), goalKg: toKg(f.goal) }, toKg(f.current));
          if (g.type === "maintain") return (<div style={{ marginTop: 16, padding: "12px 14px", background: ACC_BG, borderRadius: 11, fontFamily: SANS, fontSize: 13, color: C.ink }}><b>Maintain</b> — we'll keep your weight steady and use it as your goal line.</div>);
          const opts = [{ k: "steady", rate: 0.25, name: "Steady", d: g.type === "shred" ? "Sustainable, protects muscle" : "Lean, minimal fat gain" }, { k: "aggressive", rate: 0.5, name: "Aggressive", d: g.type === "shred" ? "Faster, tougher to sustain" : "Quicker, more fat gain" }];
          return (
            <div style={{ marginTop: 18 }}>
              <label style={lab}><b>{GOAL_WORD[g.type]}</b> — how fast?</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {opts.map((o) => { const on = pace === o.k; return (
                  <button key={o.k} onClick={() => setPace(o.k)} style={{ textAlign: "left", padding: "13px 14px", borderRadius: 13, cursor: "pointer", border: `1.5px solid ${on ? ACC : C.line}`, background: on ? ACC_BG : C.card, WebkitTapHighlightColor: "transparent" }}>
                    <div style={{ fontFamily: SANS, fontSize: 15, fontWeight: 700, color: on ? ACC : C.ink }}>{o.name}</div>
                    <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 600, color: C.ink, marginTop: 4 }}>{g.type === "shred" ? "−" : "+"}{wStr(o.rate, f.unit)} {f.unit}<span style={{ color: C.faint }}>/wk</span></div>
                    <div style={{ fontFamily: SANS, fontSize: 11.5, color: C.sub, marginTop: 5, lineHeight: 1.35 }}>{o.d}</div>
                  </button>); })}
              </div>
            </div>
          );
        })()}
        <div style={{ height: 26 }} />
        <button disabled={!ready} onClick={() => onDone({
          name: f.name.trim(), username: f.name.trim().toLowerCase().replace(/\s+/g, ""), birthDate: f.birthDate,
          heightCm: Math.round(num(f.height)), heightUnit: "cm", currentKg: toKg(f.current), goalKg: toKg(f.goal),
          unit: f.unit, rateMag: (deriveGoal({ currentKg: toKg(f.current), goalKg: toKg(f.goal) }, toKg(f.current)).type === "maintain" ? 0 : (pace === "steady" ? 0.25 : 0.5)), reminderOn: false, reminderTime: "07:30", onboarded: true, createdAt: new Date().toISOString(),
        })} style={{ width: "100%", height: 58, borderRadius: 13, border: "none", cursor: ready ? "pointer" : "default", background: ready ? ACC : C.line, color: ready ? "#fff" : C.faint, fontFamily: SANS, fontSize: 16, fontWeight: 650, WebkitTapHighlightColor: "transparent" }}>Start training</button>
      </div>
    </div>
  );
}

/* ================================================================
   STATS VIEW
================================================================ */
function StatsView({ sessions, unit, title, sub, onBack }) {
  const allSets = sessions.flatMap((s) => s.sets || []);
  const workouts = sessions.length, sets = allSets.length;
  const volumeKg = allSets.reduce((n, x) => n + (x.w || 0) * (x.reps || 0), 0);
  const byEx = {};
  sessions.slice().sort((a, b) => a.date.localeCompare(b.date)).forEach((s) => (s.sets || []).forEach((x) => { if (x.w == null) return; if (!byEx[x.exId]) byEx[x.exId] = { start: x.w, max: x.w }; byEx[x.exId].max = Math.max(byEx[x.exId].max, x.w); }));
  const lifts = Object.entries(byEx).map(([id, v]) => ({ id, ...v, delta: v.max - v.start })).filter((l) => l.max > 0).sort((a, b) => b.delta - a.delta);
  const prs = lifts.filter((l) => l.delta > 0).length;
  const tiles = [{ k: "Workouts", v: commas(workouts) }, { k: "Total volume", v: commas(fmtW(volumeKg, unit)), u: unit }, { k: "Total sets", v: commas(sets) }, { k: "Personal records", v: commas(prs) }];
  return (
    <div style={{ padding: "6px 18px 24px" }}>
      <button onClick={onBack} style={backBtn}><ChevronLeft size={20} /> Back</button>
      <PageTitle sub={sub}>{title}</PageTitle>
      {workouts === 0 ? (
        <Card style={{ padding: 30, textAlign: "center" }}><div style={{ fontFamily: SANS, fontSize: 16, fontWeight: 650, color: C.ink }}>No sessions logged yet</div><div style={{ fontFamily: SANS, fontSize: 13.5, color: C.sub, marginTop: 6, lineHeight: 1.5 }}>Finish a workout on the Train tab and your stats will start building here.</div></Card>
      ) : (<>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
          {tiles.map((t) => <Card key={t.k} style={{ padding: 16 }}><div style={{ fontFamily: MONO, fontSize: 24, fontWeight: 600, color: C.ink }}>{t.v}{t.u && <span style={{ fontSize: 12, color: C.sub }}> {t.u}</span>}</div><div style={{ fontFamily: SANS, fontSize: 12.5, color: C.sub, marginTop: 4 }}>{t.k}</div></Card>)}
        </div>
        {lifts.length > 0 && <>
          <SectionLabel icon={<BarChart3 size={13} />}>Strength progress</SectionLabel>
          <Card style={{ padding: "6px 16px" }}>
            {lifts.map((l, i) => (
              <div key={l.id} style={{ display: "flex", alignItems: "center", padding: "13px 0", borderBottom: i < lifts.length - 1 ? `1px solid ${C.lineSoft}` : "none" }}>
                <div style={{ flex: 1 }}><div style={{ fontFamily: SANS, fontSize: 14.5, fontWeight: 550, color: C.ink }}>{exName(l.id)}</div><div style={{ fontFamily: MONO, fontSize: 11, color: C.faint, marginTop: 2 }}>{wStr(l.start, unit)} → {wStr(l.max, unit)} {unit}</div></div>
                {l.delta > 0 ? <div style={{ display: "flex", alignItems: "center", gap: 4, background: C.greenBg, borderRadius: 7, padding: "5px 9px" }}><ArrowUp size={13} color={C.green} strokeWidth={2.6} /><span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 600, color: C.green }}>{wStr(l.delta, unit)}</span></div> : <span style={{ fontFamily: MONO, fontSize: 12, color: C.faint }}>—</span>}
              </div>
            ))}
          </Card>
        </>}
      </>)}
    </div>
  );
}

/* ================================================================
   DASHBOARD
================================================================ */
function Dashboard({ profile, weightLog, setWeightLog, programs, history, go }) {
  const [view, setView] = useState("main");
  const [wkOffset, setWkOffset] = useState(0);
  const [selKey, setSelKey] = useState(ymd(new Date()));
  const [period, setPeriod] = useState("7D");
  const u = profile.unit;
  const active = activeProgram(programs);
  const paused = isPaused(active);
  const sched = active && !paused ? (active.scheduleDays || []) : [];

  const todayKey = ymd(new Date());
  const [weightKg, setWeightKg] = useState(weightLog[todayKey] ?? lastWeight(weightLog) ?? profile.currentKg ?? 80);
  useEffect(() => { setWeightKg(weightLog[todayKey] ?? lastWeight(weightLog) ?? profile.currentKg ?? 80); }, [weightLog, todayKey, profile.currentKg]);
  const loggedToday = weightLog[todayKey] != null;


  const step = (d) => setWeightKg((w) => Math.round((w + (u === "lb" ? d / KG_TO_LB : d)) * 100) / 100);
  const logWeight = () => setWeightLog({ ...weightLog, [todayKey]: Math.round(weightKg * 100) / 100 });

  const weekStart = addDays(mondayOf(new Date()), wkOffset * 7);
  const today0 = startOfDay(new Date());
  const startedAt0 = active?.startedAt ? startOfDay(new Date(active.startedAt)) : null;
  const days = Array.from({ length: 7 }).map((_, i) => {
    const dt = addDays(weekStart, i); const key = ymd(dt); const dow = dt.getDay();
    const aidx = active && !paused ? assignedIdx(active, dt) : null;
    const scheduled = aidx != null;
    const done = history.some((h) => h.date === key);
    const weighed = weightLog[key] != null;
    const past = startOfDay(dt) < today0;
    const afterStart = startedAt0 ? startOfDay(dt) >= startedAt0 : false;
    const wDone = scheduled ? !!sessionForWorkout(history, active, dt, aidx) : false;
    const missed = scheduled && past && !wDone && afterStart && !paused;
    return { dt, key, dow, aidx, scheduled, done, wDone, weighed, missed, isToday: sameDay(dt, new Date()) };
  });

  const ndi = nextDayIndex(history, active);
  const selDay = days.find((d) => d.key === selKey) || days[0];
  const selSession = history.find((h) => h.date === selKey);
  const planned = active && active.days.length ? active.days[ndi] : null;

  const g = deriveGoal(profile, lastWeight(weightLog) ?? profile.currentKg);
  const entries = Object.keys(weightLog).sort().map((k) => ({ t: startOfDay(new Date(k)).getTime(), kg: weightLog[k] }));
  const trend = useMemo(() => {
    let pts = [];
    if (period === "7D") pts = Array.from({ length: 7 }).map((_, i) => { const dt = addDays(mondayOf(new Date()), i); const k = ymd(dt); return { t: startOfDay(dt).getTime(), label: WD_LETTER[dt.getDay()], kg: weightLog[k] ?? null }; });
    else { const nd = period === "1M" ? 31 : period === "6M" ? 183 : 3650; const cut = today0.getTime() - nd * DAYMS; pts = entries.filter((e) => e.t >= cut).map((e) => { const d = new Date(e.t); return { t: e.t, label: period === "All" ? `'${String(d.getFullYear()).slice(2)}` : `${d.getDate()} ${MON[d.getMonth()]}`, kg: e.kg }; }); }
    const known = pts.filter((p) => p.kg != null);
    const gs = known.length && g.weeklyRate ? { t: known[0].t, kg: known[0].kg } : null;
    const data = pts.map((p) => { let goal = null; if (gs) { const wks = (p.t - gs.t) / (7 * DAYMS); let gg = gs.kg + g.weeklyRate * wks; gg = g.weeklyRate < 0 ? Math.max(gg, g.goal) : Math.min(gg, g.goal); goal = +fmtW(gg, u).toFixed(1); } return { x: p.label, w: p.kg != null ? +fmtW(p.kg, u).toFixed(1) : null, goal }; });
    return { data, known: known.length };
  }, [period, weightLog, g.weeklyRate, g.goal, u]);
  const vals = trend.data.filter((d) => d.w != null).map((d) => d.w).concat(trend.data.filter((d) => d.goal != null).map((d) => d.goal));
  const lo = vals.length ? Math.floor(Math.min(...vals) / 5) * 5 : 0, hi = vals.length ? Math.ceil(Math.max(...vals) / 5) * 5 : 5;
  const ticks = []; for (let v = lo; v <= hi; v += 5) ticks.push(v);
  const knownPts = trend.data.filter((d) => d.w != null);
  const delta = knownPts.length >= 2 ? knownPts[knownPts.length - 1].w - knownPts[0].w : 0;
  const greetHr = new Date().getHours();
  const greet = greetHr < 12 ? "Good morning" : greetHr < 18 ? "Good afternoon" : "Good evening";

  return (
    <div style={{ padding: "14px 18px 24px" }}>
      {/* GREETING */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div>
          <div style={{ fontFamily: SANS, fontSize: 13.5, color: C.sub, fontWeight: 500 }}>{greet},</div>
          <h1 style={{ fontFamily: SANS, fontSize: 27, fontWeight: 720, color: C.ink, margin: "2px 0 0", letterSpacing: -0.6 }}>{profile.name || "Athlete"}</h1>
        </div>
        <div style={{ width: 46, height: 46, borderRadius: 23, background: C.graphite, color: C.onDark, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SANS, fontSize: 17, fontWeight: 650 }}>{(profile.name || "?").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}</div>
      </div>

      {/* WEEK STREAK */}
      <Card style={{ padding: "16px 12px", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 4px", marginBottom: 14 }}>
          <MiniStep onClick={() => setWkOffset(wkOffset - 1)}><ChevronLeft size={18} /></MiniStep>
          <Eyebrow>{wkOffset === 0 ? "This week" : `${weekStart.getDate()} ${MON[weekStart.getMonth()]} – ${addDays(weekStart, 6).getDate()} ${MON[addDays(weekStart, 6).getMonth()]}`}</Eyebrow>
          <MiniStep onClick={() => setWkOffset(Math.min(0, wkOffset + 1))}><ChevronRight size={18} color={wkOffset < 0 ? C.ink : C.faint} /></MiniStep>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
          {days.map((s, i) => {
            const sel = s.key === selKey;
            const ring = s.done ? C.ink : sel ? ACC : s.missed ? C.amber : s.isToday ? ACC : s.scheduled ? C.line : C.lineSoft;
            return (
              <button key={i} onClick={() => setSelKey(s.key)} style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 0", WebkitTapHighlightColor: "transparent" }}>
                <div style={{ fontFamily: MONO, fontSize: 9.5, color: s.isToday ? ACC : C.faint, fontWeight: s.isToday ? 700 : 400, marginBottom: 6 }}>{WD_LETTER[s.dow]}</div>
                <div style={{ position: "relative", width: 38, height: 38, margin: "0 auto" }}>
                  <div style={{ width: 38, height: 38, borderRadius: 19, display: "flex", alignItems: "center", justifyContent: "center", background: s.done ? C.ink : sel ? ACC_BG : "transparent", border: `2px solid ${ring}` }}>
                    {s.done ? <Check size={15} color="#fff" strokeWidth={3} /> : <span style={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 600, color: s.isToday || sel ? ACC : C.ink }}>{s.dt.getDate()}</span>}
                  </div>
                  {s.scheduled && <div style={{ position: "absolute", bottom: -3, right: -3, width: 17, height: 17, borderRadius: 9, background: s.wDone ? C.green : s.missed ? C.amber : s.isToday ? ACC : C.ink, border: `2px solid ${C.card}`, display: "flex", alignItems: "center", justifyContent: "center" }}><Dumbbell size={8} color="#fff" strokeWidth={2.6} /></div>}
                </div>
                <div style={{ width: 5, height: 5, borderRadius: 3, margin: "7px auto 0", background: s.weighed ? C.green : "transparent" }} />
              </button>
            );
          })}
        </div>
      </Card>

      {/* TODAY'S WORKOUT */}
      {(() => {
        if (selSession) {
          const byEx = {};
          (selSession.sets || []).forEach((x) => { (byEx[x.exId] = byEx[x.exId] || []).push(x); });
          return (
            <Card style={{ padding: 18, marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div><div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 1.2, color: C.green, fontWeight: 600 }}>{selDay.isToday ? "COMPLETED TODAY" : "COMPLETED"}</div><div style={{ fontFamily: SANS, fontSize: 20, fontWeight: 700, color: C.ink, marginTop: 4 }}>{selSession.dayName}</div></div>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: C.greenBg, display: "flex", alignItems: "center", justifyContent: "center" }}><Check size={20} color={C.green} strokeWidth={3} /></div>
              </div>
              {Object.entries(byEx).map(([id, ss]) => (
                <div key={id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "9px 0", borderTop: `1px solid ${C.lineSoft}` }}>
                  <span style={{ fontFamily: SANS, fontSize: 14, color: C.ink }}>{exName(id)}</span>
                  <span style={{ fontFamily: MONO, fontSize: 12.5, color: C.sub }}>{ss.map((x) => x.w > 0 ? `${wStr(x.w, u)}×${x.reps}` : `${x.reps}`).join("  ")}</span>
                </div>
              ))}
            </Card>
          );
        }
        if (!active || !active.days.length) {
          return (
            <button onClick={() => go("programs")} style={{ display: "block", width: "100%", textAlign: "left", cursor: "pointer", background: C.card, borderRadius: 14, border: `1px solid ${C.line}`, padding: 20, marginBottom: 14, WebkitTapHighlightColor: "transparent" }}>
              <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 1.2, color: C.faint, fontWeight: 600 }}>NO ACTIVE PROGRAM</div>
              <div style={{ fontFamily: SANS, fontSize: 19, fontWeight: 700, color: C.ink, margin: "6px 0 10px" }}>Choose a program to begin</div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 1, color: ACC }}>GO TO PROGRAMS</span><ChevronRight size={15} color={ACC} /></div>
            </button>
          );
        }
        if (selDay.scheduled) {
          const aidx = assignedIdx(active, selDay.dt) ?? 0;
          const w = active.days[aidx] || active.days[0];
          const label = selDay.isToday ? "TODAY'S WORKOUT" : selDay.past ? "MISSED — MAKE IT UP" : "COMING UP";
          const color = selDay.missed ? C.amber : ACC;
          return (
            <Card style={{ padding: 18, marginBottom: 14 }}>
              <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 1.2, color: color, fontWeight: 600 }}>{label}</div>
              <div style={{ fontFamily: SANS, fontSize: 22, fontWeight: 720, color: C.ink, margin: "5px 0 12px", letterSpacing: -0.4 }}>{wLabel(aidx)}</div>
              <div style={{ marginBottom: 14 }}>
                {w.ex.slice(0, 4).map((e, k) => (
                  <div key={k} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: k === 0 ? "none" : `1px solid ${C.lineSoft}` }}>
                    <div style={{ width: 7, height: 7, borderRadius: 4, background: C.faint, flexShrink: 0 }} />
                    <span style={{ fontFamily: SANS, fontSize: 14, color: C.ink, flex: 1 }}>{exName(e.id)}</span>
                    <span style={{ fontFamily: MONO, fontSize: 10.5, color: C.faint }}>{setCount(e)} × sets</span>
                  </div>
                ))}
                {w.ex.length > 4 && <div style={{ fontFamily: SANS, fontSize: 12, color: C.faint, marginTop: 8 }}>+{w.ex.length - 4} more</div>}
              </div>
              <BigButton tone="acc" onClick={() => go("train")}><Play size={17} /> Start workout</BigButton>
            </Card>
          );
        }
        return (
          <Card style={{ padding: 22, marginBottom: 14, textAlign: "center" }}>
            <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 1.2, color: C.faint, fontWeight: 600 }}>REST DAY</div>
            <div style={{ fontFamily: SANS, fontSize: 20, fontWeight: 700, color: C.ink, margin: "6px 0 4px" }}>{selDay.isToday ? "Rest up" : `${WD_LONG[selDay.dow]} ${selDay.dt.getDate()} ${MON[selDay.dt.getMonth()]}`}</div>
            <div style={{ fontFamily: SANS, fontSize: 13.5, color: C.sub, lineHeight: 1.5 }}>Nothing planned — recovery is where the gains happen.</div>
            <button onClick={() => go("train")} style={{ marginTop: 12, height: 44, padding: "0 8px", background: "none", border: "none", cursor: "pointer", fontFamily: SANS, fontSize: 13, fontWeight: 600, color: ACC }}>Start a workout anyway →</button>
          </Card>
        );
      })()}

      {/* PROGRAM PROGRESS */}
      {active && (
        <button onClick={() => setView("stats")} style={{ display: "block", width: "100%", textAlign: "left", cursor: "pointer", border: `1px solid ${C.onDarkLine}`, background: `linear-gradient(150deg, ${C.graphite2}, ${C.graphite})`, borderRadius: 16, padding: 20, marginBottom: 14, WebkitTapHighlightColor: "transparent" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
            <div><Eyebrow dark>{paused ? "Program paused" : "Active program"}</Eyebrow><div style={{ fontFamily: SANS, fontSize: 22, fontWeight: 680, color: C.onDark, marginTop: 6 }}>{active.name}</div></div>
            <div style={{ textAlign: "right" }}><div style={{ fontFamily: MONO, fontSize: 24, fontWeight: 600, color: C.onDark, lineHeight: 1 }}>{String(programWeek(active)).padStart(2, "0")}</div><div style={{ fontFamily: MONO, fontSize: 10, color: C.onDarkSub, marginTop: 3 }}>/ {active.weeks} WEEKS</div></div>
          </div>
          <div style={{ height: 5, background: C.onDarkLine, borderRadius: 3, marginBottom: 18, overflow: "hidden" }}><div style={{ width: `${Math.min(100, (programWeek(active) / active.weeks) * 100)}%`, height: "100%", background: paused ? C.amber : ACC, borderRadius: 3 }} /></div>
          {(() => {
            const done = sessionsFor(history, active.id).length;
            const scheduled = scheduledSoFar(active);
            const pct = scheduled ? Math.min(100, Math.round((done / scheduled) * 100)) : 0;
            if (scheduled === 0) return (
              <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                <Dial pct={0} />
                <div><Eyebrow dark>Consistency</Eyebrow><div style={{ fontFamily: SANS, fontSize: 15, color: C.onDark, fontWeight: 500, marginTop: 8, lineHeight: 1.4 }}>Just getting started —<br />your first session is<br />coming up</div></div>
              </div>
            );
            return (<div style={{ display: "flex", alignItems: "center", gap: 18 }}><Dial pct={pct} /><div><Eyebrow dark>Consistency</Eyebrow><div style={{ fontFamily: SANS, fontSize: 15, color: C.onDark, fontWeight: 500, marginTop: 8, lineHeight: 1.4 }}><span style={{ fontFamily: MONO, fontWeight: 600 }}>{done}</span> of <span style={{ fontFamily: MONO, fontWeight: 600 }}>{scheduled}</span> workout{scheduled !== 1 ? "s" : ""}<br />done so far{paused ? " · paused" : ""}</div></div></div>); })()}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 5, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.onDarkLine}` }}><span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: 1.2, color: C.onDarkSub, textTransform: "uppercase" }}>View full stats</span><ChevronRight size={15} color={C.onDarkSub} /></div>
        </button>
      )}

      {/* WEIGH-IN */}
      <Card style={{ padding: 20, marginBottom: 14 }}>
        <Eyebrow>Morning weigh-in</Eyebrow>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "16px 0" }}>
          <button onClick={() => step(-0.1)} style={stepBtn}><Minus size={26} strokeWidth={2.5} /></button>
          <div style={{ textAlign: "center" }}><div style={{ fontFamily: MONO, fontSize: 46, fontWeight: 600, color: C.ink, lineHeight: 1 }}>{wStr(weightKg, u)}</div><div style={{ fontFamily: MONO, fontSize: 12, color: C.sub, marginTop: 4 }}>{u.toUpperCase()}</div></div>
          <button onClick={() => step(0.1)} style={stepBtn}><Plus size={26} strokeWidth={2.5} /></button></div>
        <BigButton tone={loggedToday ? "done" : "acc"} onClick={logWeight}>{loggedToday ? "Logged for today" : "Log weight"}</BigButton>
      </Card>

      {/* TREND */}
      <Card style={{ padding: "16px 8px 12px" }}>
        <div style={{ padding: "0 12px", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}><Eyebrow>Weight trend</Eyebrow>{knownPts.length >= 2 && <span style={{ fontFamily: MONO, fontSize: 11, color: delta <= 0 ? C.green : C.red, marginLeft: "auto", display: "flex", alignItems: "center", gap: 3 }}><TrendingDown size={13} />{delta >= 0 ? "+" : ""}{delta.toFixed(1)} {u.toUpperCase()}</span>}</div>
          <Segmented small options={["7D", "1M", "6M", "All"]} value={period} onChange={setPeriod} />
        </div>
        {knownPts.length === 0 ? (
          <div style={{ padding: "26px 16px", textAlign: "center", fontFamily: SANS, fontSize: 13.5, color: C.sub }}>Log your weight to start your trend. Your dashed goal line appears once you have an entry.</div>
        ) : (<>
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={trend.data} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={C.lineSoft} />
              <XAxis dataKey="x" tick={{ fontFamily: MONO, fontSize: 10, fill: C.faint }} axisLine={false} tickLine={false} interval={0} />
              <YAxis domain={[lo, hi]} ticks={ticks} tick={{ fontFamily: MONO, fontSize: 10, fill: C.faint }} axisLine={false} tickLine={false} width={34} />
              <Tooltip contentStyle={{ fontFamily: MONO, fontSize: 12, borderRadius: 8, border: `1px solid ${C.line}` }} />
              <Line type="monotone" dataKey="goal" stroke={C.faint} strokeWidth={1.5} strokeDasharray="5 4" dot={false} connectNulls name="Goal" />
              <Line type="monotone" dataKey="w" stroke={ACC} strokeWidth={2.5} dot={{ r: 3, fill: ACC }} activeDot={{ r: 5 }} connectNulls name="Weight" />
            </LineChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 14px" }}><span style={{ fontFamily: MONO, fontSize: 10.5, color: C.faint }}><span style={{ color: ACC }}>—</span> WEIGHT　┄ GOAL</span><span style={{ fontFamily: MONO, fontSize: 10.5, color: C.faint }}>GRID · 5 {u.toUpperCase()}</span></div>
        </>)}
      </Card>
    </div>
  );
}
function Train({ profile, programs, history, draft, setDraft, onFinish, go, equipment, setEquipment }) {
  const active = activeProgram(programs);
  const u = profile.unit;
  const live = draft && active && draft.programId === active.id ? draft : null;
  const [phase, setPhase] = useState(live ? "active" : "schedule");
  const [openRating, setOpenRating] = useState(null);
  const [savedCount, setSavedCount] = useState(0);
  const [finishedIdx, setFinishedIdx] = useState(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [detail, setDetail] = useState(null);
  const [calcOpen, setCalcOpen] = useState(null);
  useEffect(() => { if (!live && (phase === "active" || phase === "review")) setPhase("schedule"); }, [live, phase]);

  if (!active) return (<div style={{ padding: "6px 18px 24px" }}><PageTitle sub="Workout">This week</PageTitle><Card style={{ padding: 30, textAlign: "center" }}><div style={{ fontFamily: SANS, fontSize: 16, fontWeight: 650, color: C.ink }}>No active program</div><div style={{ fontFamily: SANS, fontSize: 13.5, color: C.sub, margin: "6px 0 18px", lineHeight: 1.5 }}>Start a program on the Programs tab, then your week appears here.</div><BigButton tone="acc" onClick={() => go("programs")}>Go to Programs</BigButton></Card></div>);
  if (!active.days.length) return (<div style={{ padding: "6px 18px 24px" }}><PageTitle sub={active.name}>This week</PageTitle><Card style={{ padding: 30, textAlign: "center" }}><div style={{ fontFamily: SANS, fontSize: 16, fontWeight: 650, color: C.ink }}>No training days yet</div><div style={{ fontFamily: SANS, fontSize: 13.5, color: C.sub, margin: "6px 0 18px" }}>Add days and exercises to {active.name}.</div><BigButton tone="acc" onClick={() => go("programs")}>Edit program</BigButton></Card></div>);

  const startWorkout = (idx) => {
    const d = active.days[idx];
    const init = {};
    const sessionCountAtStart = sessionsFor(history, active.id).length;
    d.ex.forEach((exx, ei) => {
      const strategy = progressionOf(active, exx);
      const ctx = { lastReadiness: active.lastReadiness, program: active, sessionCount: sessionCountAtStart };
      const specs = strategy.getSetSpecs ? strategy.getSetSpecs(exx, ctx) : null;
      if (specs) {
        const tm = strategy.effectiveTM(exx, ctx);
        specs.forEach((spec, si) => { init[`${ei}-${si}`] = { w: tm ? wStr(strategy.weightForSpec(tm, spec), u) : "", reps: String(spec.reps) }; });
      } else {
        const rec = strategy.recommend(exx, ctx);
        Array.from({ length: setCount(exx) }).forEach((_, si) => { init[`${ei}-${si}`] = { w: exx.last?.logged && exx.last.w > 0 ? wStr(rec.w, u) : "", reps: exx.last?.logged ? String(exx.last.reps || 10) : "" }; });
      }
    });
    setDraft({ programId: active.id, dayIdx: idx, dateKey: ymd(new Date()), setData: init, done: {}, startedAt: new Date().toISOString() });
    setOpenRating(null); setConfirmDiscard(false); setPhase("active");
  };
  const upd = (key, field, val) => setDraft((d) => ({ ...d, setData: { ...d.setData, [key]: { ...(d.setData[key] || {}), [field]: val } } }));
  const rate = (key, c) => setDraft((d) => ({ ...d, done: { ...d.done, [key]: c } }));
  const discard = () => { setDraft(null); setConfirmDiscard(false); setPhase("schedule"); };

  const finish = (readiness) => {
    const idx = live.dayIdx, sdAll = live.setData, dn = live.done;
    const sets = [];
    const newDays = active.days.map((d, di) => {
      if (di !== idx) return d;
      return { ...d, ex: d.ex.map((exx, ei) => {
        const rated = Object.keys(dn).filter((k) => k.startsWith(`${ei}-`));
        if (!rated.length) return exx;
        const loggedSets = rated.map((k) => { const sd = sdAll[k] || {}; return { w: parseFloat(sd.w) || 0, reps: parseInt(sd.reps) || 0, rating: dn[k] }; });
        loggedSets.forEach((s) => sets.push({ exId: exx.id, w: s.w, reps: s.reps, rir: s.rating }));
        const patch = progressionOf(active, exx).finishExercise(exx, loggedSets, { isBodyweight: isBW(exx.id), program: active });
        return patch ? { ...exx, ...patch } : exx;
      }) };
    });
    setSavedCount(Object.keys(dn).length); setFinishedIdx(idx);
    onFinish({ date: live.dateKey || ymd(new Date()), programId: active.id, dayIdx: idx, dayName: wLabel(idx), sets }, newDays, readiness);
    setDraft(null); setPhase("done");
  };

  /* ================= SCHEDULE ================= */
  if (phase === "schedule") {
    const wkStart = mondayOf(new Date());
    const today0 = startOfDay(new Date());
    const week = Array.from({ length: 7 }).map((_, i) => {
      const dt = addDays(wkStart, i); const aidx = assignedIdx(active, dt);
      const sess = aidx != null ? sessionForWorkout(history, active, dt, aidx) : null;
      return { dt, key: ymd(dt), dow: dt.getDay(), aidx, done: !!sess, inProgress: !!(live && live.dayIdx === aidx), isToday: sameDay(dt, new Date()), past: startOfDay(dt) < today0 };
    });
    const nextRow = week.find((d) => d.aidx != null && !d.done && !d.past) || week.find((d) => d.aidx != null && !d.done);

    return (
      <div style={{ padding: "14px 18px 24px" }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: SANS, fontSize: 13, color: C.sub, fontWeight: 500 }}>{active.name} · week {programWeek(active)}</div>
          <h1 style={{ fontFamily: SANS, fontSize: 27, fontWeight: 720, color: C.ink, margin: "2px 0 0", letterSpacing: -0.6 }}>This week</h1>
        </div>

        {live ? (
          <div style={{ border: `1px solid ${C.onDarkLine}`, background: `linear-gradient(150deg, ${C.graphite2}, ${C.graphite})`, borderRadius: 16, padding: 20, marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div><div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 1.2, color: C.amber, fontWeight: 600 }}>IN PROGRESS</div><div style={{ fontFamily: SANS, fontSize: 23, fontWeight: 700, color: C.onDark, marginTop: 5 }}>{wLabel(live.dayIdx)}</div><div style={{ fontFamily: MONO, fontSize: 11, color: C.onDarkSub, marginTop: 4 }}>{Object.keys(live.done).length} SETS LOGGED</div></div>
            <button onClick={() => setPhase("active")} style={{ height: 48, padding: "0 22px", borderRadius: 24, border: "none", background: ACC, color: "#fff", fontFamily: SANS, fontSize: 15, fontWeight: 650, cursor: "pointer", display: "flex", alignItems: "center", gap: 7, WebkitTapHighlightColor: "transparent" }}><Play size={16} /> Resume</button>
          </div>
        ) : nextRow ? (
          <div style={{ border: `1px solid ${C.onDarkLine}`, background: `linear-gradient(150deg, ${C.graphite2}, ${C.graphite})`, borderRadius: 16, padding: 20, marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div><div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 1.2, color: ACC, fontWeight: 600 }}>{nextRow.isToday ? "TODAY'S WORKOUT" : "NEXT WORKOUT"}</div><div style={{ fontFamily: SANS, fontSize: 23, fontWeight: 700, color: C.onDark, marginTop: 5 }}>{wLabel(nextRow.aidx)}</div></div>
            <button onClick={() => startWorkout(nextRow.aidx)} style={{ height: 48, padding: "0 22px", borderRadius: 24, border: "none", background: ACC, color: "#fff", fontFamily: SANS, fontSize: 15, fontWeight: 650, cursor: "pointer", display: "flex", alignItems: "center", gap: 7, WebkitTapHighlightColor: "transparent" }}><Play size={16} /> Get started</button>
          </div>
        ) : (
          <div style={{ border: `1px solid ${C.line}`, background: C.card, borderRadius: 16, padding: 22, marginBottom: 20, textAlign: "center" }}>
            <div style={{ width: 46, height: 46, borderRadius: 23, background: C.greenBg, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px" }}><Check size={24} color={C.green} strokeWidth={3} /></div>
            <div style={{ fontFamily: SANS, fontSize: 17, fontWeight: 700, color: C.ink }}>All caught up this week</div>
            <div style={{ fontFamily: SANS, fontSize: 13, color: C.sub, marginTop: 4 }}>Every scheduled workout is done. Nice.</div>
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <SectionLabel>This week's schedule</SectionLabel>
          <button onClick={() => setCalcOpen({ initialKg: 0 })} style={{ ...miniRound, marginBottom: 8 }}><Calculator size={16} /></button>
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          {week.map((d, i) => {
            const isWorkout = d.aidx != null;
            const missed = isWorkout && d.past && !d.done && !d.inProgress;
            const border = d.done ? C.green : d.inProgress ? C.amber : d.isToday && isWorkout ? ACC : C.line;
            const iconBg = d.done ? C.greenBg : d.inProgress ? C.amberBg : d.isToday && isWorkout ? ACC_BG : C.page;
            const iconColor = d.done ? C.green : d.inProgress ? C.amber : d.isToday && isWorkout ? ACC : C.faint;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 40, fontFamily: MONO, fontSize: 11, fontWeight: 700, color: d.isToday ? ACC : C.faint, flexShrink: 0 }}>{WD_LONG[d.dow].slice(0, 3).toUpperCase()}</div>
                <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 12, background: C.card, border: `1.5px solid ${border}`, borderRadius: 13, padding: "12px 14px", minHeight: 66 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 11, background: iconBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{isWorkout ? <Dumbbell size={20} color={iconColor} /> : <Moon size={19} color={C.faint} />}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {isWorkout ? (
                      <>{d.done && <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}><Check size={13} color={C.green} strokeWidth={3} /><span style={{ fontFamily: SANS, fontSize: 12.5, fontWeight: 600, color: C.green }}>Complete</span></div>}
                        {d.inProgress && <div style={{ fontFamily: SANS, fontSize: 12, fontWeight: 600, color: C.amber, marginBottom: 2 }}>In progress</div>}
                        {missed && <div style={{ fontFamily: SANS, fontSize: 12, fontWeight: 600, color: C.amber, marginBottom: 2 }}>Missed</div>}
                        <div style={{ fontFamily: SANS, fontSize: 16, fontWeight: 650, color: C.ink }}>{wLabel(d.aidx)}</div></>
                    ) : (
                      <div style={{ fontFamily: SANS, fontSize: 16, fontWeight: 600, color: C.faint }}>Rest</div>
                    )}
                  </div>
                  {isWorkout && !d.done && (
                    <button onClick={() => (d.inProgress ? setPhase("active") : startWorkout(d.aidx))} style={{ height: 40, padding: "0 16px", borderRadius: 20, border: "none", background: d.inProgress ? C.amber : missed ? C.amber : ACC, color: "#fff", fontFamily: SANS, fontSize: 14, fontWeight: 650, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, flexShrink: 0, WebkitTapHighlightColor: "transparent" }}><Play size={14} /> {d.inProgress ? "Resume" : "Start"}</button>
                  )}
                  {!isWorkout && (
                    <button onClick={() => setPhase("pick")} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, color: ACC, fontFamily: SANS, fontSize: 13.5, fontWeight: 600, flexShrink: 0, WebkitTapHighlightColor: "transparent" }}><Plus size={16} strokeWidth={2.5} /> Add</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {calcOpen && <PlateCalculator targetKg={calcOpen.initialKg} equipment={equipment} setEquipment={setEquipment} unit={u} onClose={() => setCalcOpen(null)} />}
      </div>
    );
  }

  /* ================= PICK ================= */
  if (phase === "pick") {
    const todayAi = assignedIdx(active, new Date());
    return (
      <div style={{ padding: "6px 18px 24px" }}>
        <button onClick={() => setPhase("schedule")} style={backBtn}><ChevronLeft size={20} /> This week</button>
        <PageTitle sub={`${active.name} · week ${programWeek(active)}`}>Pick a workout</PageTitle>
        <div style={{ fontFamily: SANS, fontSize: 13.5, color: C.sub, marginTop: -12, marginBottom: 16, lineHeight: 1.45 }}>Choose which session to train.</div>
        <div style={{ display: "grid", gap: 10 }}>
          {active.days.map((d, i) => { const sug = i === todayAi; return (
            <button key={i} onClick={() => startWorkout(i)} style={{ display: "flex", alignItems: "center", gap: 14, textAlign: "left", padding: "16px 18px", borderRadius: 14, border: `1.5px solid ${sug ? ACC : C.line}`, background: sug ? ACC_BG : C.card, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: sug ? ACC : C.page, color: sug ? "#fff" : C.sub, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Dumbbell size={20} /></div>
              <div style={{ flex: 1 }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontFamily: SANS, fontSize: 16.5, fontWeight: 650, color: C.ink }}>{wLabel(i)}</span>{sug && <span style={{ fontFamily: MONO, fontSize: 8.5, background: ACC, color: "#fff", padding: "2px 6px", borderRadius: 5, letterSpacing: .5 }}>TODAY</span>}</div>
                <div style={{ fontFamily: MONO, fontSize: 10.5, color: C.faint, marginTop: 3 }}>{d.ex.length} exercise{d.ex.length !== 1 ? "s" : ""} · {d.ex.reduce((n, e) => n + setCount(e), 0)} sets</div></div>
              <Play size={18} color={sug ? ACC : C.faint} />
            </button>
          ); })}
        </div>
      </div>
    );
  }

  /* ================= DONE ================= */
  if (phase === "done") return (
    <div style={{ padding: "6px 18px 24px" }}><PageTitle sub={`${active.name} · week ${programWeek(active)}`}>{wLabel(finishedIdx ?? 0)}</PageTitle>
      <Card style={{ padding: 28, textAlign: "center", marginBottom: 14 }}>
        <div style={{ width: 60, height: 60, borderRadius: 30, background: C.greenBg, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}><Check size={30} color={C.green} strokeWidth={3} /></div>
        <div style={{ fontFamily: SANS, fontSize: 21, fontWeight: 680, color: C.ink }}>Session saved</div>
        <div style={{ fontFamily: SANS, fontSize: 14, color: C.sub, marginTop: 8, lineHeight: 1.5 }}>{savedCount} sets recorded. Your next session and recommendations are updated.</div>
      </Card>
      <BigButton tone="acc" onClick={() => go("home")}>Take me back to dashboard</BigButton>
      <div style={{ height: 10 }} />
      <BigButton tone="ghost" onClick={() => setPhase("schedule")}>Back to this week</BigButton>
    </div>
  );

  if (!live) return null;
  const day = active.days[live.dayIdx];
  const setData = live.setData || {}, done = live.done || {};
  const sessionCount = sessionsFor(history, active.id).length;
  const customWeekLabel = progressionOf(active).weekLabel(active, { sessionCount, program: active });
  const subLine = `${active.name} · ${customWeekLabel || `Week ${programWeek(active)}`} · ${wLabel(live.dayIdx)}`;
  const totalSets = day.ex.reduce((n, exx) => {
    const strat = progressionOf(active, exx);
    const specs = strat.getSetSpecs ? strat.getSetSpecs(exx, { lastReadiness: active.lastReadiness, program: active, sessionCount }) : null;
    return n + (specs ? specs.length : setCount(exx));
  }, 0);
  const doneCount = Object.keys(done).length;

  /* ================= REVIEW ================= */
  if (phase === "review") return (
    <div style={{ padding: "6px 18px 24px" }}><PageTitle sub={subLine}>{wLabel(live.dayIdx)}</PageTitle>
      <Card style={{ padding: 22 }}>
        <Eyebrow>Session complete</Eyebrow>
        <div style={{ fontFamily: SANS, fontSize: 20, fontWeight: 650, color: C.ink, margin: "8px 0 4px" }}>How did that session feel?</div>
        <div style={{ fontFamily: SANS, fontSize: 13, color: C.sub, marginBottom: 20, lineHeight: 1.4 }}>This tunes next week — a tough session won't be read as a plateau if you were just tired.</div>
        <div style={{ display: "grid", gap: 10 }}>
          {READINESS.map(({ v, label, Icon }) => (
            <button key={v} onClick={() => finish(v)} style={{ display: "flex", alignItems: "center", gap: 14, height: 62, borderRadius: 13, border: `1.5px solid ${C.line}`, background: C.card, cursor: "pointer", padding: "0 18px", WebkitTapHighlightColor: "transparent" }}>
              <div style={{ width: 40, height: 40, borderRadius: 11, background: ACC_BG, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon size={20} color={ACC} /></div>
              <span style={{ fontFamily: SANS, fontSize: 16, fontWeight: 600, color: C.ink }}>{label}</span><ChevronRight size={18} color={C.faint} style={{ marginLeft: "auto" }} /></button>
          ))}
        </div>
        <button onClick={() => setPhase("active")} style={{ width: "100%", height: 44, marginTop: 12, borderRadius: 11, border: "none", background: "transparent", color: C.sub, fontFamily: SANS, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Back to logging</button>
      </Card>
    </div>
  );

  /* ================= ACTIVE ================= */
  return (
    <div style={{ padding: "6px 18px 24px" }}>
      <button onClick={() => setPhase("schedule")} style={backBtn}><ChevronLeft size={20} /> This week</button>
      <PageTitle sub={subLine}>{wLabel(live.dayIdx)}</PageTitle>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: -12, marginBottom: 16 }}>
        <span style={{ fontFamily: MONO, fontSize: 12, color: C.sub }}>{doneCount} / {totalSets} SETS COMPLETE</span>
        <span style={{ fontFamily: SANS, fontSize: 11.5, color: C.amber, background: C.amberBg, padding: "3px 9px", borderRadius: 6 }}>Saved as you go</span>
      </div>
      {day.ex.map((exx, ei) => {
        const strategy = progressionOf(active, exx);
        const ctx = { lastReadiness: active.lastReadiness, program: active, sessionCount };
        const rec = strategy.recommend(exx, ctx);
        const specs = strategy.getSetSpecs ? strategy.getSetSpecs(exx, ctx) : null;
        const tm = specs ? strategy.effectiveTM(exx, ctx) : null;
        const rows = specs || Array.from({ length: setCount(exx) }).map(() => null);
        const ratings = ratingTable(strategy.setRatingKind);
        const ratingKeys = Object.keys(ratings);
        const Arrow = rec.dir === "up" ? ArrowUp : rec.dir === "down" ? ArrowDown : ArrowRight;
        const dirColor = rec.dir === "up" ? C.green : rec.dir === "down" ? C.red : C.sub;
        const bw = isBW(exx.id);
        const prev = exx.last?.logged ? (exx.last.w > 0 ? `${wStr(exx.last.w, u)}×${exx.last.reps}` : `${exx.last.reps}`) : "—";
        const th = { flex: 1, fontFamily: MONO, fontSize: 10, letterSpacing: .8, color: C.faint, textAlign: "center" };
        return (
          <Card key={ei} style={{ padding: 16, marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 12 }}>
              <ExerciseThumb exercise={exFull(exx.id)} onOpen={setDetail} />
              <div onClick={() => setDetail(exFull(exx.id))} style={{ flex: 1, cursor: "pointer" }}><div style={{ fontFamily: SANS, fontSize: 16, fontWeight: 650, color: C.ink }}>{exName(exx.id)}</div><div style={{ fontFamily: MONO, fontSize: 10, color: C.faint, marginTop: 1 }}>{exMuscle(exx.id).toUpperCase()}</div></div>
              {!bw && <button onClick={() => setCalcOpen({ initialKg: tm || rec.w || 0 })} style={{ ...miniRound, width: 34, height: 34 }}><Calculator size={15} /></button>}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.page, borderRadius: 10, padding: "9px 12px", marginBottom: 12 }}>
              <Arrow size={15} color={dirColor} strokeWidth={2.6} />
              <span style={{ fontFamily: SANS, fontSize: 12.5, color: C.ink, flex: 1, lineHeight: 1.35 }}><b style={{ color: dirColor }}>{rec.action}.</b> {rec.first ? "Set your baseline — no target yet." : rec.note}</span>
              {!rec.first && <span style={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 600, color: C.ink, whiteSpace: "nowrap" }}>{rec.w === 0 ? "BW" : `${wStr(rec.w, u)} ${u}`}</span>}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 2px 7px" }}>
              <div style={{ width: 26, fontFamily: MONO, fontSize: 10, letterSpacing: .8, color: C.faint, textAlign: "left" }}>SET</div>
              <div style={th}>{specs ? "TARGET" : "PREV"}</div>
              <div style={th}>{bw ? "+" + u.toUpperCase() : u.toUpperCase()}</div>
              <div style={th}>REPS</div>
              <div style={{ width: 48 }} />
            </div>
            {rows.map((spec, si) => {
              const key = `${ei}-${si}`, rated = done[key]; const sd = setData[key] || { w: "", reps: "" };
              const cell = { flex: 1, height: 44, background: C.page, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" };
              const inp = { border: "none", outline: "none", background: "transparent", fontFamily: MONO, fontSize: 16, fontWeight: 600, color: C.ink, textAlign: "center", width: "100%", height: "100%", minWidth: 0 };
              const target = spec ? (spec.kind === "amrap" ? <span style={{ color: ACC, fontWeight: 700 }}>AMRAP</span> : `${spec.reps} reps`) : prev;
              return (
                <div key={si}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0" }}>
                    <div style={{ width: 26, fontFamily: MONO, fontSize: 13, fontWeight: 600, color: C.faint, textAlign: "left" }}>{si + 1}</div>
                    <div style={{ flex: 1, textAlign: "center", fontFamily: MONO, fontSize: 12, color: C.faint }}>{target}</div>
                    <div style={cell}><input inputMode="decimal" placeholder={bw ? "BW" : "—"} value={sd.w || ""} onChange={(e) => upd(key, "w", e.target.value)} style={inp} /></div>
                    <div style={cell}><input inputMode="numeric" placeholder={spec ? String(spec.reps) : "—"} value={sd.reps || ""} onChange={(e) => upd(key, "reps", e.target.value)} style={inp} /></div>
                    <button onClick={() => (strategy.setRatingKind === "log" ? rate(key, "logged") : setOpenRating(openRating === key ? null : key))} style={{ width: 48, height: 44, borderRadius: 10, cursor: "pointer", border: rated ? "none" : `1.5px solid ${C.line}`, background: rated ? (ratings[rated]?.c || ACC) : C.card, display: "flex", alignItems: "center", justifyContent: "center", WebkitTapHighlightColor: "transparent" }}><Check size={18} color={rated ? "#fff" : C.faint} strokeWidth={rated ? 3 : 2.4} /></button>
                  </div>
                  {openRating === key && (
                    <div style={{ padding: "4px 0 10px" }}><div style={{ fontFamily: MONO, fontSize: 10, color: C.faint, letterSpacing: 1, marginBottom: 8 }}>{strategy.setRatingKind === "hitmiss" ? "DID YOU HIT THE TARGET REPS?" : "HOW HARD WAS THAT SET?"}</div>
                      <div style={{ display: "grid", gridTemplateColumns: ratingKeys.map(() => "1fr").join(" "), gap: 8 }}>{ratingKeys.map((cc) => (<button key={cc} onClick={() => { rate(key, cc); setOpenRating(null); }} style={{ height: 60, borderRadius: 12, border: "none", background: ratings[cc].bg, cursor: "pointer", WebkitTapHighlightColor: "transparent", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3 }}><div style={{ width: 15, height: 15, borderRadius: 8, background: ratings[cc].c }} /><span style={{ fontFamily: SANS, fontSize: 12, fontWeight: 650, color: ratings[cc].c }}>{ratings[cc].label}</span><span style={{ fontFamily: MONO, fontSize: 8.5, color: ratings[cc].c, opacity: .85 }}>{ratings[cc].note}</span></button>))}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </Card>
        );
      })}
      <BigButton tone="dark" onClick={() => setPhase("review")} disabled={doneCount === 0}>Finish workout</BigButton>
      <div style={{ height: 12 }} />
      {confirmDiscard ? (
        <ConfirmPanel title="Discard this workout?" body="Everything you've logged in this session will be deleted. Your previous sessions are unaffected." slideLabel="Slide to discard" onConfirm={discard} onCancel={() => setConfirmDiscard(false)} />
      ) : (
        <button onClick={() => setConfirmDiscard(true)} style={{ width: "100%", height: 48, borderRadius: 13, border: `1.5px solid ${C.line}`, background: C.card, color: C.red, fontFamily: SANS, fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, WebkitTapHighlightColor: "transparent" }}><Trash2 size={15} /> Discard workout</button>
      )}
      {detail && <ExerciseDetail exercise={detail} onClose={() => setDetail(null)} />}
      {calcOpen && <PlateCalculator targetKg={calcOpen.initialKg} equipment={equipment} setEquipment={setEquipment} unit={u} onClose={() => setCalcOpen(null)} />}
    </div>
  );
}

const tagPill = (color, bg) => ({ fontFamily: MONO, fontSize: 10.5, color, background: bg, padding: "3px 8px", borderRadius: 6, letterSpacing: 0.3, whiteSpace: "nowrap" });
function catalogIcon(tags) {
  if (tags.includes("push/pull/legs")) return Activity;
  if (tags.includes("upper/lower")) return Layers;
  if (tags.includes("body part split")) return Target;
  if (tags.includes("531") || tags.includes("gzcl")) return BarChart3;
  if (tags.includes("powerlifting")) return Dumbbell;
  return Zap;
}

/* Programs whose week-to-week numbers are computed from your own logged history — a real training
   max/stage state machine, not just the same generic rep-target/RIR engine with different exercises.
   Surfaced on the catalog card and in ProgramDetail as a distinct "Adaptive" badge. */
const PERIODIZATION_INFO = {
  "531": {
    label: "Adaptive · Training max",
    what: "Four lifts — squat, bench, deadlift, overhead press — each trained once a week across a 4-day split, with one accessory exercise per day.",
    how: "Every set's weight comes from a training max you enter before starting (roughly 90% of your true 1-rep max). Each 4-week wave runs a 5s week, a 3s week, a 1s week, then a lighter deload week, with the last working set of the first three weeks as an all-out AMRAP set. Once a wave finishes, your training max automatically goes up for the next one (+5kg squat/deadlift, +2.5kg bench/OHP) — no re-testing your max.",
  },
  nsuns: {
    label: "Adaptive · Training max",
    what: "A high-frequency 4-day split. Bench is trained twice — once lighter, once as the day's heavy top set — while squat and deadlift each get one heavy day and show up again as a lighter secondary lift on another day.",
    how: "Every set's weight is a percentage of a training max you enter before starting, and that max increases every single week — not every 4 weeks like standard 5/3/1 — for faster week-to-week progression (+5kg squat/deadlift, +2.5kg bench/OHP). The main lift runs 9 sets ramping up to a top single or double (an AMRAP set), then back down for volume; the secondary lift runs 8 lighter sets at a fixed percentage of that same lift's max.",
  },
  gzclp: {
    label: "Adaptive · Learns from your history",
    what: "A 4-day tiered program where each of the 4 main lifts is the primary lift on one day and a secondary lift on another, plus a light accessory lift each day.",
    how: "Onboarding asks for a tested 5-rep max (5RM) per lift — the primary lift starts at 85% of it, the secondary lift at 70% of that same lift's 5RM. From there GZCLP reads what actually happened last session and adjusts automatically. The primary lift runs 5×3+ → 6×2+ → 10×1+: hit every rep and the weight goes up next time on the same stage; miss and it moves to the next stage instead of stalling. Miss the hardest stage and it calls for retesting your 5RM (approximated here as a 10% deload). The secondary lift follows the same stage logic at lower volume (3×10 → 3×8 → 3×6), but restarts about 10kg heavier than its last cycle's starting weight rather than deloading. The accessory lift simply adds weight once a set clears 25 reps.",
  },
};
function ProgressionInfoModal({ template, onClose }) {
  const info = PERIODIZATION_INFO[template.progressionType];
  if (!info) return null;
  const L = ({ children }) => <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 1.2, color: C.faint, marginBottom: 5 }}>{children}</div>;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(10,12,16,0.55)", zIndex: 55, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 430, background: C.card, borderRadius: "20px 20px 0 0", padding: "18px 20px 34px", maxHeight: "82vh", overflowY: "auto" }}>
        <div style={{ width: 38, height: 4, borderRadius: 2, background: C.line, margin: "0 auto 16px" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ fontFamily: SANS, fontSize: 20, fontWeight: 720, color: C.ink, margin: 0 }}>{template.name}</h2>
          <button onClick={onClose} style={miniRound}><X size={18} /></button>
        </div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: MONO, fontSize: 11, color: AI_ACC, letterSpacing: .4, marginTop: 8, background: AI_BG, padding: "4px 10px", borderRadius: 7 }}><Sparkles size={12} /> {info.label.toUpperCase()}</div>
        <div style={{ marginTop: 16, marginBottom: 14 }}>
          <L>HOW THE PROGRAM IS STRUCTURED</L>
          <div style={{ fontFamily: SANS, fontSize: 14, color: C.ink, lineHeight: 1.5 }}>{info.what}</div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <L>HOW THE PROGRESSION WORKS</L>
          <div style={{ fontFamily: SANS, fontSize: 14, color: C.ink, lineHeight: 1.5 }}>{info.how}{template.bbbVolume ? " Boring But Big also tacks on 5 extra sets of 10 reps at 50% of your estimated true 1-rep max (about 5/9 of your training max) after the main work — dropping to 3 sets during the deload week, for added size." : ""}</div>
        </div>
        <div>
          <L>RECOMMENDED TRAINING DAYS</L>
          <div style={{ fontFamily: SANS, fontSize: 14, color: C.ink, lineHeight: 1.5 }}>{template.daysPerWeek} days a week is the sweet spot — this program is built around a {template.daysPerWeek}-day rotation, so that's the pace its progression is tuned for. Fewer days stretches the wave/stage timing out longer than intended; more doubles a lift up before it's meant to come back around.</div>
        </div>
      </div>
    </div>
  );
}

function CatalogCard({ template, added, onOpen }) {
  const Icon = catalogIcon(template.tags);
  const [showInfo, setShowInfo] = useState(false);
  const adaptive = PERIODIZATION_INFO[template.progressionType];
  return (
    <>
      <div onClick={onOpen} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", background: C.card, border: `1px solid ${adaptive ? AI_BORDER : C.line}`, borderRadius: 14, padding: 14, marginBottom: 10, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
        <div style={{ width: 46, height: 46, borderRadius: 12, background: adaptive ? AI_BG : ACC_BG, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon size={20} color={adaptive ? AI_ACC : ACC} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontFamily: SANS, fontSize: 15.5, fontWeight: 650, color: C.ink }}>{template.name}</span>
            {added && <span style={tagPill(C.green, C.greenBg)}>ADDED</span>}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 6, alignItems: "center" }}>
            {adaptive && (
              <button onClick={(e) => { e.stopPropagation(); setShowInfo(true); }} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: AI_BG, color: AI_ACC, border: "none", borderRadius: 6, padding: "3px 8px", fontFamily: MONO, fontSize: 10.5, fontWeight: 600, letterSpacing: 0.3, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}><Sparkles size={11} /> Adaptive</button>
            )}
            <span style={tagPill(ACC, ACC_BG)}>{cap(template.difficulty)}</span>
            {template.tags.slice(0, 2).map((t) => <span key={t} style={tagPill(C.sub, C.page)}>{cap(t)}</span>)}
          </div>
          <div style={{ fontFamily: MONO, fontSize: 10.5, color: C.faint, marginTop: 6 }}>{template.weeks} wks · {template.daysPerWeek} days/wk</div>
        </div>
        <ChevronRight size={20} color={C.faint} style={{ flexShrink: 0 }} />
      </div>
      {showInfo && <ProgressionInfoModal template={template} onClose={() => setShowInfo(false)} />}
    </>
  );
}
const PROGRAM_LIBRARY_LIMIT = 20;
function Programs({ programs, setPrograms, history, maxes, setMaxes, go }) {
  const [openId, setOpenId] = useState(null);
  const [info, setInfo] = useState(null);
  const [q, setQ] = useState("");
  const [tagFilter, setTagFilter] = useState("All");
  const startProgram = (id, scheduleDays, maxesPatch) => setPrograms(programs.map((p) => {
    if (p.id === id) return { ...p, active: true, startedAt: new Date().toISOString(), pausedAt: null, pausedMs: 0, completedAt: null, scheduleDays, ...(maxesPatch || {}) };
    if (p.active) return { ...p, active: false, pausedAt: null, completedAt: new Date().toISOString() };
    return p;
  }));
  const pauseProgram = (id) => setPrograms(programs.map((p) => p.id === id ? { ...p, pausedAt: new Date().toISOString() } : p));
  const resumeProgram = (id) => setPrograms(programs.map((p) => p.id === id ? { ...p, pausedMs: (p.pausedMs || 0) + (Date.now() - new Date(p.pausedAt).getTime()), pausedAt: null } : p));
  const completeProgram = (id) => setPrograms(programs.map((p) => p.id === id ? { ...p, active: false, pausedAt: null, completedAt: new Date().toISOString() } : p));
  const restartProgram = (id) => setPrograms(programs.map((p) => p.id === id ? { ...p, active: true, startedAt: new Date().toISOString(), pausedAt: null, pausedMs: 0, completedAt: null } : p));
  const createProgram = () => { const id = "p" + Date.now(); setPrograms([...programs, { id, name: "New Program", style: "custom", progressionType: "rir", weeks: 12, active: false, startedAt: null, pausedAt: null, pausedMs: 0, scheduleDays: [], lastReadiness: "normal", days: [] }]); setOpenId(id); };
  const addFromTemplate = (template) => {
    const existing = programs.find((p) => p.sourceTemplateId === template.templateId);
    if (existing) { setOpenId(existing.id); return; }
    const id = "p" + Date.now();
    setPrograms([...programs, {
      id, name: template.name, style: template.style, progressionType: template.progressionType,
      tags: template.tags, difficulty: template.difficulty, daysPerWeek: template.daysPerWeek,
      linearConfig: template.linearConfig, bbbVolume: template.bbbVolume, weeks: template.weeks, sourceTemplateId: template.templateId,
      active: false, startedAt: null, pausedAt: null, pausedMs: 0, scheduleDays: [], lastReadiness: "normal",
      days: template.days.map((d) => ({ name: d.name, ex: d.ex.map((e) => ({ ...e, last: { ...e.last } })) })),
    }]);
    setOpenId(id);
  };

  if (openId) {
    const p = programs.find((x) => x.id === openId);
    if (!p) { setOpenId(null); return null; }
    const otherActive = programs.find((x) => x.active && x.id !== openId) || null;
    return <ProgramDetail program={p} activeElsewhere={otherActive} maxes={maxes} setMaxes={setMaxes} history={history} onBack={() => setOpenId(null)} onChange={(np) => setPrograms(programs.map((x) => x.id === openId ? np : x))} onDelete={() => { setPrograms(programs.filter((x) => x.id !== openId)); setOpenId(null); }} onStart={(sd, per) => startProgram(openId, sd, per)} onPause={() => pauseProgram(openId)} onResume={() => resumeProgram(openId)} onComplete={() => completeProgram(openId)} onRestart={() => restartProgram(openId)} />;
  }

  const tagOptions = ["All", ...Array.from(new Set(PROGRAM_CATALOG.flatMap((p) => p.tags))).sort()];
  const matchesQuery = (t) => {
    if (!q) return true;
    const lq = q.toLowerCase();
    if (t.name.toLowerCase().includes(lq)) return true;
    if (t.tags.some((tag) => tag.toLowerCase().includes(lq))) return true;
    return t.days.some((d) => d.ex.some((e) => exName(e.id).toLowerCase().includes(lq)));
  };
  const filtered = PROGRAM_CATALOG
    .filter((t) => matchesQuery(t) && (tagFilter === "All" || t.tags.includes(tagFilter)))
    .sort((a, b) => (PERIODIZATION_INFO[a.progressionType] ? 0 : 1) - (PERIODIZATION_INFO[b.progressionType] ? 0 : 1));
  const shownCatalog = filtered.slice(0, PROGRAM_LIBRARY_LIMIT);

  const activeProg = programs.find((p) => p.active) || null;
  const completedPrograms = programs.filter((p) => p.completedAt).sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  // programs added from the library but never started stay reachable via their "ADDED" badge below,
  // instead of cluttering this list — only custom drafts and legacy stopped programs show here
  const draftPrograms = programs.filter((p) => !p.active && !p.completedAt && !(p.sourceTemplateId && !p.startedAt));

  const renderRow = (p, i) => {
    const runs = sessionsFor(history, p.id).length;
    const meta = isPaused(p) ? `Paused · week ${programWeek(p)}` : p.active ? `Active · week ${programWeek(p)}` : p.completedAt ? `Completed · ${runs} logged` : p.startedAt ? `Stopped · ${runs} logged` : "Not started";
    return (
      <div key={p.id} style={{ background: C.card, borderRadius: 14, border: `${p.active ? 1.5 : 1}px solid ${p.active ? (isPaused(p) ? C.amber : ACC) : C.line}`, padding: 16, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontFamily: MONO, fontSize: 13, color: p.active ? (isPaused(p) ? C.amber : ACC) : C.faint, fontWeight: 700 }}>{String(i + 1).padStart(2, "0")}</div>
          <div onClick={() => setOpenId(p.id)} style={{ flex: 1, cursor: "pointer" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontFamily: SANS, fontSize: 18, fontWeight: 650, color: C.ink }}>{p.name}</span>
              {p.active && <span style={{ fontFamily: MONO, fontSize: 10, background: isPaused(p) ? C.amber : ACC, color: "#fff", padding: "2px 7px", borderRadius: 5, letterSpacing: .5 }}>{isPaused(p) ? "PAUSED" : "ACTIVE"}</span>}
              {p.completedAt && <span style={{ fontFamily: MONO, fontSize: 10, background: C.page, color: C.faint, padding: "2px 7px", borderRadius: 5, letterSpacing: .5 }}>DONE</span>}
            </div>
            <div style={{ fontFamily: SANS, fontSize: 12.5, color: C.sub, marginTop: 4 }}>{meta} · {p.days.length} day{p.days.length !== 1 ? "s" : ""}</div></div>
          <button onClick={() => setInfo(p.style || "custom")} style={{ ...miniRound, border: "none", background: C.page }}><Info size={18} color={C.sub} /></button>
          <button onClick={() => setOpenId(p.id)} style={{ ...miniRound, border: "none", background: "transparent" }}><ChevronRight size={20} color={C.faint} /></button>
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: "6px 18px 24px" }}>
      <PageTitle sub="Real programs · browse or build your own">Programs</PageTitle>

      <SectionLabel>Your programs</SectionLabel>
      {!activeProg && draftPrograms.length === 0 && completedPrograms.length === 0 && (
        <Card style={{ padding: 20, textAlign: "center", marginBottom: 12 }}>
          <div style={{ fontFamily: SANS, fontSize: 14.5, color: C.sub, lineHeight: 1.5 }}>Nothing yet — add a program from the library below, or create your own.</div>
        </Card>
      )}
      {activeProg && renderRow(activeProg, 0)}
      {draftPrograms.length > 0 && <>
        {(activeProg || completedPrograms.length > 0) && <SectionLabel>Not started</SectionLabel>}
        {draftPrograms.map((p, i) => renderRow(p, i))}
      </>}
      {completedPrograms.length > 0 && <>
        <SectionLabel>Completed</SectionLabel>
        {completedPrograms.map((p, i) => renderRow(p, i))}
      </>}

      <div style={{ height: 6 }} />
      <SectionLabel>Programs library</SectionLabel>
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.card, border: `1.5px solid ${C.line}`, borderRadius: 13, padding: "0 14px", height: 54, marginBottom: 12 }}><Search size={18} color={C.faint} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search programs or exercises" style={{ border: "none", outline: "none", fontFamily: SANS, fontSize: 16, flex: 1, height: "100%", color: C.ink, background: "transparent" }} />{q && <X size={18} color={C.faint} onClick={() => setQ("")} style={{ cursor: "pointer" }} />}</div>
      <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} style={{ width: "100%", height: 48, borderRadius: 13, border: `1.5px solid ${C.line}`, background: C.card, padding: "0 14px", fontFamily: SANS, fontSize: 14, fontWeight: 550, color: C.ink, marginBottom: 16, outline: "none", cursor: "pointer" }}>
        {tagOptions.map((t) => <option key={t} value={t}>{t === "All" ? "All types" : cap(t)}</option>)}
      </select>

      {shownCatalog.map((t) => <CatalogCard key={t.templateId} template={t} added={programs.some((p) => p.sourceTemplateId === t.templateId)} onOpen={() => addFromTemplate(t)} />)}
      {filtered.length > PROGRAM_LIBRARY_LIMIT && <div style={{ fontFamily: SANS, fontSize: 12.5, color: C.faint, textAlign: "center", padding: "4px 0 12px" }}>Showing {PROGRAM_LIBRARY_LIMIT} of {filtered.length} — keep typing to narrow it down.</div>}
      {filtered.length === 0 && <div style={{ fontFamily: SANS, fontSize: 13.5, color: C.sub, textAlign: "center", padding: "16px 0" }}>No programs match "{q}".</div>}

      <button onClick={createProgram} style={{ width: "100%", height: 54, borderRadius: 13, border: `1.5px dashed ${C.line}`, background: C.card, color: ACC, fontFamily: SANS, fontSize: 15, fontWeight: 650, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4, WebkitTapHighlightColor: "transparent" }}><Plus size={18} strokeWidth={2.5} /> Create your own program</button>
      {info && <InfoModal styleKey={info} onClose={() => setInfo(null)} />}
    </div>
  );
}

const LIFT_LABELS = { squat: "Squat", bench: "Bench Press", deadlift: "Deadlift", ohp: "Overhead Press" };
function ProgramDetail({ program, activeElsewhere, maxes, setMaxes, history, onBack, onChange, onDelete, onStart, onPause, onResume, onComplete, onRestart }) {
  const [picker, setPicker] = useState(null);
  const [starting, setStarting] = useState(false);
  const [settingMaxes, setSettingMaxes] = useState(false);
  const [maxInputs, setMaxInputs] = useState({});
  const [pending, setPending] = useState(null); // 'pause'|'complete'|'restart'|'delete'|'switch'
  const [pendingScheduleDays, setPendingScheduleDays] = useState(null);
  const [info, setInfo] = useState(false);
  const [progInfo, setProgInfo] = useState(false);
  const [pickDays, setPickDays] = useState(program.scheduleDays?.length ? program.scheduleDays : (DEFAULT_DAYS[Math.min(7, Math.max(1, program.days.length || 3))] || [1, 3, 5]));
  const [detail, setDetail] = useState(null);
  // 500ms is the standard long-press duration on both iOS and Android; 15px tolerance
  // is generous enough to absorb natural hand tremor over that window without letting
  // a real swipe (which covers far more distance, far faster) get mistaken for a hold.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { delay: 500, tolerance: 15 } }));
  const days = program.days;
  const paused = isPaused(program);
  const weeks = program.weeks || 12;
  const strategy = progressionOf(program);
  const neededLiftKeys = [...new Set(days.flatMap((d) => d.ex).map((e) => e.liftKey).filter(Boolean))];
  const rename = (v) => onChange({ ...program, name: v });
  const setWeeks = (w) => onChange({ ...program, weeks: Math.max(1, Math.min(52, w)) });
  const addDay = () => onChange({ ...program, days: [...days, { name: `Day ${days.length + 1}`, ex: [] }] });
  const renameDay = (di, v) => onChange({ ...program, days: days.map((d, i) => i === di ? { ...d, name: v } : d) });
  const removeDay = (di) => onChange({ ...program, days: days.filter((_, i) => i !== di) });
  const removeEx = (di, ei) => onChange({ ...program, days: days.map((d, i) => i === di ? { ...d, ex: d.ex.filter((_, j) => j !== ei) } : d) });
  const setSets = (di, ei, n) => onChange({ ...program, days: days.map((d, i) => i === di ? { ...d, ex: d.ex.map((e, j) => j === ei ? { ...e, sets: Math.max(1, Math.min(8, n)) } : e) } : d) });
  const toggleEx = (di, id) => { const d = days[di]; const has = d.ex.some((e) => e.id === id); onChange({ ...program, days: days.map((x, i) => i === di ? { ...x, ex: has ? x.ex.filter((e) => e.id !== id) : [...x.ex, ex(id, 3)] } : x) }); };
  const toggleDay = (wd) => setPickDays((s) => s.includes(wd) ? s.filter((x) => x !== wd) : [...s, wd].sort());
  const handleDayDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const oldIndex = days.findIndex((d) => dayKey(d) === active.id);
    const newIndex = days.findIndex((d) => dayKey(d) === over.id);
    onChange({ ...program, days: arrayMove(days, oldIndex, newIndex) });
  };
  const handleExDragEnd = (di) => ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const d = days[di];
    const oldIndex = d.ex.findIndex((e) => exKey(e) === active.id);
    const newIndex = d.ex.findIndex((e) => exKey(e) === over.id);
    onChange({ ...program, days: days.map((x, i) => i === di ? { ...x, ex: arrayMove(x.ex, oldIndex, newIndex) } : x) });
  };

  if (picker != null) return <Picker inDay={days[picker].ex.map((e) => e.id)} onToggle={(id) => toggleEx(picker, id)} onBack={() => setPicker(null)} dayName={days[picker].name} />;

  const warn = weeks < 8
    ? { c: C.amber, t: "Short block. Under ~8 weeks can be too short to see a program's full benefit before you switch — beginners usually get the most from an 8–12 week block." }
    : weeks > 12
    ? { c: C.amber, t: "Long block. Past ~12 weeks on one unchanging plan, progress tends to plateau and fatigue/boredom build — a deload or switching programs usually restarts gains." }
    : { c: C.green, t: "Ideal range. 8–12 weeks is a solid block to progress through before changing things up." };

  const confirmStart = (scheduleDays) => {
    const patch = strategy.needsMaxes ? strategy.applyMaxes(program, maxInputs) : null;
    if (strategy.needsMaxes) {
      setMaxes((m) => ({ ...m, ...Object.fromEntries(neededLiftKeys.map((lk) => [lk, { tm: parseFloat(maxInputs[lk]) || 0, updatedAt: new Date().toISOString() }])) }));
    }
    if (activeElsewhere) { setPendingScheduleDays(scheduleDays); onChange({ ...program, ...(patch || {}) }); setPending("switch"); }
    else onStart(scheduleDays, patch);
    setStarting(false);
  };

  const controls = settingMaxes ? (
    <Card style={{ padding: 18, marginBottom: 14, borderColor: ACC }}>
      <div style={{ fontFamily: SANS, fontSize: 15, fontWeight: 700, color: C.ink }}>Set your {strategy.maxesInputLabel || "training max"}es</div>
      <div style={{ fontFamily: SANS, fontSize: 13, color: C.sub, margin: "6px 0 14px", lineHeight: 1.45 }}>{strategy.maxesHint}</div>
      {neededLiftKeys.map((lk) => (
        <div key={lk} style={{ marginBottom: 12 }}>
          <label style={{ fontFamily: SANS, fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 6, display: "block" }}>{LIFT_LABELS[lk] || lk} {strategy.maxesInputLabel || "training max"} (kg)</label>
          <input inputMode="decimal" value={maxInputs[lk] ?? ""} onChange={(e) => setMaxInputs((m) => ({ ...m, [lk]: e.target.value }))} placeholder="e.g. 100" style={{ width: "100%", height: 48, borderRadius: 11, border: `1.5px solid ${C.line}`, background: C.card, padding: "0 14px", fontFamily: MONO, fontSize: 16, color: C.ink, outline: "none" }} />
        </div>
      ))}
      <BigButton tone="acc" disabled={neededLiftKeys.some((lk) => !(parseFloat(maxInputs[lk]) > 0))} onClick={() => { setSettingMaxes(false); setStarting(true); }}>Continue</BigButton>
      <button onClick={() => setSettingMaxes(false)} style={{ width: "100%", height: 44, marginTop: 8, borderRadius: 11, border: "none", background: "transparent", color: C.sub, fontFamily: SANS, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
    </Card>
  ) : starting ? (
    <Card style={{ padding: 18, marginBottom: 14, borderColor: ACC }}>
      <div style={{ fontFamily: SANS, fontSize: 15, fontWeight: 700, color: C.ink }}>Which days will you train?</div>
      <div style={{ fontFamily: SANS, fontSize: 13, color: C.sub, margin: "6px 0 14px", lineHeight: 1.45 }}>Pick the weekdays for this program. You'll train your days <b>in order</b> — Day 1 on your first chosen day, Day 2 on the next, and so on — cycling through the week. ({program.days.length} training days set up.)</div>
      {PERIODIZATION_INFO[program.progressionType] && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 12px", background: AI_BG, borderRadius: 10, marginBottom: 14 }}>
          <Sparkles size={14} color={AI_ACC} style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontFamily: SANS, fontSize: 12.5, color: C.ink, lineHeight: 1.4 }}><b>Recommended: {program.daysPerWeek} days a week.</b> That's the pace this program's progression is tuned for — we've pre-picked a sensible spread below.</div>
        </div>
      )}
      <div style={{ display: "flex", gap: 6, justifyContent: "space-between", marginBottom: 16 }}>
        {[1, 2, 3, 4, 5, 6, 0].map((wd) => { const on = pickDays.includes(wd); return (<button key={wd} onClick={() => toggleDay(wd)} style={{ flex: 1, height: 46, borderRadius: 11, border: `1.5px solid ${on ? ACC : C.line}`, background: on ? ACC : C.card, color: on ? "#fff" : C.sub, fontFamily: SANS, fontSize: 14, fontWeight: 650, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>{WD_LETTER[wd]}</button>); })}
      </div>
      <BigButton tone="acc" disabled={pickDays.length === 0} onClick={() => confirmStart([...pickDays].sort())}>Start on {pickDays.length} day{pickDays.length !== 1 ? "s" : ""}/week</BigButton>
      <button onClick={() => setStarting(false)} style={{ width: "100%", height: 44, marginTop: 8, borderRadius: 11, border: "none", background: "transparent", color: C.sub, fontFamily: SANS, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
    </Card>
  ) : (
    <div style={{ marginBottom: 14, display: "grid", gap: 10 }}>
      {!program.active && <BigButton tone="acc" disabled={days.length === 0} onClick={() => {
        if (strategy.needsMaxes) {
          setMaxInputs(Object.fromEntries(neededLiftKeys.map((lk) => [lk, program.periodization?.[lk]?.tm || maxes?.[lk]?.tm || ""])));
          setSettingMaxes(true);
        } else setStarting(true);
      }}><Play size={16} /> {program.startedAt ? "Start again" : "Start program"}</BigButton>}
      {program.active && !paused && <div style={{ display: "flex", gap: 10 }}><BigButton tone="ghost" onClick={() => setPending("pause")}><Pause size={16} /> Pause</BigButton><BigButton tone="dark" onClick={() => setPending("complete")}><Square size={16} /> Finish</BigButton></div>}
      {paused && <BigButton tone="acc" onClick={onResume}><Play size={16} /> Resume program</BigButton>}
      {program.active && <BigButton tone="ghost" onClick={() => setPending("restart")}><RotateCcw size={16} /> Start over</BigButton>}
    </div>
  );

  return (
    <div style={{ padding: "6px 18px 24px" }}>
      <button onClick={onBack} style={backBtn}><ChevronLeft size={20} /> Programs</button>
      <Eyebrow>{paused ? `Paused · week ${programWeek(program)}` : program.active ? `Active · ${strategy.weekLabel(program, { sessionCount: sessionsFor(history, program.id).length, program }) || `${durStr(program)} in`}` : program.completedAt ? `Completed ${fmtDate(program.completedAt)}` : program.startedAt ? "Stopped" : "Not started"}</Eyebrow>
      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "6px 0 14px" }}>
        <input value={program.name} onChange={(e) => rename(e.target.value)} style={{ flex: 1, minWidth: 0, fontFamily: SANS, fontSize: 28, fontWeight: 700, color: C.ink, letterSpacing: -0.6, border: "none", outline: "none", background: "transparent", borderBottom: `1.5px dashed ${C.line}`, paddingBottom: 4 }} />
        {PERIODIZATION_INFO[program.progressionType] && <button onClick={() => setProgInfo(true)} style={{ ...miniRound, border: "none", background: AI_BG }}><Sparkles size={18} color={AI_ACC} /></button>}
        <button onClick={() => setInfo(true)} style={{ ...miniRound, border: "none", background: C.page }}><Info size={18} color={C.sub} /></button>
      </div>

      {/* program length + science warning */}
      <Card style={{ padding: "12px 16px 14px", marginBottom: 12 }}>
        <Row label="Program length" sub="Weeks before it prompts a switch" last>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}><MiniStep onClick={() => setWeeks(weeks - 1)}><Minus size={16} strokeWidth={2.5} /></MiniStep><span style={{ fontFamily: MONO, fontSize: 15, color: C.ink, minWidth: 58, textAlign: "center" }}>{weeks} wks</span><MiniStep onClick={() => setWeeks(weeks + 1)}><Plus size={16} strokeWidth={2.5} /></MiniStep></div>
        </Row>
        <div style={{ display: "flex", gap: 9, alignItems: "flex-start", marginTop: 4, padding: "10px 12px", background: warn.c === C.green ? C.greenBg : C.amberBg, borderRadius: 10 }}>
          <Info size={15} color={warn.c} style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontFamily: SANS, fontSize: 12.5, color: C.ink, lineHeight: 1.45 }}>{warn.t}</div>
        </div>
      </Card>

      {!program.active && <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "0 2px", margin: "0 0 12px" }}><span style={{ fontFamily: SANS, fontSize: 12.5, color: C.sub }}>Set up your training days below, then hit <b style={{ color: C.ink }}>Start</b> at the bottom.</span></div>}

      {days.length === 0 && <Card style={{ padding: 26, textAlign: "center", marginBottom: 12 }}><div style={{ fontFamily: SANS, fontSize: 15, fontWeight: 600, color: C.ink }}>No training days yet</div><div style={{ fontFamily: SANS, fontSize: 13, color: C.sub, marginTop: 6 }}>Add a day, then fill it with exercises.</div></Card>}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDayDragEnd}>
        <SortableContext items={days.map(dayKey)} strategy={verticalListSortingStrategy}>
          {days.map((d, di) => (
            <Sortable key={dayKey(d)} id={dayKey(d)}>
              {({ attributes, listeners, isDragging }) => (
                <div style={{ marginBottom: 12 }}>
                  <SwipeToDelete onDelete={() => removeDay(di)} disabled={isDragging} radius={14} dragProps={{ attributes, onPointerDown: listeners.onPointerDown }}>
                    <Card style={{ padding: 16 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: d.ex.length ? 12 : 8 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: 1.2, color: ACC, fontWeight: 600 }}>WORKOUT {WLETTER[di] || di + 1}</div>
                          <input value={d.name} onChange={(e) => renameDay(di, e.target.value)} onPointerDown={(e) => e.stopPropagation()} style={{ width: "100%", fontFamily: SANS, fontSize: 16, fontWeight: 650, color: C.ink, border: "none", outline: "none", background: "transparent", marginTop: 2 }} />
                        </div>
                      </div>
                      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleExDragEnd(di)}>
                        <SortableContext items={d.ex.map(exKey)} strategy={verticalListSortingStrategy}>
                          {d.ex.map((e, ei) => {
                            const full = exFull(e.id);
                            return (
                              <Sortable key={exKey(e)} id={exKey(e)}>
                                {({ attributes: exAttrs, listeners: exListeners, isDragging: exDragging }) => (
                                  <SwipeToDelete onDelete={() => removeEx(di, ei)} disabled={exDragging} hint={di === 0 && ei === 0} dragProps={{ attributes: exAttrs, onPointerDown: exListeners.onPointerDown }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 0", borderTop: `1px solid ${C.lineSoft}`, background: C.card }}>
                                      <ExerciseThumb exercise={full} onOpen={setDetail} size={36} />
                                      <div onClick={() => setDetail(full)} style={{ flex: 1, minWidth: 0, cursor: "pointer" }}><div style={{ fontFamily: SANS, fontSize: 14.5, fontWeight: 550, color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{full.name}</div><div style={{ fontFamily: MONO, fontSize: 10, color: C.faint, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{full.bodyPart.toUpperCase()}</div></div>
                                      <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}><button onClick={() => setSets(di, ei, setCount(e) - 1)} style={{ ...miniRound, width: 27, height: 27 }}><Minus size={13} strokeWidth={2.5} /></button><span style={{ fontFamily: MONO, fontSize: 12, color: C.ink, minWidth: 42, textAlign: "center" }}>{setCount(e)} set{setCount(e) !== 1 ? "s" : ""}</span><button onClick={() => setSets(di, ei, setCount(e) + 1)} style={{ ...miniRound, width: 27, height: 27 }}><Plus size={13} strokeWidth={2.5} /></button></div>
                                    </div>
                                  </SwipeToDelete>
                                )}
                              </Sortable>
                            );
                          })}
                        </SortableContext>
                      </DndContext>
                      <button onClick={() => setPicker(di)} style={{ width: "100%", height: 46, borderRadius: 11, border: `1.5px dashed ${C.line}`, background: C.card, color: ACC, fontFamily: SANS, fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: d.ex.length ? 12 : 0, WebkitTapHighlightColor: "transparent" }}><Plus size={16} strokeWidth={2.5} /> Add exercise</button>
                    </Card>
                  </SwipeToDelete>
                </div>
              )}
            </Sortable>
          ))}
        </SortableContext>
      </DndContext>
      {days.length > 0 && <div style={{ fontFamily: SANS, fontSize: 11.5, color: C.faint, padding: "0 4px", margin: "0 0 12px", lineHeight: 1.5 }}>Swipe right to remove a day or exercise, or press and hold to reorder it. You'll train Day 1 → Day 2 → … in order, one per training day you pick when you start.</div>}
      <button onClick={addDay} style={{ width: "100%", height: 54, borderRadius: 13, border: "none", background: C.ink, color: "#fff", fontFamily: SANS, fontSize: 15, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4, marginBottom: 18, WebkitTapHighlightColor: "transparent" }}><Plus size={18} strokeWidth={2.5} /> Add training day</button>

      {pending === "pause" && <ConfirmPanel title="Pause this program?" body="Your progress and stats stay intact — the week counter and consistency freeze until you resume. Ideal for a holiday." slideLabel="Slide to pause" color={C.amber} onConfirm={() => { onPause(); setPending(null); }} onCancel={() => setPending(null)} />}
      {pending === "complete" && <ConfirmPanel title="Finish this program?" body="This ends the current block and moves it to your completed programs. Your logged sessions stay in your all-time report, and you can add it again later." slideLabel="Slide to finish" onConfirm={() => { onComplete(); setPending(null); }} onCancel={() => setPending(null)} />}
      {pending === "restart" && <ConfirmPanel title="Start over from week 1?" body="Resets the week counter to week 1 from today (useful if you've changed the plan). Your past logged sessions remain in your all-time report." slideLabel="Slide to start over" color={ACC} onConfirm={() => { onRestart(); setPending(null); }} onCancel={() => setPending(null)} />}
      {pending === "switch" && <ConfirmPanel title={`Switch to ${program.name}?`} body={`This finishes "${activeElsewhere?.name}" — it moves to your completed programs — and starts "${program.name}" instead.`} slideLabel="Slide to switch" color={ACC} onConfirm={() => { onStart(pendingScheduleDays); setPending(null); setPendingScheduleDays(null); }} onCancel={() => { setPending(null); setPendingScheduleDays(null); }} />}

      {!pending && controls}

      {pending === "delete" ? (
        <ConfirmPanel title="Delete this program?" body="This permanently removes the program and its layout. Sessions already logged stay in your all-time report." slideLabel="Slide to delete" onConfirm={onDelete} onCancel={() => setPending(null)} />
      ) : (
        <button onClick={() => setPending("delete")} style={{ width: "100%", height: 50, borderRadius: 13, border: `1.5px solid ${C.line}`, background: C.card, color: C.red, fontFamily: SANS, fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, WebkitTapHighlightColor: "transparent" }}><Trash2 size={15} /> Delete program</button>
      )}
      {info && <InfoModal styleKey={program.style || "custom"} onClose={() => setInfo(false)} />}
      {progInfo && <ProgressionInfoModal template={program} onClose={() => setProgInfo(false)} />}
      {detail && <ExerciseDetail exercise={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

function ExerciseThumb({ exercise, onOpen, size = 44 }) {
  return (
    <div onClick={(ev) => { ev.stopPropagation(); onOpen(exercise); }} style={{ position: "relative", width: size, height: size, flexShrink: 0, cursor: "pointer" }}>
      {exercise.image ? <img src={exercise.image} alt="" loading="lazy" style={{ width: size, height: size, borderRadius: 9, objectFit: "cover", background: C.page, display: "block" }} /> : <div style={{ width: size, height: size, borderRadius: 9, background: C.page, display: "flex", alignItems: "center", justifyContent: "center" }}><Dumbbell size={size * 0.4} color={C.faint} /></div>}
      {exercise.gif && <div style={{ position: "absolute", inset: 0, background: "rgba(18,20,26,0.28)", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ width: 16, height: 16, borderRadius: 8, background: "rgba(255,255,255,0.92)", display: "flex", alignItems: "center", justifyContent: "center" }}><Play size={8} color={C.ink} fill={C.ink} /></div></div>}
    </div>
  );
}
function ExerciseDetail({ exercise, inDay, onToggle, onClose }) {
  const on = inDay?.includes(exercise.id);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(10,12,16,0.55)", zIndex: 60, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 430, background: C.card, borderRadius: "20px 20px 0 0", padding: "18px 20px 34px", maxHeight: "86vh", overflowY: "auto" }}>
        <div style={{ width: 38, height: 4, borderRadius: 2, background: C.line, margin: "0 auto 16px" }} />
        {exercise.gif ? <img src={exercise.gif} alt="" style={{ width: "100%", borderRadius: 12, display: "block", background: C.page }} /> : <div style={{ width: "100%", height: 160, borderRadius: 12, background: C.page, display: "flex", alignItems: "center", justifyContent: "center" }}><Dumbbell size={28} color={C.faint} /></div>}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14 }}>
          <h2 style={{ fontFamily: SANS, fontSize: 20, fontWeight: 700, color: C.ink, margin: 0 }}>{exercise.name}</h2>
          <button onClick={onClose} style={miniRound}><X size={18} /></button>
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 0.6, color: ACC, background: ACC_BG, padding: "4px 9px", borderRadius: 6 }}>{exercise.bodyPart.toUpperCase()}</span>
          <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 0.6, color: C.sub, background: C.page, padding: "4px 9px", borderRadius: 6 }}>{exercise.equipment.toUpperCase()}</span>
        </div>
        {exercise.steps?.length > 0 && (
          <>
            <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 1, color: C.faint, marginTop: 16 }}>HOW TO</div>
            <ol style={{ margin: "8px 0 0", paddingLeft: 18, fontFamily: SANS, fontSize: 13.5, color: C.ink, lineHeight: 1.6 }}>
              {exercise.steps.map((s, i) => <li key={i} style={{ marginBottom: 4 }}>{s}</li>)}
            </ol>
          </>
        )}
        {onToggle && (
          <div style={{ marginTop: 16 }}>
            {on ? (
              <BigButton tone="ghost" onClick={() => { onToggle(exercise.id); onClose(); }}>Remove from workout</BigButton>
            ) : (
              <BigButton tone="acc" onClick={() => { onToggle(exercise.id); onClose(); }}>Add to workout</BigButton>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ================================================================
   PLATE CALCULATOR
================================================================ */
const PLATE_SHADES = [C.graphite, C.ink, "#3A3F4B", "#565C68", C.sub, "#9096A0", C.faint];

function EquipmentManager({ equipment, setEquipment, unit, onClose }) {
  const u = unit;
  const [addStr, setAddStr] = useState("");
  const toKg = (n) => (u === "lb" ? n / KG_TO_LB : n);
  const plates = [...equipment.plates].sort((a, b) => b.kg - a.kg);
  const setBar = (s) => { const n = parseFloat(s); if (!isNaN(n) && n > 0) setEquipment((e) => ({ ...e, barKg: toKg(n) })); };
  const bump = (kg, d) => setEquipment((e) => ({ ...e, plates: e.plates.map((p) => p.kg === kg ? { ...p, pairsOwned: Math.max(0, p.pairsOwned + d) } : p) }));
  const removePlate = (kg) => setEquipment((e) => ({ ...e, plates: e.plates.filter((p) => p.kg !== kg) }));
  const addPlate = () => {
    const n = parseFloat(addStr);
    if (!isNaN(n) && n > 0) {
      const kg = Math.round(toKg(n) * 100) / 100;
      setEquipment((e) => (e.plates.some((p) => p.kg === kg) ? e : { ...e, plates: [...e.plates, { kg, pairsOwned: 1 }] }));
      setAddStr("");
    }
  };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(10,12,16,0.55)", zIndex: 62, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 430, background: C.card, borderRadius: "20px 20px 0 0", padding: "18px 20px 34px", maxHeight: "86vh", overflowY: "auto" }}>
        <div style={{ width: 38, height: 4, borderRadius: 2, background: C.line, margin: "0 auto 16px" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ fontFamily: SANS, fontSize: 20, fontWeight: 700, color: C.ink, margin: 0 }}>Your equipment</h2>
          <button onClick={onClose} style={miniRound}><X size={18} /></button>
        </div>
        <div style={{ fontFamily: SANS, fontSize: 13, color: C.sub, margin: "6px 0 4px", lineHeight: 1.45 }}>What you actually own — the plate calculator only suggests plates you have.</div>
        <Card style={{ padding: "4px 16px", margin: "12px 0" }}>
          <Row label="Barbell weight" last><EditableNumber key={`bar${u}`} initial={wStr(equipment.barKg, u)} onCommit={setBar} suffix={u} /></Row>
        </Card>
        <SectionLabel>Plates you own <span style={{ textTransform: "none", letterSpacing: 0, color: C.faint }}>· per side</span></SectionLabel>
        <Card style={{ padding: "4px 16px", marginBottom: 12 }}>
          {plates.map((p, i) => (
            <Row key={p.kg} label={`${wStr(p.kg, u)} ${u}`} last={i === plates.length - 1}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <MiniStep onClick={() => bump(p.kg, -1)}><Minus size={16} strokeWidth={2.5} /></MiniStep>
                <span style={{ fontFamily: MONO, fontSize: 15, color: C.ink, minWidth: 22, textAlign: "center" }}>{p.pairsOwned}</span>
                <MiniStep onClick={() => bump(p.kg, 1)}><Plus size={16} strokeWidth={2.5} /></MiniStep>
                <button onClick={() => removePlate(p.kg)} style={{ ...miniRound, width: 30, height: 30, border: "none" }}><X size={15} color={C.faint} /></button>
              </div>
            </Row>
          ))}
          {!plates.length && <div style={{ padding: "14px 0", fontFamily: SANS, fontSize: 13.5, color: C.sub, textAlign: "center" }}>No plates added yet.</div>}
        </Card>
        <div style={{ display: "flex", gap: 8 }}>
          <input inputMode="decimal" value={addStr} onChange={(e) => setAddStr(e.target.value)} placeholder={`Add a plate size (${u})`} style={{ flex: 1, minWidth: 0, height: 48, borderRadius: 11, border: `1.5px solid ${C.line}`, background: C.card, padding: "0 14px", fontFamily: MONO, fontSize: 15, color: C.ink, outline: "none" }} />
          <button onClick={addPlate} style={{ width: 48, height: 48, borderRadius: 11, border: "none", background: C.ink, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", WebkitTapHighlightColor: "transparent" }}><Plus size={20} /></button>
        </div>
      </div>
    </div>
  );
}

function PlateCalculator({ targetKg: initialKg, equipment, setEquipment, unit, onClose }) {
  const u = unit;
  const [targetStr, setTargetStr] = useState(initialKg > 0 ? wStr(initialKg, u) : "");
  const [editingEquip, setEditingEquip] = useState(false);
  const n = parseFloat(targetStr);
  const targetKg = n > 0 ? (u === "lb" ? n / KG_TO_LB : n) : 0;
  const result = calcPlateLoad(targetKg, equipment.barKg, equipment.plates);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(10,12,16,0.55)", zIndex: 61, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 430, background: C.card, borderRadius: "20px 20px 0 0", padding: "18px 20px 34px", maxHeight: "86vh", overflowY: "auto" }}>
        <div style={{ width: 38, height: 4, borderRadius: 2, background: C.line, margin: "0 auto 16px" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ fontFamily: SANS, fontSize: 20, fontWeight: 700, color: C.ink, margin: 0 }}>Plate calculator</h2>
          <button onClick={onClose} style={miniRound}><X size={18} /></button>
        </div>
        <div style={{ margin: "16px 0" }}>
          <label style={{ fontFamily: SANS, fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 6, display: "block" }}>Target weight</label>
          <div style={{ display: "flex", alignItems: "center", gap: 8, height: 56, background: C.page, borderRadius: 12, padding: "0 16px" }}>
            <input inputMode="decimal" autoFocus value={targetStr} onChange={(e) => setTargetStr(e.target.value)} placeholder="0" style={{ flex: 1, minWidth: 0, height: "100%", border: "none", outline: "none", background: "transparent", fontFamily: MONO, fontSize: 28, fontWeight: 700, color: C.ink }} />
            <span style={{ fontFamily: MONO, fontSize: 14, color: C.sub }}>{u}</span>
          </div>
        </div>
        {targetKg > 0 && (
          result.belowBar ? (
            <div style={{ padding: "12px 14px", background: C.amberBg, borderRadius: 11, fontFamily: SANS, fontSize: 13, color: C.ink, marginBottom: 14 }}>Target is lighter than the bar itself ({wStr(equipment.barKg, u)}{u}) — no plates needed.</div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 4, padding: "18px 4px", overflowX: "auto" }}>
                <div style={{ width: 12, height: 64, background: C.ink, borderRadius: "3px 0 0 3px", flexShrink: 0 }} />
                {result.plates.flatMap((p, gi) => Array.from({ length: p.count }, (_, i) => (
                  <div key={`${gi}-${i}`} style={{
                    width: Math.max(16, Math.min(28, 12 + p.kg * 0.5)),
                    height: Math.max(44, Math.min(92, 40 + p.kg * 2)),
                    background: PLATE_SHADES[gi % PLATE_SHADES.length],
                    borderRadius: 4, flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <span style={{ writingMode: "vertical-rl", fontFamily: MONO, fontSize: 10, color: "#fff", fontWeight: 700 }}>{p.kg}</span>
                  </div>
                )))}
                {!result.plates.length && <div style={{ fontFamily: SANS, fontSize: 13, color: C.faint, padding: "0 8px" }}>Just the bar</div>}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                {result.plates.map((p) => (
                  <span key={p.kg} style={{ fontFamily: MONO, fontSize: 12.5, background: C.page, borderRadius: 8, padding: "6px 11px", color: C.ink, fontWeight: 600 }}>{p.count}× {wStr(p.kg, u)}{u}</span>
                ))}
              </div>
              <Card style={{ padding: 16, marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontFamily: SANS, fontSize: 13.5, color: C.sub }}>Bar {wStr(equipment.barKg, u)}{u} + plates per side</div>
                  <div style={{ fontFamily: MONO, fontSize: 20, fontWeight: 700, color: C.ink }}>{wStr(result.achievedTotal, u)} {u}</div>
                </div>
                {!result.exact && (
                  <div style={{ marginTop: 10, padding: "10px 12px", background: C.amberBg, borderRadius: 10, fontFamily: SANS, fontSize: 12.5, color: C.ink, lineHeight: 1.4 }}>Closest with your plates — {wStr(result.shortBy, u)}{u} short of {targetStr}{u}.</div>
                )}
              </Card>
            </>
          )
        )}
        <button onClick={() => setEditingEquip(true)} style={{ width: "100%", height: 44, borderRadius: 11, border: `1.5px solid ${C.line}`, background: C.card, color: C.ink, fontFamily: SANS, fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, WebkitTapHighlightColor: "transparent" }}><Settings2 size={15} /> Edit my equipment</button>
      </div>
      {editingEquip && <EquipmentManager equipment={equipment} setEquipment={setEquipment} unit={u} onClose={() => setEditingEquip(false)} />}
    </div>
  );
}

const PICKER_LIMIT = 60;
function Picker({ inDay, onToggle, onBack, dayName }) {
  const [q, setQ] = useState(""); const [equip, setEquip] = useState("All");
  const [detail, setDetail] = useState(null);
  const matched = EXERCISE_DB.filter((e) => (equip === "All" || e.equipment === equip) && e.name.toLowerCase().includes(q.toLowerCase()));
  const filtered = matched.slice(0, PICKER_LIMIT);
  return (
    <div style={{ padding: "6px 18px 24px" }}>
      <button onClick={onBack} style={backBtn}><ChevronLeft size={20} /> {dayName}</button>
      <PageTitle sub={`Exercise library · ${EXERCISE_DB.length} exercises`}>Add exercise</PageTitle>
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.card, border: `1.5px solid ${C.line}`, borderRadius: 13, padding: "0 14px", height: 54, marginBottom: 12 }}><Search size={18} color={C.faint} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search exercises" style={{ border: "none", outline: "none", fontFamily: SANS, fontSize: 16, flex: 1, height: "100%", color: C.ink, background: "transparent" }} />{q && <X size={18} color={C.faint} onClick={() => setQ("")} style={{ cursor: "pointer" }} />}</div>
      <div style={{ display: "flex", gap: 7, overflowX: "auto", marginBottom: 16, paddingBottom: 2 }}>{EQUIP_OPTIONS.map((eq) => (<button key={eq} onClick={() => setEquip(eq)} style={{ whiteSpace: "nowrap", padding: "8px 15px", borderRadius: 20, cursor: "pointer", border: `1.5px solid ${equip === eq ? C.ink : C.line}`, background: equip === eq ? C.ink : C.card, color: equip === eq ? "#fff" : C.sub, fontFamily: SANS, fontSize: 13, fontWeight: 550, WebkitTapHighlightColor: "transparent" }}>{eq === "All" ? eq : cap(eq)}</button>))}</div>
      {filtered.map((e) => { const on = inDay.includes(e.id); return (
        <button key={e.id} onClick={() => onToggle(e.id)} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", background: C.card, border: `1px solid ${on ? ACC : C.line}`, borderRadius: 13, padding: "10px 16px", marginBottom: 8, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
          <ExerciseThumb exercise={e} onOpen={setDetail} />
          <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontFamily: SANS, fontSize: 15, fontWeight: 600, color: C.ink }}>{e.name}</div><div style={{ fontFamily: MONO, fontSize: 10, color: C.faint, marginTop: 3 }}>{e.bodyPart.toUpperCase()} · {e.equipment.toUpperCase()}</div></div>
          <div style={{ width: 30, height: 30, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", background: on ? ACC : C.card, border: `1.5px solid ${on ? ACC : C.line}`, flexShrink: 0 }}>{on ? <Check size={16} color="#fff" strokeWidth={3} /> : <Plus size={16} color={C.faint} />}</div>
        </button>
      ); })}
      {matched.length > PICKER_LIMIT && <div style={{ fontFamily: SANS, fontSize: 12.5, color: C.faint, textAlign: "center", padding: "8px 0 0" }}>Showing {PICKER_LIMIT} of {matched.length} matches — keep typing to narrow it down.</div>}
      {matched.length === 0 && <div style={{ fontFamily: SANS, fontSize: 13.5, color: C.sub, textAlign: "center", padding: "20px 0" }}>No exercises match "{q}".</div>}
      {detail && <ExerciseDetail exercise={detail} inDay={inDay} onToggle={onToggle} onClose={() => setDetail(null)} />}
    </div>
  );
}

/* ================================================================
   PROFILE
================================================================ */
const cmToFtIn = (cm) => { const t = cm / 2.54; const f = Math.floor(t / 12); const i = Math.round(t - f * 12); return `${f}'${i}"`; };
function Profile({ profile, setProfile, programs, history, weightLog, onReset }) {
  const [view, setView] = useState("main");
  const [confirmReset, setConfirmReset] = useState(false);
  const setP = (k, v) => setProfile((p) => ({ ...p, [k]: v }));
  const u = profile.unit;
  const active = activeProgram(programs);
  const cur = lastWeight(weightLog) ?? profile.currentKg;
  const g = deriveGoal(profile, cur);

  if (view === "report") return <StatsView sessions={history} unit={u} title="All-time report" sub={`Since ${fmtDate(profile.createdAt)}`} onBack={() => setView("main")} />;

  const weeksToGoal = g.type !== "maintain" && g.mag > 0 ? Math.ceil(Math.abs(g.goal - cur) / g.mag) : null;

  return (
    <div style={{ padding: "6px 18px 24px" }}>
      <PageTitle sub="Account">Profile</PageTitle>
      <Card style={{ padding: 20, marginBottom: 16, display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ width: 60, height: 60, borderRadius: 30, background: C.graphite, color: C.onDark, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SANS, fontSize: 22, fontWeight: 650 }}>{(profile.name || "?").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}</div>
        <div style={{ flex: 1 }}><div style={{ display: "flex", alignItems: "center", gap: 6 }}><input value={profile.name || ""} onChange={(e) => setP("name", e.target.value)} style={{ border: "none", outline: "none", background: "transparent", fontFamily: SANS, fontSize: 19, fontWeight: 680, color: C.ink, width: "100%" }} /><Pencil size={13} color={C.faint} /></div><div style={{ fontFamily: MONO, fontSize: 12, color: C.sub, marginTop: 2 }}>Age {ageFrom(profile.birthDate)} · since {fmtDate(profile.createdAt)}</div></div>
      </Card>

      <button onClick={() => setView("report")} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: 16, marginBottom: 16, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}><div style={{ width: 40, height: 40, borderRadius: 11, background: ACC_BG, display: "flex", alignItems: "center", justifyContent: "center" }}><BarChart3 size={20} color={ACC} /></div><div style={{ flex: 1 }}><div style={{ fontFamily: SANS, fontSize: 15, fontWeight: 650, color: C.ink }}>All-time report</div><div style={{ fontFamily: SANS, fontSize: 12.5, color: C.sub, marginTop: 2 }}>Every stat since you started</div></div><ChevronRight size={20} color={C.faint} /></button>

      <SectionLabel>Your details <span style={{ textTransform: "none", letterSpacing: 0, color: C.faint }}>· tap a value to edit</span></SectionLabel>
      <Card style={{ padding: "4px 16px", marginBottom: 16 }}>
        <Row label="Date of birth" sub={`Age ${ageFrom(profile.birthDate)}`}><div style={{ maxWidth: 210 }}><DOBPicker value={profile.birthDate} onChange={(v) => setP("birthDate", v)} /></div></Row>
        <Row label="Height">{profile.heightUnit === "ft" ? <span style={{ fontFamily: MONO, fontSize: 15, color: C.ink }}>{cmToFtIn(profile.heightCm)}</span> : <EditableNumber key="h" initial={String(profile.heightCm)} onCommit={(s) => { const n = parseFloat(s); if (!isNaN(n) && n > 0) setP("heightCm", Math.round(n)); }} suffix="cm" />}</Row>
        <Row label="Current weight" sub="From your latest weigh-in"><span style={{ fontFamily: MONO, fontSize: 15, color: C.ink }}>{wStr(cur, u)} {u}</span></Row>
        <Row label="Goal weight" last><EditableNumber key={`g${u}`} initial={wStr(profile.goalKg, u)} onCommit={(s) => { const n = parseFloat(s); if (!isNaN(n) && n > 0) setP("goalKg", u === "lb" ? n / KG_TO_LB : n); }} suffix={u} /></Row>
      </Card>

      <SectionLabel icon={<Target size={13} />}>Goal <span style={{ textTransform: "none", letterSpacing: 0, color: C.faint }}>· set automatically from your weights</span></SectionLabel>
      <Card style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ padding: "8px 12px", borderRadius: 9, background: g.type === "shred" ? C.greenBg : g.type === "bulk" ? ACC_BG : C.lineSoft }}><span style={{ fontFamily: SANS, fontSize: 14, fontWeight: 700, color: g.type === "shred" ? C.green : g.type === "bulk" ? ACC : C.sub }}>{GOAL_WORD[g.type]}</span></div>
          <div style={{ fontFamily: MONO, fontSize: 13, color: C.sub }}>{wStr(cur, u)} → {wStr(g.goal, u)} {u}</div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.lineSoft}` }}>
          <div><div style={{ fontFamily: SANS, fontSize: 14, fontWeight: 600, color: C.ink }}>Weekly rate</div><div style={{ fontFamily: SANS, fontSize: 12, color: C.sub, marginTop: 2 }}>{weeksToGoal ? `≈ ${weeksToGoal} weeks to goal` : "Drives your goal line"}</div></div>
          {g.type === "maintain" ? <span style={{ fontFamily: MONO, fontSize: 15, color: C.ink }}>Maintain</span> : <div style={{ display: "flex", alignItems: "center", gap: 10 }}><MiniStep onClick={() => setP("rateMag", Math.max(0.1, +(g.mag - 0.05).toFixed(2)))}><Minus size={16} strokeWidth={2.5} /></MiniStep><span style={{ fontFamily: MONO, fontSize: 14, color: C.ink, minWidth: 84, textAlign: "center" }}>{g.type === "shred" ? "−" : "+"}{wStr(g.mag, u)} {u}/wk</span><MiniStep onClick={() => setP("rateMag", +(g.mag + 0.05).toFixed(2))}><Plus size={16} strokeWidth={2.5} /></MiniStep></div>}
        </div>
        <div style={{ fontFamily: SANS, fontSize: 11.5, color: C.faint, marginTop: 12, lineHeight: 1.45 }}>Evidence-based: fat loss ~0.5–1{u === "lb" ? "lb" : "kg (0.5–1%)"}/wk keeps muscle; lean bulk ~0.25{u === "lb" ? "lb" : "kg"}/wk minimises fat gain.</div>
      </Card>

      <SectionLabel>Units</SectionLabel>
      <Card style={{ padding: "4px 16px", marginBottom: 16 }}>
        <Row label="Weight"><div style={{ width: 132 }}><Segmented small options={[{ v: "kg", l: "kg" }, { v: "lb", l: "lb" }]} value={u} onChange={(v) => setP("unit", v)} /></div></Row>
        <Row label="Height" last><div style={{ width: 132 }}><Segmented small options={[{ v: "cm", l: "cm" }, { v: "ft", l: "ft / in" }]} value={profile.heightUnit} onChange={(v) => setP("heightUnit", v)} /></div></Row>
      </Card>

      <SectionLabel icon={<Clock size={13} />}>Daily reminder</SectionLabel>
      <Card style={{ padding: "4px 16px", marginBottom: 16 }}>
        <Row label="Reminder" sub="Nudge to log your weigh-in"><Switch on={profile.reminderOn} onToggle={() => setP("reminderOn", !profile.reminderOn)} /></Row>
        <Row label="Time" last><div style={pill}><input type="time" value={profile.reminderTime || "07:30"} onChange={(e) => setP("reminderTime", e.target.value)} style={{ border: "none", outline: "none", background: "transparent", fontFamily: MONO, fontSize: 14, color: C.ink }} /><Pencil size={12} color={C.faint} /></div></Row>
        <div style={{ fontFamily: SANS, fontSize: 11.5, color: C.faint, padding: "0 0 12px", lineHeight: 1.45 }}>Note: real phone notifications need the installed app version — this saves your preferred time for now.</div>
      </Card>

      <SectionLabel>Data</SectionLabel>
      <Card style={{ padding: confirmReset ? 16 : "4px 16px", marginBottom: 16 }}>
        {confirmReset ? (
          <><div style={{ fontFamily: SANS, fontSize: 15, fontWeight: 700, color: C.ink }}>Erase all data?</div><div style={{ fontFamily: SANS, fontSize: 13, color: C.sub, margin: "6px 0 14px", lineHeight: 1.5 }}>This wipes your profile, weigh-ins, programs and history and starts you fresh. This cannot be undone.</div><SlideConfirm label="Slide to erase everything" onConfirm={onReset} /><button onClick={() => setConfirmReset(false)} style={{ width: "100%", height: 44, marginTop: 8, borderRadius: 11, border: "none", background: "transparent", color: C.sub, fontFamily: SANS, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Cancel</button></>
        ) : (
          <button onClick={() => setConfirmReset(true)} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: "none", border: "none", cursor: "pointer", padding: "16px 0", WebkitTapHighlightColor: "transparent" }}><RotateCcw size={17} color={C.red} /><span style={{ fontFamily: SANS, fontSize: 15, fontWeight: 550, color: C.red }}>Reset all my data</span></button>
        )}
      </Card>

      <SectionLabel>About</SectionLabel>
      <Card style={{ padding: "4px 16px" }}><Row label="Version" last><span style={{ fontFamily: MONO, fontSize: 14, color: C.sub }}>1.0.0 · prototype</span></Row></Card>
    </div>
  );
}

/* ================================================================
   APP SHELL
================================================================ */
export default function App() {
  useState(() => { const v = loadLS("wa_ver", null); if (v !== VER) { try { ["wa_profile", "wa_weightlog", "wa_programs", "wa_history"].forEach((k) => localStorage.removeItem(k)); } catch {} saveLS("wa_ver", VER); } return null; });
  const [profile, setProfile] = usePersist("wa_profile", { onboarded: false });
  const [weightLog, setWeightLog] = usePersist("wa_weightlog", {});
  const [programs, setPrograms] = usePersist("wa_programs", []);
  const [history, setHistory] = usePersist("wa_history", []);
  const [draft, setDraft] = usePersist("wa_draft", null);
  const [maxes, setMaxes] = usePersist("wa_maxes", {});
  const [equipment, setEquipment] = usePersist("wa_equipment", DEFAULT_EQUIPMENT);
  const [tab, setTab] = useState("home");
  // one-time cleanup: drop the old auto-seeded p1/p2/p3 defaults if they were never actually started
  useEffect(() => { setPrograms((ps) => ps.filter((p) => !(["p1", "p2", "p3"].includes(p.id) && !p.startedAt && !p.completedAt))); }, []);

  if (!profile.onboarded) return <Onboarding onDone={(p) => setProfile(p)} />;

  const finishSession = (session, updatedDays, readiness) => { setPrograms((ps) => ps.map((p) => p.id === session.programId ? { ...p, days: updatedDays, lastReadiness: readiness } : p)); setHistory((h) => [...h, session]); };
  const resetAll = () => { try { ["wa_profile", "wa_weightlog", "wa_programs", "wa_history", "wa_draft", "wa_maxes", "wa_equipment"].forEach((k) => localStorage.removeItem(k)); } catch {} setWeightLog({}); setPrograms([]); setHistory([]); setDraft(null); setMaxes({}); setEquipment(DEFAULT_EQUIPMENT); setProfile({ onboarded: false }); setTab("home"); };

  const tabs = [{ id: "home", icon: Home, label: "Dashboard" }, { id: "train", icon: Dumbbell, label: "Train" }, { id: "programs", icon: Layers, label: "Programs" }, { id: "profile", icon: User, label: "Profile" }];
  return (
    <div className="app-shell" style={{ background: C.page, display: "flex", justifyContent: "center", fontFamily: SANS }}>
      <div style={{ width: "100%", maxWidth: 430, background: C.page, display: "flex", flexDirection: "column", height: "100%" }}>
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch", paddingTop: 14 }}>
          {tab === "home" && <Dashboard profile={profile} weightLog={weightLog} setWeightLog={setWeightLog} programs={programs} history={history} go={setTab} />}
          {tab === "train" && <Train profile={profile} programs={programs} history={history} draft={draft} setDraft={setDraft} onFinish={finishSession} go={setTab} equipment={equipment} setEquipment={setEquipment} />}
          {tab === "programs" && <Programs programs={programs} setPrograms={setPrograms} history={history} maxes={maxes} setMaxes={setMaxes} go={setTab} />}
          {tab === "profile" && <Profile profile={profile} setProfile={setProfile} programs={programs} history={history} weightLog={weightLog} onReset={resetAll} />}
        </div>
        <div style={{ flexShrink: 0, background: "rgba(255,255,255,0.92)", backdropFilter: "blur(12px)", borderTop: `1px solid ${C.line}`, display: "flex", padding: "8px 8px max(22px, env(safe-area-inset-bottom))" }}>
          {tabs.map((t) => { const on = tab === t.id, Icon = t.icon; return (<button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "8px 0", WebkitTapHighlightColor: "transparent" }}><Icon size={23} color={on ? ACC : C.faint} strokeWidth={on ? 2.4 : 2} /><span style={{ fontFamily: SANS, fontSize: 11, fontWeight: on ? 650 : 500, color: on ? C.ink : C.faint }}>{t.label}</span></button>); })}
        </div>
      </div>
    </div>
  );
}
