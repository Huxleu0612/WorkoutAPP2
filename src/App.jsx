import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from "recharts";
// Phosphor is the design system's icon set. Aliased to the previous lucide names so the
// ~235 call sites stay untouched; Phosphor has no strokeWidth prop, so the strokeWidth
// props scattered through those call sites are inert and get cleaned up per screen.
import {
  HouseIcon as Home, BarbellIcon as Dumbbell, StackIcon as Layers, UserIcon as User,
  PlusIcon as Plus, MinusIcon as Minus, CheckIcon as Check,
  CaretLeftIcon as ChevronLeft, CaretRightIcon as ChevronRight,
  MagnifyingGlassIcon as Search, XIcon as X,
  TrendDownIcon as TrendingDown, ArrowUpIcon as ArrowUp, ArrowRightIcon as ArrowRight,
  ArrowDownIcon as ArrowDown, LightningIcon as Zap, PulseIcon as Activity, MoonIcon as Moon,
  PlayIcon as Play, PauseIcon as Pause, StopIcon as Square, TrashIcon as Trash2,
  ArrowCounterClockwiseIcon as RotateCcw, ChartBarIcon as BarChart3, ClockIcon as Clock,
  PencilSimpleIcon as Pencil, TargetIcon as Target, CalendarBlankIcon as Calendar,
  InfoIcon as Info, CalculatorIcon as Calculator, SlidersHorizontalIcon as Settings2,
  SparkleIcon as Sparkles, BarbellIcon as Weight, RepeatIcon as Repeat, FireIcon as Flame,
  TrendUpIcon as TrendingUp, ArrowClockwiseIcon as RotateCw, GaugeIcon as Gauge,
  RocketIcon as Rocket, CubeIcon as Boxes, PersonSimpleIcon as PersonStanding,
  GridNineIcon as Grid3x3, HexagonIcon as Hexagon, MedalIcon as Medal,
  BookOpenIcon as BookOpen, WalletIcon as Wallet, LockSimpleIcon as LockSimple,
  CheckCircleIcon as CheckCircle, CircleIcon as Circle, CircleDashedIcon as CircleDashed, CaretDownIcon as CaretDown,
  CaretUpIcon as CaretUp, DotsThreeIcon as DotsThree, TagIcon as Tag, QuotesIcon as Quotes,
  CarIcon as Car, GearSixIcon as GearSix, BellIcon as Bell,
} from "@phosphor-icons/react";
import EXERCISES_DATA from "./data/exercises.json";
import { PROGRAM_CATALOG } from "./data/programCatalog";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, useDraggable, useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS as DndCSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers";
import { progressionOf } from "./lib/progression";
import { calcPlateLoad, DEFAULT_EQUIPMENT } from "./lib/plates";
import { supabase, syncConfigured } from "./lib/supabase";
import { syncNow, push as pushSync, touchKey } from "./lib/sync";
import * as Friends from "./lib/friends";

/* ===== TOKENS — Nocturne (dark) =====
   Sourced from the design handoff's styles.css. The semantic green/amber/red scale
   has no Nocturne equivalent and is hand-picked here for legibility on `card`. */
const C = {
  page: "#161826", card: "#232532", ink: "#E9E9ED", sub: "#9397AB", faint: "#75798C",
  line: "#3F424D", lineSoft: "rgba(233,233,237,0.10)",
  // "featured panel" pair — was a graphite gradient on a light page, now accent-tinted on dark
  graphite: "#2B2741", graphite2: "#423A6A",
  onDark: "#E9E9ED", onDarkSub: "#B2B6CA", onDarkLine: "#5D5294",
  green: "#63C88A", amber: "#E0AA5C", red: "#E57A80",
  greenBg: "rgba(99,200,138,0.15)", amberBg: "rgba(224,170,92,0.15)", redBg: "rgba(229,122,128,0.15)",
  shadowSm: "0 0 0 1px #3F424D",
  shadowMd: "0 0 0 1px #595D6C, 0 6px 18px rgba(0,0,0,0.55)",
  shadowLg: "0 0 0 1px #9397AB, 0 16px 40px rgba(0,0,0,0.65)",
  scrim: "rgba(8,9,14,0.74)",
  dragShadow: "0 0 0 1px #595D6C, 0 12px 28px rgba(0,0,0,0.6)",
  liftShadow: "0 6px 16px rgba(0,0,0,0.5)",
};
// Nocturne's accent/neutral ramps, for the places the design calls out a specific step by name
const AC = { base: "#9184D9", a300: "#D2CEFD", a400: "#B5ABFC", a700: "#5D5294", a800: "#423A6A", a900: "#2B2741" };
const NEU = { n200: "#E4E7F5", n400: "#B2B6CA", n500: "#9397AB", n600: "#75798C", n700: "#595D6C", n800: "#3F424D", n900: "#292B31" };
const ACC = "#B5ABFC", ACC_BG = "rgba(145,132,217,0.18)";
const AI_ACC = "#C8A9F0", AI_BG = "rgba(200,169,240,0.15)", AI_BORDER = "rgba(200,169,240,0.35)";
const MONO = "'SF Mono','JetBrains Mono','Roboto Mono',ui-monospace,monospace";
const SANS = "Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif";
const VER = 6;

/* ===== persistence ===== */
const loadLS = (k, fb) => { try { const v = localStorage.getItem(k); return v != null ? JSON.parse(v) : fb; } catch { return fb; } };
const saveLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
function usePersist(key, initial) {
  const [s, setS] = useState(() => loadLS(key, initial));
  const mounted = useRef(false);
  useEffect(() => {
    saveLS(key, s);
    // The write on mount is just re-persisting what was loaded, not an edit. Stamping it
    // would make every key look freshly changed and stop sync ever accepting a remote value.
    if (!mounted.current) { mounted.current = true; return; }
    touchKey(key);
  }, [key, s]);
  return [s, setS];
}

/* ===== backups =====
   Everything lives in this browser, so a bad change or a stray reset is unrecoverable
   without copies. Snapshots are taken automatically while the app is open and kept under
   their own key, so they survive a reset of the live data. They do not survive losing the
   browser itself — that is what the exported file is for. */
const DATA_KEYS = ["wa_profile", "wa_weightlog", "wa_programs", "wa_history", "wa_draft", "wa_maxes", "wa_equipment", "wa_habits", "wa_read", "wa_finance"];
const SNAP_KEY = "wa_snapshots";
const SNAP_EVERY_MS = 60000;
const SNAP_RECENT = 6;   // always keep the last few, however close together
const SNAP_DAYS = 7;     // plus the newest from each of the last week's days

const collectData = () => {
  const o = {};
  DATA_KEYS.forEach((k) => { const v = localStorage.getItem(k); if (v != null) o[k] = v; });
  return o;
};
const readSnaps = () => { try { const r = localStorage.getItem(SNAP_KEY); const a = r ? JSON.parse(r) : []; return Array.isArray(a) ? a : []; } catch { return []; } };
const pruneSnaps = (snaps) => {
  const sorted = [...snaps].sort((a, b) => b.t.localeCompare(a.t));
  const keep = new Set(sorted.slice(0, SNAP_RECENT).map((s) => s.t));
  const days = new Set();
  sorted.forEach((s) => { const d = s.t.slice(0, 10); if (!days.has(d) && days.size < SNAP_DAYS) { days.add(d); keep.add(s.t); } });
  return sorted.filter((s) => keep.has(s.t));
};
// Returns true if a new snapshot was written. Skips when nothing changed, so an idle app
// does not churn through its storage quota.
function writeSnapshot() {
  try {
    const data = collectData();
    const payload = JSON.stringify(data);
    const snaps = readSnaps();
    const newest = snaps.length ? snaps.reduce((a, b) => (a.t > b.t ? a : b)) : null;
    if (newest && JSON.stringify(newest.data) === payload) return false;
    let attempt = pruneSnaps([...snaps, { t: new Date().toISOString(), data }]);
    for (;;) {
      try { localStorage.setItem(SNAP_KEY, JSON.stringify(attempt)); return true; }
      catch { if (attempt.length <= 1) return false; attempt = attempt.slice(0, -1); } // drop oldest, retry
    }
  } catch { return false; }
}
const applyData = (data) => DATA_KEYS.forEach((k) => { if (data[k] != null) localStorage.setItem(k, data[k]); else localStorage.removeItem(k); });
function useAutoSnapshot() {
  useEffect(() => {
    writeSnapshot();
    const id = setInterval(() => { if (!document.hidden) writeSnapshot(); }, SNAP_EVERY_MS);
    // catch the state you leave the app in, which is usually right after a session
    const onVis = () => { if (document.hidden) writeSnapshot(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
  }, []);
}
function exportBackup() {
  const body = JSON.stringify({ app: "WorkoutAPP2", version: VER, exportedAt: new Date().toISOString(), data: collectData() }, null, 2);
  const url = URL.createObjectURL(new Blob([body], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url; a.download = `workout-backup-${ymd(new Date())}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function importBackup(file, done) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const parsed = JSON.parse(String(r.result));
      const data = parsed && parsed.data ? parsed.data : parsed;
      if (!data || typeof data !== "object" || !DATA_KEYS.some((k) => data[k] != null)) return done(false);
      writeSnapshot();          // keep a way back from the import itself
      applyData(data);
      done(true);
    } catch { done(false); }
  };
  r.onerror = () => done(false);
  r.readAsText(file);
}
/* ===== cloud sync =====
   Entirely optional. With no Supabase config the app behaves exactly as it always has:
   local only, no sign-in, no network. Signing in is what turns sync on. */
function useSync() {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("idle");
  const [lastSync, setLastSync] = useState(() => localStorage.getItem("wa_sync_pulled_at"));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!syncConfigured) return;
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  const run = useCallback(async () => {
    if (!user) return;
    setStatus("syncing"); setError(null);
    const r = await syncNow(user.id);
    if (!r.ok) { setStatus("error"); setError(r.reason); return; }
    setStatus("synced"); setLastSync(new Date().toISOString());
    // The screens read their state from localStorage at mount, so a pull that actually
    // changed something needs a reload to surface. Silent when nothing came down — and
    // never while a field is focused, since reloading mid-sentence would discard the edit.
    if (r.changed) {
      const el = document.activeElement;
      const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if (!typing) window.location.reload();
    }
  }, [user]);

  useEffect(() => { if (user) run(); }, [user, run]);

  useEffect(() => {
    if (!user) return;
    const onVis = () => { if (document.hidden) pushSync(user.id); else run(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", run);
    return () => { document.removeEventListener("visibilitychange", onVis); window.removeEventListener("online", run); };
  }, [user, run]);

  return { configured: syncConfigured, user, status, lastSync, error, run };
}

/* ===== friends =====
   Publishes a deliberately small slice: a monthly percentage covering only the habits you
   marked visible, and the quotes you chose to write down. Names, daily records, training,
   weight and finance are never sent. */
function useFriends(sync, habits, read, profile) {
  const [friends, setFriends] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [sent, setSent] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [busy, setBusy] = useState(false);
  const user = sync?.user || null;

  const refresh = useCallback(async () => {
    if (!user) { setFriends([]); setIncoming([]); setSent([]); setQuotes([]); return; }
    setBusy(true);
    const [f, i, s] = await Promise.all([Friends.listFriends(user), Friends.listIncomingInvites(user), Friends.listSentInvites(user)]);
    const list = f.ok ? f.data : [];
    const withStats = await Friends.fetchFriendStats(user, list);
    setFriends(withStats.ok ? withStats.data : list);
    setIncoming(i.ok ? i.data : []);
    setSent(s.ok ? s.data : []);
    const q = await Friends.fetchFriendQuotes(user, list);
    setQuotes(q.ok ? q.data : []);
    setBusy(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  // Keep your published slice current. Only visible habits count towards the percentage,
  // so turning one off genuinely removes it from what friends see.
  useEffect(() => {
    if (!user) return;
    const shared = (habits || []).filter((h) => h.visibleToFriends);
    const month = ymd(new Date()).slice(0, 7);
    const stats = shared.length ? habitMonthStats(shared, new Date()) : { pct: null };
    const streak = shared.length ? Math.max(0, ...shared.map((h) => habitStreak(h))) : 0;
    Friends.ensureProfile(user, profile?.name);
    Friends.publishStats(user, { month, pct: stats.pct ?? 0, count: shared.length, streak });
  }, [user, habits, profile?.name]);

  useEffect(() => { if (user) Friends.publishQuotes(user, read?.quotes || []); }, [user, read?.quotes]);

  return { user, friends, incoming, sent, quotes, busy, refresh };
}

const timeAgo = (iso) => {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 90) return "just now";
  const m = Math.round(s / 60); if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60); if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.round(h / 24); return `${d} day${d === 1 ? "" : "s"} ago`;
};

/* ===== units ===== */
const KG_TO_LB = 2.20462;
// Coerced rather than trusted: a restored or imported backup can carry a partial profile,
// and a missing weight should read as 0.0, not white-screen the app.
const fmtW = (kg, u) => { const n = Number(kg) || 0; return u === "lb" ? n * KG_TO_LB : n; };
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
const MON_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
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
// one source of truth for "how much work is in these sessions" — shared by StatsView and Train
const volumeAndSets = (sessions) => {
  const allSets = sessions.flatMap((s) => s.sets || []);
  return { allSets, workouts: sessions.length, sets: allSets.length, volumeKg: allSets.reduce((n, x) => n + (x.w || 0) * (x.reps || 0), 0) };
};
// consecutive weeks with at least one logged session. The current week only breaks the streak
// once it is over, so a fresh Monday doesn't read as having lost it.
// Counts completed weeks only. The week you are in does not count towards a streak until it
// is over, so a first week in progress reads 0 rather than claiming a week you have not
// finished yet.
const weekStreak = (sessions) => {
  if (!sessions.length) return 0;
  const weeks = new Set(sessions.map((s) => ymd(mondayOf(new Date(s.date)))));
  let cursor = addDays(mondayOf(new Date()), -7);
  let n = 0;
  while (weeks.has(ymd(cursor))) { n++; cursor = addDays(cursor, -7); }
  return n;
};
const weeklyVolume = (sessions, weeks = 8) => {
  const thisMon = mondayOf(new Date());
  return Array.from({ length: weeks }).map((_, i) => {
    const m = addDays(thisMon, -(weeks - 1 - i) * 7), nx = addDays(m, 7);
    const inWeek = sessions.filter((s) => { const d = startOfDay(new Date(s.date)); return d >= m && d < nx; });
    return { label: `${m.getDate()} ${MON[m.getMonth()]}`, kg: volumeAndSets(inWeek).volumeKg };
  });
};
const kFmt = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n)));

/* ===== habits =====
   A habit only counts on days it actually existed, so adding one today does not
   retroactively make last month look like it was missed. */
/* Traffic-light states. Stored as strings so a value is self-describing in the data:
     green  — done, counts in full
     orange — "not able": the day was not a fair test, so it is excluded from scoring
              entirely, both sides of the fraction. This is the "out until midnight, so
              5:30 was never happening" case — not a failure, just a day that does not count.
     red    — missed. Counted, and counted as zero.
   Anything unmarked on a past day counts as a miss too.
   Legacy `true` values from before this existed read as green, so nothing already logged
   changes meaning or is lost. */
const HABIT_GREEN = "green", HABIT_ORANGE = "orange", HABIT_RED = "red";
const habitState = (h, key) => { const v = h?.ticks?.[key]; return v === true ? HABIT_GREEN : v || null; };
const habitScore = (state) => (state === HABIT_GREEN ? 1 : 0);
const habitCounts = (state) => state !== HABIT_ORANGE; // "not able" leaves the denominator too
const HABIT_CYCLE = [null, HABIT_GREEN, HABIT_ORANGE, HABIT_RED];
const nextHabitState = (cur) => HABIT_CYCLE[(HABIT_CYCLE.indexOf(cur ?? null) + 1) % HABIT_CYCLE.length];
const habitStateColor = (state) => (state === HABIT_GREEN ? C.green : state === HABIT_ORANGE ? C.amber : state === HABIT_RED ? C.red : NEU.n700);
// One place for the wording, so Today and Habits can never drift apart.
const HABIT_LABEL = { [HABIT_GREEN]: "Done", [HABIT_ORANGE]: "Not able", [HABIT_RED]: "Missed" };
const habitStateLabel = (state) => HABIT_LABEL[state] || null;
// Cycles a habit's state for one day, clearing the entry entirely when it comes back round.
const cycleHabitOn = (setHabits, id, key) => setHabits((hs) => hs.map((h) => {
  if (h.id !== id) return h;
  const next = nextHabitState(habitState(h, key));
  const ticks = { ...h.ticks };
  if (next == null) delete ticks[key]; else ticks[key] = next;
  return { ...h, ticks };
}));

const habitsOn = (habits, key) => (Array.isArray(habits) ? habits : []).filter((h) => ymd(new Date(h.createdAt)) <= key && (!h.archivedAt || key < ymd(new Date(h.archivedAt))));
const habitDayPct = (habits, key) => {
  const on = habitsOn(habits, key).filter((h) => habitCounts(habitState(h, key)));
  if (!on.length) return null; // every habit that day was marked red, so the day has no score
  return Math.round((on.reduce((n, h) => n + habitScore(habitState(h, key)), 0) / on.length) * 100);
};
// today only breaks a streak once the day is over, so an untouched morning doesn't read as a loss
// Green keeps a streak going. "Not able" is neutral — it neither extends nor breaks a run,
// since the day was never a fair test. A miss breaks it.
const habitStreak = (h) => {
  const held = (d) => habitState(h, ymd(d)) === HABIT_GREEN;
  const neutral = (d) => habitState(h, ymd(d)) === HABIT_ORANGE;
  let d = startOfDay(new Date());
  if (!held(d)) d = addDays(d, -1);
  let n = 0;
  while (true) { if (held(d)) n++; else if (!neutral(d)) break; d = addDays(d, -1); }
  return n;
};
const habitBestRun = (habits, days = 180) => {
  let best = 0, run = 0;
  for (let i = days; i >= 0; i--) {
    const p = habitDayPct(habits, ymd(addDays(startOfDay(new Date()), -i)));
    if (p === 100) { run++; best = Math.max(best, run); } else if (p != null) run = 0;
  }
  return best;
};
const habitMonthStats = (habits, monthDate) => {
  const m = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const nx = new Date(m.getFullYear(), m.getMonth() + 1, 1);
  const today0 = startOfDay(new Date());
  let hit = 0, total = 0, perfect = 0, missed = 0;
  for (let d = new Date(m); d < nx && d <= today0; d = addDays(d, 1)) {
    const k = ymd(d), on = habitsOn(habits, k);
    if (!on.length) continue;
    const counted = on.filter((h) => habitCounts(habitState(h, k)));
    if (!counted.length) continue; // whole day marked red, so it does not affect the month
    const done = counted.reduce((n, h) => n + habitScore(habitState(h, k)), 0);
    hit += done; total += counted.length;
    if (done === counted.length) perfect++;
    if (done === 0) missed++;
  }
  return { pct: total ? Math.round((hit / total) * 100) : null, perfect, missed };
};
// same thresholds the Today week tracker uses
const heatColor = (pct) => (pct == null || pct === 0 ? NEU.n900 : pct >= 90 ? AC.base : pct >= 50 ? AC.a700 : AC.a800);

/* ===== reading ===== */
const READ_DEFAULT = { goalMin: 20, when: "before bed", log: {}, quotes: [] };
const readMin = (read, key) => read.log?.[key] || 0;
const readMet = (read, key) => readMin(read, key) >= (read.goalMin || 20);
// like habit streaks, today only counts against you once it is over
const readStreak = (read) => { let n = 0, d = startOfDay(new Date()); if (!readMet(read, ymd(d))) d = addDays(d, -1); while (readMet(read, ymd(d))) { n++; d = addDays(d, -1); } return n; };
const readWeekTotal = (read) => weekKeysOf(new Date()).reduce((n, k) => n + readMin(read, k), 0);
const hm = (min) => (min >= 60 ? `${Math.floor(min / 60)}h ${min % 60}m` : `${Math.round(min)}m`);
/* ===== finance =====
   Mortgage-centred rather than expense tracking. Every figure below is derived from the
   balances, rates and payments the user enters at each check-in — nothing is carried
   forward from a previous projection, so a check-in always re-bases the maths. */
const CURRENCIES = { GBP: "£", EUR: "€", USD: "$", AUD: "A$", NZD: "NZ$" };
const curSym = (c) => CURRENCIES[c] || "£";
const money = (n, c) => `${curSym(c)}${Math.round(n).toLocaleString("en-GB")}`;
const moneyShort = (n, c) => {
  const s = curSym(c), a = Math.abs(n), sign = n < 0 ? "-" : "";
  if (a >= 1e6) return `${sign}${s}${(a / 1e6).toFixed(2).replace(/\.?0+$/, "")}M`;
  if (a >= 1000) return `${sign}${s}${Math.round(a / 1000)}k`;
  return `${sign}${s}${Math.round(a)}`;
};
const FIN_DEFAULT = { currency: "GBP", cadence: "quarterly", lastUpdated: null, groups: [] };
const monthlyRate = (ratePct) => (ratePct || 0) / 100 / 12;
// Month-by-month rather than a closed form, because an overpayment goes to the highest-rate
// loan first and a cleared loan's payment rolls into the next one. No formula covers that.
const simulateLoans = (loans, extra = 0, cap = 720) => {
  const ordered = [...loans].sort((a, b) => (b.ratePct || 0) - (a.ratePct || 0));
  const bal = ordered.map((l) => Math.max(0, l.balance || 0));
  const rate = ordered.map((l) => monthlyRate(l.ratePct));
  const pay = ordered.map((l) => Math.max(0, l.paymentMonthly || 0));
  let months = 0, interestPaid = 0, first = { interest: 0, principal: 0 };
  if (!bal.some((b) => b > 0)) return { months: 0, interestPaid: 0, first, settles: true };
  while (bal.some((b) => b > 0.01) && months < cap) {
    let pool = extra, mInt = 0, mPrin = 0;
    for (let i = 0; i < bal.length; i++) {
      if (bal[i] <= 0.01) { pool += pay[i]; continue; }
      const int = bal[i] * rate[i];
      const due = Math.min(pay[i], bal[i] + int);
      const prin = due - int;
      if (prin <= 0) { mInt += int; continue; } // payment does not cover interest
      bal[i] = Math.max(0, bal[i] - prin);
      mInt += int; mPrin += prin;
    }
    for (let i = 0; i < bal.length && pool > 0.01; i++) {
      if (bal[i] <= 0.01) continue;
      const hit = Math.min(pool, bal[i]);
      bal[i] -= hit; pool -= hit; mPrin += hit;
    }
    interestPaid += mInt;
    if (months === 0) first = { interest: mInt, principal: mPrin };
    months++;
  }
  return { months, interestPaid, first, settles: months < cap };
};
// payment needed to clear a balance in n months
const paymentFor = (balance, ratePct, months) => {
  const r = monthlyRate(ratePct);
  if (months <= 0) return balance;
  if (r === 0) return balance / months;
  return (balance * r) / (1 - Math.pow(1 + r, -months));
};
const groupTotals = (g) => {
  const loans = g.loans || [];
  const balance = loans.reduce((n, l) => n + (l.balance || 0), 0);
  const payment = loans.reduce((n, l) => n + (l.paymentMonthly || 0), 0);
  const avgRate = balance > 0 ? loans.reduce((n, l) => n + (l.ratePct || 0) * (l.balance || 0), 0) / balance : 0;
  return { balance, payment, avgRate, count: loans.length };
};
const addMonths = (d, n) => { const z = new Date(d); z.setMonth(z.getMonth() + n); return z; };
const monthsBetween = (a, b) => (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
const monthLabel = (d) => `${MON[d.getMonth()]} ${d.getFullYear()}`;

const tagCounts = (quotes) => {
  const m = {};
  quotes.forEach((q) => { if (q.tag) m[q.tag] = (m[q.tag] || 0) + 1; });
  return Object.entries(m).map(([tag, n]) => ({ tag, n })).sort((a, b) => b.n - a.n);
};
const nextDayIndex = (h, p) => { if (!p || !p.days.length) return 0; return sessionsFor(h, p.id).length % p.days.length; };
const lastWeight = (wl) => { const ks = Object.keys(wl).sort(); return ks.length ? wl[ks[ks.length - 1]] : null; };

const WLETTER = ["A", "B", "C", "D", "E", "F", "G", "H"];
const wLabel = (i) => "Workout " + (WLETTER[i] || i + 1);
const monFirst = (d) => (d === 0 ? 6 : d - 1);
function assignedIdx(program, date) {
  if (!program || !program.days.length || !(program.scheduleDays || []).length) return null;
  const dow = date.getDay();
  if (!program.scheduleDays.includes(dow)) return null;
  // scheduleDays' stored order (not a re-derived Monday-first sort) is what decides which
  // workout lands on which weekday, so dragging to reassign a day on the Train screen sticks.
  return program.scheduleDays.indexOf(dow) % program.days.length;
}
const weekKeysOf = (d) => { const m = mondayOf(d); return Array.from({ length: 7 }).map((_, i) => ymd(addDays(m, i))); };
const matchesWorkout = (h, ai) => (h.dayIdx != null ? h.dayIdx === ai : h.dayName === wLabel(ai));
// Which logged session belongs to which scheduled day, for the week containing `date`.
// Matching is by week rather than exact date so training Monday's session on Tuesday still
// counts for Monday. But a session must only ever claim one slot: on a schedule like
// StrongLifts A/B/A across Mon/Wed/Fri, a single Workout A used to tick off both Monday and
// Friday — including Fridays that had not happened yet.
// Exact-date matches are assigned first so a session always lands on its own day when it can.
function weekSessionSlots(history, program, date) {
  const slots = new Map();
  if (!program || !(program.scheduleDays || []).length || !(program.days || []).length) return slots;
  const keys = weekKeysOf(date);
  const pool = history
    .filter((h) => h.programId === program.id && keys.includes(h.date))
    .sort((a, b) => a.date.localeCompare(b.date));
  const used = new Set();
  const scheduled = keys.map((k) => ({ k, ai: assignedIdx(program, new Date(k)) })).filter((s) => s.ai != null);
  const claim = (exactOnly) => scheduled.forEach(({ k, ai }) => {
    if (slots.has(k)) return;
    const i = pool.findIndex((h, j) => !used.has(j) && matchesWorkout(h, ai) && (!exactOnly || h.date === k));
    if (i !== -1) { used.add(i); slots.set(k, pool[i]); }
  });
  claim(true);
  claim(false);
  return slots;
}
// how many scheduled sessions should have happened by today (pause-aware)
function scheduledSoFar(p) {
  if (!p || !p.startedAt || !(p.scheduleDays || []).length) return 0;
  const start = startOfDay(new Date(p.startedAt));
  const today = startOfDay(new Date());
  let n = 0, guard = 0;
  // Stops before today on purpose. A session scheduled for tonight is not owed yet, so
  // counting it would drag consistency down all day and only recover after you trained.
  for (let d = new Date(start); d < today && guard < 2000; d = addDays(d, 1), guard++) if (p.scheduleDays.includes(d.getDay())) n++;
  const pausedWeeks = ((p.pausedMs || 0) + (p.pausedAt ? Date.now() - new Date(p.pausedAt).getTime() : 0)) / (7 * DAYMS);
  return Math.max(0, n - Math.round(pausedWeeks * p.scheduleDays.length));
}

/* ================================================================
   SHARED UI
================================================================ */
const Card = ({ children, style }) => <div style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.line}`, ...style }}>{children}</div>;
// Nocturne sets kickers in Inter, not mono, and caps headings at weight 500.
const Eyebrow = ({ children, dark }) => <div style={{ fontFamily: SANS, fontSize: 10, letterSpacing: 1.6, textTransform: "uppercase", color: dark ? C.onDarkSub : NEU.n500, fontWeight: 500 }}>{children}</div>;
const PageTitle = ({ children, sub }) => (<>{sub && <Eyebrow>{sub}</Eyebrow>}<h1 style={{ fontFamily: SANS, fontSize: 27, fontWeight: 500, color: C.ink, margin: "8px 0 20px", letterSpacing: -0.54 }}>{children}</h1></>);
const SectionLabel = ({ children, icon }) => <div style={{ fontFamily: SANS, fontSize: 10, letterSpacing: 1.6, textTransform: "uppercase", color: NEU.n500, fontWeight: 500, margin: "0 4px 8px", display: "flex", alignItems: "center", gap: 6 }}>{icon}{children}</div>;
const BigButton = ({ children, onClick, tone = "acc", disabled }) => {
  const map = { acc: [ACC, C.page], dark: [C.line, C.ink], done: [C.greenBg, C.green], ghost: [C.card, C.ink] };
  let [bg, col] = map[tone]; if (disabled) { bg = C.line; col = C.faint; }
  return <button onClick={disabled ? undefined : onClick} style={{ width: "100%", height: 56, borderRadius: 13, border: tone === "ghost" ? `1.5px solid ${C.line}` : "none", cursor: disabled ? "default" : "pointer", background: bg, color: col, fontFamily: SANS, fontSize: 15.5, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, WebkitTapHighlightColor: "transparent" }}>{tone === "done" && <Check size={18} strokeWidth={3} />}{children}</button>;
};
const Segmented = ({ options, value, onChange, small }) => (
  <div style={{ display: "flex", background: C.page, borderRadius: 11, padding: 3, gap: 3 }}>
    {options.map((o) => { const v = o.v ?? o, on = value === v; return (
      <button key={v} onClick={() => onChange(v)} style={{ flex: 1, height: small ? 32 : 38, border: "none", borderRadius: 8, cursor: "pointer", background: on ? C.card : "transparent", color: on ? C.ink : C.sub, fontFamily: SANS, fontSize: small ? 12 : 13.5, fontWeight: 600, boxShadow: on ? C.shadowSm : "none", WebkitTapHighlightColor: "transparent" }}>{o.l ?? o}</button>); })}
  </div>
);
const Switch = ({ on, onToggle }) => (<button onClick={onToggle} style={{ width: 48, height: 29, borderRadius: 15, border: "none", cursor: "pointer", background: on ? ACC : C.line, position: "relative", transition: "background .15s", WebkitTapHighlightColor: "transparent" }}><div style={{ position: "absolute", top: 3, left: on ? 22 : 3, width: 23, height: 23, borderRadius: 12, background: on ? C.page : C.ink, transition: "left .15s, background .15s", boxShadow: "0 1px 3px rgba(0,0,0,.5)" }} /></button>);
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
  // Latest typed value and commit fn, so unmounting can still save without this effect
  // re-running (and re-committing) on every keystroke.
  const latest = useRef(s), commit = useRef(onCommit);
  latest.current = s; commit.current = onCommit;
  useEffect(() => { setS(initial); }, [initial]);
  // Committing only on blur silently threw the edit away if you typed a value and then
  // closed the sheet, which is the natural way to finish. Save on the way out too.
  useEffect(() => () => { if (latest.current !== initial) commit.current(latest.current); }, [initial]);
  return (<div style={pill}>
    <input inputMode="decimal" value={s} onChange={(e) => setS(e.target.value)} onBlur={() => onCommit(s)}
      onKeyDown={(e) => { if (e.key === "Enter") { onCommit(s); e.currentTarget.blur(); } }}
      style={{ border: "none", outline: "none", background: "transparent", fontFamily: MONO, fontSize: 15, color: C.ink, textAlign: "right", width }} />
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
      <div onPointerDown={onDown} style={{ position: "absolute", top: PAD, left: PAD, transform: `translateX(${x}px)`, width: KNOB, height: 58 - PAD * 2, borderRadius: 10, background: color, display: "flex", alignItems: "center", justifyContent: "center", cursor: "grab", touchAction: "none" }}><ChevronRight size={22} color={C.page} strokeWidth={2.6} /></div>
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

// 500ms is the standard long-press duration on both iOS and Android. Tolerance is
// uncapped: no amount of movement during the hold cancels the pending activation —
// only releasing before 500ms is up does. A real swipe (released well under 500ms)
// still won't activate a drag; a swipe that's held open past 500ms now will.
function useReorderSensors() {
  return useSensors(useSensor(PointerSensor, { activationConstraint: { delay: 500, tolerance: Infinity } }));
}
// touch-action is decided by the browser once, at the start of a touch — it can't be
// switched mid-gesture, so a row that permits native vertical scroll (so a plain scroll
// works before any hold is registered) can't simply flip that off once a real drag
// activates. Once dnd-kit confirms a drag (isDragging), forcibly block native scrolling
// for its duration; without this, moving straight down after a successful long-press
// gets read as "the user wants to scroll" and the drag loses that fight.
function useBlockScrollWhileDragging(active) {
  useEffect(() => {
    if (!active) return;
    const block = (e) => e.preventDefault();
    document.addEventListener("touchmove", block, { passive: false });
    return () => document.removeEventListener("touchmove", block);
  }, [active]);
}
function Sortable({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  useBlockScrollWhileDragging(isDragging);
  // The moment a long press actually activates dnd-kit's drag, lift the item (scale +
  // shadow) so there's an unmistakable cue that it's safe to move now — without this,
  // people naturally start moving before the hold has truly registered, which cancels
  // the pending activation and makes the row feel like it won't budge.
  const t = [DndCSS.Transform.toString(transform), isDragging ? "scale(1.03)" : ""].filter(Boolean).join(" ");
  return (
    <div ref={setNodeRef} style={{ position: "relative", zIndex: isDragging ? 10 : "auto", transform: t, transition, opacity: isDragging ? 0.97 : 1, boxShadow: isDragging ? C.dragShadow : "none" }}>
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
        <Trash2 size={17} color={C.page} strokeWidth={2.2} />
        {past && <span style={{ fontFamily: SANS, fontSize: 13, fontWeight: 700, color: C.page }}>Delete</span>}
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
          userSelect: "none",
          WebkitUserSelect: "none",
          WebkitTouchCallout: "none",
          WebkitTapHighlightColor: "transparent",
          transform: `translateX(${dragX}px)${lifted ? " scale(1.015)" : ""}`,
          boxShadow: lifted ? C.liftShadow : "none",
          transition: gesture.current.active ? "none" : "transform 380ms cubic-bezier(.16,1,.3,1), box-shadow 380ms ease",
        }}
      >
        {children}
      </div>
    </div>
  );
}
/* A weekday row that's both a drag source and a drop target for the SAME id: dragging one
   scheduled day onto another swaps which workout each weekday runs (fixed calendar slots,
   not a reorderable list, so this uses dnd-kit's plain draggable/droppable rather than
   useSortable — there's no "before/after" here, just "trade contents with this other day"). */
function ScheduleSwapRow({ dow, draggable, children }) {
  const id = `sched-${dow}`;
  const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({ id, disabled: !draggable });
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id, disabled: !draggable });
  useBlockScrollWhileDragging(isDragging);
  return (
    <div
      ref={(node) => { setDragRef(node); setDropRef(node); }}
      {...(draggable ? attributes : {})}
      {...(draggable ? listeners : {})}
      style={{
        position: "relative",
        // without this the wrapper shrinks to its text and the week's rows end up ragged
        flex: 1,
        minWidth: 0,
        zIndex: isDragging ? 10 : "auto",
        transform: transform ? `${DndCSS.Translate.toString(transform)} scale(1.03)` : undefined,
        opacity: isDragging ? 0.95 : 1,
        boxShadow: isDragging ? C.dragShadow : "none",
        borderRadius: 13,
        outline: isOver && !isDragging ? `2px solid ${ACC}` : "2px solid transparent",
        outlineOffset: 2,
        transition: isDragging ? "none" : "transform 200ms ease, box-shadow 200ms ease, outline-color 150ms ease",
        touchAction: draggable ? "pan-y" : undefined,
        userSelect: draggable ? "none" : undefined,
        WebkitUserSelect: draggable ? "none" : undefined,
        WebkitTouchCallout: draggable ? "none" : undefined,
      }}
    >
      {children}
    </div>
  );
}
function InfoModal({ styleKey, onClose }) {
  const info = STYLE_INFO[styleKey] || STYLE_INFO.custom;
  const L = ({ children }) => <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 1.2, color: C.faint, marginBottom: 5 }}>{children}</div>;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: C.scrim, zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
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
        })} style={{ width: "100%", height: 58, borderRadius: 13, border: "none", cursor: ready ? "pointer" : "default", background: ready ? ACC : C.line, color: ready ? C.page : C.sub, fontFamily: SANS, fontSize: 16, fontWeight: 650, WebkitTapHighlightColor: "transparent" }}>Start training</button>
      </div>
    </div>
  );
}

/* ================================================================
   STATS VIEW
================================================================ */
function StatsView({ sessions, unit, title, sub, onBack }) {
  const { allSets, workouts, sets, volumeKg } = volumeAndSets(sessions);
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
function Dashboard({ profile, weightLog, setWeightLog, programs, history, habits, setHabits, read, go, onSettings }) {
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
  const slots = active && !paused ? weekSessionSlots(history, active, weekStart) : new Map();
  const days = Array.from({ length: 7 }).map((_, i) => {
    const dt = addDays(weekStart, i); const key = ymd(dt); const dow = dt.getDay();
    const aidx = active && !paused ? assignedIdx(active, dt) : null;
    const scheduled = aidx != null;
    const done = history.some((h) => h.date === key);
    const weighed = weightLog[key] != null;
    const past = startOfDay(dt) < today0;
    const afterStart = startedAt0 ? startOfDay(dt) >= startedAt0 : false;
    const wDone = scheduled && slots.has(key);
    const missed = scheduled && past && !wDone && afterStart && !paused;
    // The week tracker's bar is the share of that day's open items that got closed: the
    // scheduled workout, the weigh-in, the reading goal, and every habit that existed then.
    const hOn = habitsOn(habits, key);
    const items = 2 + (scheduled ? 1 : 0) + hOn.length;
    const closed = (weighed ? 1 : 0) + (wDone ? 1 : 0) + (readMet(read, key) ? 1 : 0) + hOn.reduce((n, h) => n + habitScore(habitState(h, key)), 0);
    const pct = Math.round((closed / items) * 100);
    return { dt, key, dow, aidx, scheduled, done, wDone, weighed, missed, past, pct, isToday: sameDay(dt, new Date()) };
  });
  const now = new Date();
  const todayRow = days.find((d) => d.isToday);
  const habitsToday = habitsOn(habits, todayKey);
  // Only genuinely untouched habits are "open". Green is done, and orange or red have both
  // already had a decision made about them.
  const openHabits = habitsToday.filter((h) => habitState(h, todayKey) == null);
  const cycleHabit = (id) => cycleHabitOn(setHabits, id, todayKey);
  const readLeft = Math.max(0, (read.goalMin || 20) - readMin(read, todayKey));

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

  if (view === "stats" && active) return <StatsView sessions={sessionsFor(history, active.id)} unit={u} title={active.name} sub="Program stats" onBack={() => setView("main")} />;

  return (
    <div style={{ padding: "6px 17px 24px" }}>
      {/* KICKER + GREETING */}
      <div style={{ fontFamily: SANS, fontSize: 10, fontWeight: 500, letterSpacing: 1.6, textTransform: "uppercase", color: NEU.n500 }}>
        {WD_LONG[now.getDay()]} {now.getDate()} {MON[now.getMonth()]}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, margin: "8px 0 20px" }}>
        <h1 style={{ fontFamily: SANS, fontSize: 27, fontWeight: 500, color: C.ink, margin: 0, letterSpacing: -0.54, lineHeight: 1.15 }}>{greet}, {profile.name || "Athlete"}</h1>
        <button onClick={onSettings} aria-label="Settings" style={{ width: 34, height: 34, flexShrink: 0, borderRadius: 17, border: `1px solid ${AC.a800}`, background: AC.a900, color: NEU.n200, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SANS, fontSize: 13, fontWeight: 500, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>{(profile.name || "?").trim().charAt(0).toUpperCase() || "?"}</button>
      </div>

      {/* WEEK TRACKER */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, margin: "0 2px 8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button onClick={() => setWkOffset(wkOffset - 1)} aria-label="Previous week" style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex", WebkitTapHighlightColor: "transparent" }}><ChevronLeft size={15} color={C.faint} /></button>
          <Eyebrow>{wkOffset === 0 ? "This week" : `${weekStart.getDate()} ${MON[weekStart.getMonth()]} – ${addDays(weekStart, 6).getDate()} ${MON[addDays(weekStart, 6).getMonth()]}`}</Eyebrow>
          <button onClick={() => setWkOffset(Math.min(0, wkOffset + 1))} aria-label="Next week" disabled={wkOffset >= 0} style={{ background: "none", border: "none", cursor: wkOffset < 0 ? "pointer" : "default", padding: 2, display: "flex", WebkitTapHighlightColor: "transparent" }}><ChevronRight size={15} color={wkOffset < 0 ? C.faint : "transparent"} /></button>
        </div>
      </div>
      <Card style={{ padding: 11, marginBottom: 16, boxShadow: C.shadowSm }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 6 }}>
          {days.map((s, i) => {
            const sel = s.key === selKey;
            const fill = s.pct >= 90 ? AC.base : s.pct >= 50 ? AC.a700 : AC.a800;
            return (
              <button key={i} onClick={() => setSelKey(s.key)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, WebkitTapHighlightColor: "transparent" }}>
                <div style={{ fontFamily: SANS, fontSize: 10, fontWeight: 500, color: s.isToday ? AC.a300 : C.faint }}>{WD_LETTER[s.dow]}</div>
                <div style={{ width: "100%", height: 34, borderRadius: 4, background: NEU.n900, display: "flex", alignItems: "flex-end", overflow: "hidden", outline: s.isToday ? `1px solid ${AC.a300}` : sel ? `1px solid ${NEU.n700}` : "none", outlineOffset: 1 }}>
                  <div style={{ width: "100%", height: `${s.pct}%`, background: fill, borderRadius: 4 }} />
                </div>
                <Dumbbell size={12} weight={s.wDone ? "fill" : "regular"} color={s.wDone ? AC.a300 : s.scheduled ? (s.missed ? C.amber : NEU.n400) : NEU.n900} />
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
            <Card style={{ padding: 18, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div><div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 500, color: C.green }}>{selDay.isToday ? "Completed today" : "Completed"}</div><div style={{ fontFamily: SANS, fontSize: 20, fontWeight: 500, color: C.ink, marginTop: 4, letterSpacing: -0.3 }}>{selSession.dayName}</div></div>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: C.greenBg, display: "flex", alignItems: "center", justifyContent: "center" }}><Check size={20} color={C.green} /></div>
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
            <button onClick={() => go("programs")} style={{ display: "block", width: "100%", textAlign: "left", cursor: "pointer", background: C.card, borderRadius: 14, border: `1px solid ${C.line}`, padding: 20, marginBottom: 16, WebkitTapHighlightColor: "transparent" }}>
              <div style={{ fontFamily: SANS, fontSize: 10, fontWeight: 500, letterSpacing: 1.6, textTransform: "uppercase", color: C.faint }}>No active program</div>
              <div style={{ fontFamily: SANS, fontSize: 20, fontWeight: 500, color: C.ink, margin: "8px 0 12px", letterSpacing: -0.3 }}>Choose a program to begin</div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ fontFamily: SANS, fontSize: 13, fontWeight: 500, color: ACC }}>Go to programs</span><ChevronRight size={15} color={ACC} /></div>
            </button>
          );
        }
        if (selDay.scheduled) {
          const aidx = assignedIdx(active, selDay.dt) ?? 0;
          const w = active.days[aidx] || active.days[0];
          const when = selDay.isToday ? "Today" : `${WD_LONG[selDay.dow]} ${selDay.dt.getDate()} ${MON[selDay.dt.getMonth()]}`;
          const label = selDay.missed ? `Missed · ${when}` : selDay.past ? `Not logged · ${when}` : `Up next · ${when}`;
          const bar = selDay.missed ? C.amber : selDay.past ? C.faint : AC.base;
          return (
            <button onClick={() => go("train")} style={{ position: "relative", display: "block", width: "100%", textAlign: "left", overflow: "hidden", cursor: "pointer", background: C.card, borderRadius: 14, border: `1px solid ${C.line}`, padding: "16px 16px 16px 20px", marginBottom: 16, WebkitTapHighlightColor: "transparent" }}>
              <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 2, background: bar }} />
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 500, color: selDay.missed ? C.amber : selDay.past ? C.faint : AC.a300 }}>{label}</div>
                  <div style={{ fontFamily: SANS, fontSize: 20, fontWeight: 500, color: C.ink, margin: "4px 0 6px", letterSpacing: -0.3 }}>{wLabel(aidx)} · Week {programWeek(active)}</div>
                  <div style={{ fontFamily: SANS, fontSize: 13, color: C.sub, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{w.ex.map((e) => exName(e.id)).join(" · ")}</div>
                </div>
                <div style={{ width: 46, height: 46, flexShrink: 0, borderRadius: 8, border: `1px solid ${AC.base}`, display: "flex", alignItems: "center", justifyContent: "center" }}><Play size={18} weight="fill" color={ACC} /></div>
              </div>
            </button>
          );
        }
        return (
          <Card style={{ padding: 22, marginBottom: 16, textAlign: "center" }}>
            <div style={{ fontFamily: SANS, fontSize: 10, fontWeight: 500, letterSpacing: 1.6, textTransform: "uppercase", color: C.faint }}>Rest day</div>
            <div style={{ fontFamily: SANS, fontSize: 20, fontWeight: 500, color: C.ink, margin: "8px 0 5px", letterSpacing: -0.3 }}>{selDay.isToday ? "Rest up" : `${WD_LONG[selDay.dow]} ${selDay.dt.getDate()} ${MON[selDay.dt.getMonth()]}`}</div>
            <div style={{ fontFamily: SANS, fontSize: 13.5, color: C.sub, lineHeight: 1.55 }}>Nothing planned — recovery is where the gains happen.</div>
            <button onClick={() => go("train")} style={{ marginTop: 14, height: 40, padding: "0 16px", background: "none", border: `1px solid ${AC.base}`, borderRadius: 8, cursor: "pointer", fontFamily: SANS, fontSize: 13, fontWeight: 500, color: ACC, WebkitTapHighlightColor: "transparent" }}>Train anyway</button>
          </Card>
        );
      })()}

      {/* OPEN ITEMS — habit chips tick in place, no trip to the Habits tab */}
      {(habitsToday.length > 0 || readLeft > 0) && (
        <Card style={{ padding: 16, marginBottom: 16 }}>
          <button onClick={() => go("read")} style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", marginBottom: habitsToday.length ? 12 : 0, paddingBottom: habitsToday.length ? 12 : 0, borderBottom: habitsToday.length ? `1px solid ${C.lineSoft}` : "none", WebkitTapHighlightColor: "transparent" }}>
            <BookOpen size={17} color={readLeft > 0 ? ACC : C.green} />
            <span style={{ fontFamily: SANS, fontSize: 14, color: C.ink }}>{readLeft > 0 ? `${readLeft} min of reading left` : "Reading done today"}</span>
          </button>
          {habitsToday.length > 0 && <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 11 }}>
            <button onClick={() => go("habits")} style={{ display: "flex", alignItems: "center", gap: 9, flex: 1, minWidth: 0, background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
              <Target size={17} color={openHabits.length ? ACC : C.green} />
              <span style={{ fontFamily: SANS, fontSize: 14, color: C.ink }}>{openHabits.length ? `${openHabits.length} habit${openHabits.length === 1 ? "" : "s"} left` : "All habits marked"}</span>
            </button>
            <span style={{ fontFamily: SANS, fontSize: 11, color: NEU.n600, flexShrink: 0 }}>Tap to change</span>
          </div>}
          {/* Every habit stays listed, not just the unmarked ones, so a chip can be cycled
              back and forth here instead of disappearing on the first tap. */}
          {habitsToday.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {habitsToday.map((h) => {
                const st = habitState(h, todayKey), col = habitStateColor(st);
                return (
                  <button key={h.id} onClick={() => cycleHabit(h.id)} aria-label={`${h.name} — ${habitStateLabel(st) || "not marked"}, tap to change`}
                    style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 11px", borderRadius: 99, border: st ? `1px solid ${col}` : "none", background: NEU.n900, color: st ? col : C.ink, fontFamily: SANS, fontSize: 11.5, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
                    {st ? <CheckCircle size={13} weight="fill" color={col} /> : <Circle size={13} color={NEU.n600} />} {h.name}
                  </button>
                );
              })}
            </div>
          )}
        </Card>
      )}

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
              <Tooltip contentStyle={{ fontFamily: MONO, fontSize: 12, borderRadius: 8, border: `1px solid ${C.line}`, background: C.card, color: C.ink }} itemStyle={{ color: C.ink }} labelStyle={{ color: C.sub }} />
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
/* ================================================================
   ACTIVE SESSION CHROME
================================================================ */
// re-renders once a second so the session and rest clocks stay live
function useTicker(on) {
  const [, bump] = useState(0);
  useEffect(() => { if (!on) return; const id = setInterval(() => bump((n) => n + 1), 1000); return () => clearInterval(id); }, [on]);
}
const mmss = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
const REST_MS = 90000, REST_SCALE = 120000;

function SessionHeader({ live, label, sub, doneCount, totalSets, onMinimise, menuOpen, setMenuOpen, onDiscard, onRestartTimer }) {
  useTicker(true);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const elapsed = live.startedAt ? Date.now() - new Date(live.startedAt).getTime() : 0;
  const round = { width: 36, height: 36, borderRadius: 8, border: `1px solid ${C.line}`, background: C.card, color: C.ink, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, WebkitTapHighlightColor: "transparent" };
  return (
    <div style={{ position: "sticky", top: -14, zIndex: 20, background: C.page, margin: "0 -17px", padding: "14px 17px 10px", borderBottom: `1px solid ${C.line}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* the caret leaves the session running rather than ending it, so it is labelled */}
        <button onClick={onMinimise} style={{ ...round, width: "auto", padding: "0 11px", gap: 5 }} aria-label="Minimise session"><CaretDown size={16} /><span style={{ fontFamily: SANS, fontSize: 12.5, fontWeight: 500 }}>Minimise</span></button>
        <div style={{ flex: 1, textAlign: "center", minWidth: 0 }}>
          <div style={{ fontFamily: SANS, fontSize: 10, fontWeight: 500, letterSpacing: 1.4, textTransform: "uppercase", color: NEU.n500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
          {/* Opening a workout to look at it starts the clock, so the clock has to be
              resettable — otherwise it reads hours long by the time you actually train. */}
          {confirmRestart ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <button onClick={() => setConfirmRestart(false)} style={{ height: 26, padding: "0 9px", borderRadius: 7, border: `1px solid ${C.line}`, background: "none", color: C.sub, fontFamily: SANS, fontSize: 11.5, cursor: "pointer" }}>Keep</button>
              <button onClick={() => { onRestartTimer(); setConfirmRestart(false); }} style={{ height: 26, padding: "0 9px", borderRadius: 7, border: `1px solid ${AC.base}`, background: "none", color: ACC, fontFamily: SANS, fontSize: 11.5, fontWeight: 500, cursor: "pointer" }}>Restart</button>
            </div>
          ) : (
            <button onClick={() => setConfirmRestart(true)} aria-label={`Session time ${mmss(elapsed)}, tap to restart the timer`}
              style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: SANS, fontSize: 19, fontWeight: 500, color: C.ink, fontVariantNumeric: "tabular-nums", letterSpacing: -0.3, WebkitTapHighlightColor: "transparent" }}>{mmss(elapsed)}</button>
          )}
        </div>
        <div style={{ position: "relative", flexShrink: 0 }}>
          <button onClick={() => setMenuOpen(!menuOpen)} style={round} aria-label="Session options"><DotsThree size={20} weight="bold" /></button>
          {menuOpen && (<>
            {/* catches the tap that should dismiss the menu — without it the menu sits over the session */}
            <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 29 }} />
            <div style={{ position: "absolute", right: 0, top: 42, background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, boxShadow: C.shadowMd, padding: 4, zIndex: 30, minWidth: 168 }}>
              <button onClick={onDiscard} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "10px 12px", borderRadius: 7, border: "none", background: "none", cursor: "pointer", fontFamily: SANS, fontSize: 14, color: C.red, WebkitTapHighlightColor: "transparent" }}><Trash2 size={15} /> Discard workout</button>
            </div>
          </>)}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 8 }}>
        <span style={{ fontFamily: SANS, fontSize: 11.5, color: C.sub, fontVariantNumeric: "tabular-nums" }}>{doneCount} of {totalSets} sets</span>
        <span style={{ fontFamily: SANS, fontSize: 11, color: NEU.n600 }}>· {sub}</span>
      </div>
    </div>
  );
}

function RestFooter({ until, onExtend, onSkip }) {
  useTicker(true);
  const left = until - Date.now();
  useEffect(() => { if (left <= 0) onSkip(); }, [left <= 0]);
  if (left <= 0) return null;
  const R = 20, CIRC = 2 * Math.PI * R;
  const frac = Math.min(1, left / REST_SCALE);
  const chip = { height: 32, padding: "0 11px", borderRadius: 8, background: "none", cursor: "pointer", fontFamily: SANS, fontSize: 12.5, fontWeight: 500, WebkitTapHighlightColor: "transparent" };
  return (
    <div style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: "calc(84px + env(safe-area-inset-bottom))", width: "min(100% - 34px, 396px)", zIndex: 40, background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, boxShadow: C.shadowMd, padding: "10px 12px", display: "flex", alignItems: "center", gap: 11 }}>
      <svg width={46} height={46} style={{ flexShrink: 0 }}>
        <circle cx={23} cy={23} r={R} stroke={NEU.n800} strokeWidth={2.5} fill="none" />
        <circle cx={23} cy={23} r={R} stroke={AC.base} strokeWidth={2.5} fill="none" strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - frac)} strokeLinecap="round" transform="rotate(-90 23 23)" />
      </svg>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: SANS, fontSize: 10, fontWeight: 500, letterSpacing: 1.6, textTransform: "uppercase", color: NEU.n500 }}>Rest</div>
        <div style={{ fontFamily: SANS, fontSize: 22, fontWeight: 500, color: C.ink, fontVariantNumeric: "tabular-nums", letterSpacing: -0.4 }}>{mmss(left)}</div>
      </div>
      <button onClick={() => onExtend(-15000)} style={{ ...chip, border: `1px solid ${C.line}`, color: C.sub }}>−15s</button>
      <button onClick={() => onExtend(15000)} style={{ ...chip, border: `1px solid ${C.line}`, color: C.sub }}>+15s</button>
      <button onClick={onSkip} style={{ ...chip, border: `1px solid ${AC.base}`, color: ACC }}>Skip</button>
    </div>
  );
}

function Train({ profile, programs, history, draft, setDraft, onFinish, onReorderSchedule, go, equipment, setEquipment }) {
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
  const [restUntil, setRestUntil] = useState(null);
  const [expandedEx, setExpandedEx] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const scheduleSensors = useReorderSensors();
  const swapScheduleDays = (dowA, dowB) => {
    if (!active || dowA === dowB) return;
    const sd = [...active.scheduleDays];
    const posA = sd.indexOf(dowA), posB = sd.indexOf(dowB);
    if (posA === -1 || posB === -1) return;
    [sd[posA], sd[posB]] = [sd[posB], sd[posA]];
    onReorderSchedule(active.id, sd);
  };
  useEffect(() => { if (!live && (phase === "active" || phase === "review")) setPhase("schedule"); }, [live, phase]);

  const trainEmpty = (kicker, title, body, cta) => (
    <div style={{ padding: "6px 17px 24px" }}>
      <div style={{ fontFamily: SANS, fontSize: 10, fontWeight: 500, letterSpacing: 1.6, textTransform: "uppercase", color: NEU.n500 }}>{kicker}</div>
      <h1 style={{ fontFamily: SANS, fontSize: 27, fontWeight: 500, color: C.ink, margin: "8px 0 20px", letterSpacing: -0.54 }}>Train</h1>
      <Card style={{ padding: 26, textAlign: "center" }}>
        <div style={{ fontFamily: SANS, fontSize: 17, fontWeight: 500, color: C.ink, letterSpacing: -0.2 }}>{title}</div>
        <div style={{ fontFamily: SANS, fontSize: 13.5, color: C.sub, margin: "7px 0 16px", lineHeight: 1.55 }}>{body}</div>
        <button onClick={() => go("programs")} style={{ height: 40, padding: "0 18px", borderRadius: 8, border: `1px solid ${AC.base}`, background: "none", color: ACC, fontFamily: SANS, fontSize: 14, fontWeight: 500, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>{cta}</button>
      </Card>
    </div>
  );
  if (!active) return trainEmpty("No program yet", "Nothing scheduled", "Pick a program from the library, or build your own, and your week appears here.", "Browse programs");
  if (!active.days.length) return trainEmpty(active.name, "No training days yet", `Add days and exercises to ${active.name} before you start training it.`, "Edit program");

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
  // logging a set is also what starts the rest clock — there is no separate action for it
  const rate = (key, c) => { setDraft((d) => ({ ...d, done: { ...d.done, [key]: c } })); setRestUntil(Date.now() + REST_MS); };
  const discard = () => { setDraft(null); setConfirmDiscard(false); setRestUntil(null); setPhase("schedule"); };

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
    const slots = weekSessionSlots(history, active, wkStart);
    const week = Array.from({ length: 7 }).map((_, i) => {
      const dt = addDays(wkStart, i); const key = ymd(dt); const aidx = assignedIdx(active, dt);
      return { dt, key, dow: dt.getDay(), aidx, done: slots.has(key), inProgress: !!(live && live.dayIdx === aidx), isToday: sameDay(dt, new Date()), past: startOfDay(dt) < today0 };
    });
    const nextRow = week.find((d) => d.aidx != null && !d.done && !d.past) || week.find((d) => d.aidx != null && !d.done);

    return (
      <div style={{ padding: "6px 17px 24px" }}>
        <div style={{ fontFamily: SANS, fontSize: 10, fontWeight: 500, letterSpacing: 1.6, textTransform: "uppercase", color: NEU.n500 }}>{active.name} · Week {programWeek(active)} of {active.weeks}</div>
        <h1 style={{ fontFamily: SANS, fontSize: 27, fontWeight: 500, color: C.ink, margin: "8px 0 20px", letterSpacing: -0.54 }}>Train</h1>

        {live ? (
          <button onClick={() => setPhase("active")} style={{ position: "relative", display: "block", width: "100%", textAlign: "left", overflow: "hidden", cursor: "pointer", background: C.card, borderRadius: 14, border: `1px solid ${C.line}`, padding: "16px 16px 16px 20px", marginBottom: 18, WebkitTapHighlightColor: "transparent" }}>
            <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 2, background: C.amber }} />
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 500, color: C.amber }}>In progress</div>
                <div style={{ fontFamily: SANS, fontSize: 20, fontWeight: 500, color: C.ink, margin: "4px 0 6px", letterSpacing: -0.3 }}>{wLabel(live.dayIdx)}</div>
                <div style={{ fontFamily: SANS, fontSize: 13, color: C.sub }}>{Object.keys(live.done).length} sets logged · tap to carry on</div>
              </div>
              <div style={{ width: 46, height: 46, flexShrink: 0, borderRadius: 8, border: `1px solid ${C.amber}`, display: "flex", alignItems: "center", justifyContent: "center" }}><Play size={18} weight="fill" color={C.amber} /></div>
            </div>
          </button>
        ) : nextRow ? (
          <button onClick={() => startWorkout(nextRow.aidx)} style={{ position: "relative", display: "block", width: "100%", textAlign: "left", overflow: "hidden", cursor: "pointer", background: C.card, borderRadius: 14, border: `1px solid ${C.line}`, padding: "16px 16px 16px 20px", marginBottom: 18, WebkitTapHighlightColor: "transparent" }}>
            <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 2, background: AC.base }} />
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 500, color: AC.a300 }}>Next session · {nextRow.isToday ? "Today" : WD_LONG[nextRow.dow]}</div>
                <div style={{ fontFamily: SANS, fontSize: 20, fontWeight: 500, color: C.ink, margin: "4px 0 6px", letterSpacing: -0.3 }}>{wLabel(nextRow.aidx)}</div>
                <div style={{ fontFamily: SANS, fontSize: 13, color: C.sub, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{(active.days[nextRow.aidx]?.ex || []).map((e) => exName(e.id)).join(" · ")}</div>
              </div>
              <div style={{ width: 46, height: 46, flexShrink: 0, borderRadius: 8, border: `1px solid ${AC.base}`, display: "flex", alignItems: "center", justifyContent: "center" }}><Play size={18} weight="fill" color={ACC} /></div>
            </div>
          </button>
        ) : (
          <Card style={{ padding: 22, marginBottom: 18, textAlign: "center" }}>
            <div style={{ width: 46, height: 46, borderRadius: 23, background: C.greenBg, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px" }}><Check size={24} color={C.green} /></div>
            <div style={{ fontFamily: SANS, fontSize: 17, fontWeight: 500, color: C.ink, letterSpacing: -0.2 }}>All caught up this week</div>
            <div style={{ fontFamily: SANS, fontSize: 13, color: C.sub, marginTop: 5 }}>Every scheduled workout is done.</div>
          </Card>
        )}

        {/* STATS */}
        {(() => {
          const mine = sessionsFor(history, active.id);
          const { volumeKg } = volumeAndSets(mine);
          const doneThisWeek = week.filter((d) => d.done).length;
          const dueThisWeek = week.filter((d) => d.aidx != null).length;
          const stats = [
            { k: "Volume", v: kFmt(fmtW(volumeKg, u)), u: u },
            { k: "Sessions", v: `${doneThisWeek}/${dueThisWeek}`, u: "this wk" },
            { k: "Streak", v: String(weekStreak(mine)), u: "wk", acc: true },
          ];
          return (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 18 }}>
              {stats.map((s) => (
                <Card key={s.k} style={{ padding: "13px 12px" }}>
                  <div style={{ fontFamily: SANS, fontSize: 9, fontWeight: 500, letterSpacing: 1.1, textTransform: "uppercase", color: NEU.n600, whiteSpace: "nowrap" }}>{s.k}</div>
                  <div style={{ marginTop: 6, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                    <span style={{ fontFamily: SANS, fontSize: 21, fontWeight: 500, color: s.acc ? AC.a300 : C.ink, letterSpacing: -0.3 }}>{s.v}</span>
                    <span style={{ fontFamily: SANS, fontSize: 11, color: NEU.n600 }}> {s.u}</span>
                  </div>
                </Card>
              ))}
            </div>
          );
        })()}

        {/* TOTAL VOLUME */}
        {(() => {
          const series = weeklyVolume(sessionsFor(history, active.id));
          const data = series.map((p) => ({ x: p.label, v: +fmtW(p.kg, u).toFixed(1) }));
          const nonZero = series.filter((p) => p.kg > 0);
          if (nonZero.length < 2) return null;
          const first = nonZero[0].kg, last = nonZero[nonZero.length - 1].kg;
          const pctChange = first > 0 ? Math.round(((last - first) / first) * 100) : null;
          return (
            <>
              <SectionLabel>Total volume</SectionLabel>
              <Card style={{ padding: "14px 12px 10px", marginBottom: 18 }}>
                <ResponsiveContainer width="100%" height={60}>
                  <LineChart data={data} margin={{ top: 4, right: 6, left: 6, bottom: 0 }}>
                    <Tooltip contentStyle={{ fontFamily: MONO, fontSize: 12, borderRadius: 8, border: `1px solid ${C.line}`, background: C.card, color: C.ink }} itemStyle={{ color: C.ink }} labelStyle={{ color: C.sub }} formatter={(v) => [`${commas(v)} ${u}`, "Volume"]} />
                    <Line type="monotone" dataKey="v" stroke={AC.base} strokeWidth={1.5} strokeLinecap="round" dot={false} activeDot={{ r: 3, fill: AC.base }} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 4px 0" }}>
                  <span style={{ fontFamily: SANS, fontSize: 11, color: NEU.n600, fontVariantNumeric: "tabular-nums" }}>{kFmt(fmtW(first, u))} {u}</span>
                  <span style={{ fontFamily: SANS, fontSize: 11, color: AC.a300, fontVariantNumeric: "tabular-nums" }}>{kFmt(fmtW(last, u))} {u}{pctChange != null ? ` · ${pctChange >= 0 ? "+" : ""}${pctChange}%` : ""}</span>
                </div>
              </Card>
            </>
          );
        })()}

        <SectionLabel>This week's schedule</SectionLabel>
        <DndContext sensors={scheduleSensors} onDragEnd={({ active, over }) => { if (over) swapScheduleDays(Number(active.id.slice(6)), Number(over.id.slice(6))); }} modifiers={[restrictToVerticalAxis]}>
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
                  <ScheduleSwapRow dow={d.dow} draggable={isWorkout}>
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
                        <button onClick={() => (d.inProgress ? setPhase("active") : startWorkout(d.aidx))} onPointerDown={(e) => e.stopPropagation()} style={{ height: 40, padding: "0 15px", borderRadius: 8, border: `1px solid ${d.inProgress || missed ? C.amber : AC.base}`, background: "none", color: d.inProgress || missed ? C.amber : ACC, fontFamily: SANS, fontSize: 14, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, flexShrink: 0, WebkitTapHighlightColor: "transparent" }}><Play size={14} weight="fill" /> {d.inProgress ? "Resume" : "Start"}</button>
                      )}
                      {!isWorkout && (
                        <button onClick={() => setPhase("pick")} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, color: ACC, fontFamily: SANS, fontSize: 13.5, fontWeight: 600, flexShrink: 0, WebkitTapHighlightColor: "transparent" }}><Plus size={16} strokeWidth={2.5} /> Add</button>
                      )}
                    </div>
                  </ScheduleSwapRow>
                </div>
              );
            })}
          </div>
        </DndContext>
        {active.scheduleDays.length > 1 && <div style={{ fontFamily: SANS, fontSize: 11.5, color: C.faint, padding: "8px 4px 0", lineHeight: 1.5 }}>Press and hold a workout, then drag it onto another day to swap which workout runs when.</div>}
        <button onClick={() => go("programs")} style={{ width: "100%", marginTop: 18, padding: "16px 18px", background: C.card, borderRadius: 14, border: `1px solid ${C.line}`, cursor: "pointer", display: "flex", alignItems: "center", gap: 12, WebkitTapHighlightColor: "transparent" }}>
          <Layers size={19} color={C.sub} />
          <div style={{ flex: 1, textAlign: "left" }}>
            <div style={{ fontFamily: SANS, fontSize: 15, fontWeight: 500, color: C.ink }}>Manage programs</div>
            <div style={{ fontFamily: SANS, fontSize: 12, color: C.sub, marginTop: 2 }}>Browse the library or edit your own.</div>
          </div>
          <ChevronRight size={16} color={C.faint} />
        </button>
        {calcOpen && <PlateCalculator targetKg={calcOpen.initialKg} equipment={equipment} setEquipment={setEquipment} unit={u} onClose={() => setCalcOpen(null)} />}
      </div>
    );
  }

  /* ================= PICK ================= */
  if (phase === "pick") {
    const todayAi = assignedIdx(active, new Date());
    return (
      <div style={{ padding: "6px 17px 24px" }}>
        <button onClick={() => setPhase("schedule")} style={backBtn}><ChevronLeft size={20} /> Train</button>
        <div style={{ fontFamily: SANS, fontSize: 10, fontWeight: 500, letterSpacing: 1.6, textTransform: "uppercase", color: NEU.n500 }}>{active.name} · Week {programWeek(active)}</div>
        <h1 style={{ fontFamily: SANS, fontSize: 27, fontWeight: 500, color: C.ink, margin: "8px 0 6px", letterSpacing: -0.54 }}>Pick a workout</h1>
        <div style={{ fontFamily: SANS, fontSize: 13.5, color: C.sub, marginBottom: 18, lineHeight: 1.5 }}>Choose which session to train.</div>
        <div style={{ display: "grid", gap: 9 }}>
          {active.days.map((d, i) => { const sug = i === todayAi; return (
            <button key={i} onClick={() => startWorkout(i)} style={{ position: "relative", display: "flex", alignItems: "center", gap: 13, textAlign: "left", overflow: "hidden", padding: sug ? "15px 15px 15px 19px" : "15px 15px", borderRadius: 14, border: `1px solid ${sug ? AC.a800 : C.line}`, background: C.card, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
              {sug && <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 2, background: AC.base }} />}
              <div style={{ width: 42, height: 42, borderRadius: 8, background: C.page, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Dumbbell size={19} color={sug ? ACC : C.sub} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ fontFamily: SANS, fontSize: 16, fontWeight: 500, color: C.ink, letterSpacing: -0.2 }}>{wLabel(i)}</span>
                  {sug && <span style={{ fontFamily: SANS, fontSize: 10, fontWeight: 500, color: AC.a300 }}>Today</span>}
                </div>
                <div style={{ fontFamily: SANS, fontSize: 12, color: NEU.n600, marginTop: 3 }}>{d.ex.length} exercise{d.ex.length !== 1 ? "s" : ""} · {d.ex.reduce((n, e) => n + setCount(e), 0)} sets</div>
              </div>
              <Play size={17} weight="fill" color={sug ? ACC : C.faint} />
            </button>
          ); })}
        </div>
      </div>
    );
  }

  /* ================= DONE ================= */
  if (phase === "done") return (
    <div style={{ padding: "6px 17px 24px" }}>
      <div style={{ fontFamily: SANS, fontSize: 10, fontWeight: 500, letterSpacing: 1.6, textTransform: "uppercase", color: NEU.n500 }}>{active.name} · Week {programWeek(active)}</div>
      <h1 style={{ fontFamily: SANS, fontSize: 27, fontWeight: 500, color: C.ink, margin: "8px 0 20px", letterSpacing: -0.54 }}>{wLabel(finishedIdx ?? 0)}</h1>
      <Card style={{ padding: 28, textAlign: "center", marginBottom: 14 }}>
        <div style={{ width: 56, height: 56, borderRadius: 28, background: C.greenBg, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}><Check size={28} color={C.green} /></div>
        <div style={{ fontFamily: SANS, fontSize: 19, fontWeight: 500, color: C.ink, letterSpacing: -0.3 }}>Session saved</div>
        <div style={{ fontFamily: SANS, fontSize: 13.5, color: C.sub, marginTop: 8, lineHeight: 1.55 }}>{savedCount} set{savedCount === 1 ? "" : "s"} recorded. Your next session and recommendations are updated.</div>
      </Card>
      <BigButton tone="acc" onClick={() => go("today")}>Back to today</BigButton>
      <div style={{ height: 9 }} />
      <BigButton tone="ghost" onClick={() => setPhase("schedule")}>Back to Train</BigButton>
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
  // the first exercise with a set still unlogged is "current"; it stays expanded and the rest
  // collapse. Tapping a collapsed one overrides that until it is dismissed.
  const exSetCounts = day.ex.map((exx) => {
    const strat = progressionOf(active, exx);
    const specs = strat.getSetSpecs ? strat.getSetSpecs(exx, { lastReadiness: active.lastReadiness, program: active, sessionCount }) : null;
    return specs ? specs.length : setCount(exx);
  });
  const firstOpen = exSetCounts.findIndex((n, ei) => Array.from({ length: n }).some((_, si) => !done[`${ei}-${si}`]));
  const currentIdx = firstOpen === -1 ? day.ex.length - 1 : firstOpen;
  const expandedIdx = expandedEx != null ? expandedEx : currentIdx;

  /* ================= REVIEW ================= */
  if (phase === "review") return (
    <div style={{ padding: "6px 17px 24px" }}>
      <div style={{ fontFamily: SANS, fontSize: 10, fontWeight: 500, letterSpacing: 1.6, textTransform: "uppercase", color: NEU.n500 }}>{subLine}</div>
      <h1 style={{ fontFamily: SANS, fontSize: 27, fontWeight: 500, color: C.ink, margin: "8px 0 20px", letterSpacing: -0.54 }}>{wLabel(live.dayIdx)}</h1>
      <Card style={{ padding: 20 }}>
        <div style={{ fontFamily: SANS, fontSize: 10, fontWeight: 500, letterSpacing: 1.6, textTransform: "uppercase", color: NEU.n500 }}>Session complete</div>
        <div style={{ fontFamily: SANS, fontSize: 19, fontWeight: 500, color: C.ink, margin: "9px 0 5px", letterSpacing: -0.3 }}>How did that session feel?</div>
        <div style={{ fontFamily: SANS, fontSize: 13, color: C.sub, marginBottom: 18, lineHeight: 1.5 }}>This tunes next week — a tough session won't be read as a plateau if you were just tired.</div>
        <div style={{ display: "grid", gap: 9 }}>
          {READINESS.map(({ v, label, Icon }) => (
            <button key={v} onClick={() => finish(v)} style={{ display: "flex", alignItems: "center", gap: 13, height: 58, borderRadius: 12, border: `1px solid ${C.line}`, background: C.page, cursor: "pointer", padding: "0 16px", WebkitTapHighlightColor: "transparent" }}>
              <div style={{ width: 38, height: 38, borderRadius: 8, background: ACC_BG, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon size={19} color={ACC} /></div>
              <span style={{ fontFamily: SANS, fontSize: 15, fontWeight: 500, color: C.ink }}>{label}</span><ChevronRight size={17} color={C.faint} style={{ marginLeft: "auto" }} /></button>
          ))}
        </div>
        <button onClick={() => setPhase("active")} style={{ width: "100%", height: 42, marginTop: 12, borderRadius: 8, border: "none", background: "transparent", color: C.sub, fontFamily: SANS, fontSize: 13.5, fontWeight: 500, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>Back to logging</button>
      </Card>
    </div>
  );

  /* ================= ACTIVE ================= */
  return (
    <div style={{ padding: "0 17px 96px" }}>
      <SessionHeader live={live} label={wLabel(live.dayIdx)} sub={subLine} doneCount={doneCount} totalSets={totalSets}
        onMinimise={() => setPhase("schedule")} menuOpen={menuOpen} setMenuOpen={setMenuOpen}
        onDiscard={() => { setMenuOpen(false); setConfirmDiscard(true); }}
        onRestartTimer={() => setDraft((d) => ({ ...d, startedAt: new Date().toISOString() }))} />
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

        // completed / current / upcoming — only the current exercise stays expanded
        const ratedCount = rows.filter((_, si) => done[`${ei}-${si}`]).length;
        const exDone = ratedCount >= rows.length;
        if (ei !== expandedIdx) {
          const logged = rows.map((_, si) => ({ w: parseFloat(setData[`${ei}-${si}`]?.w) || 0, reps: parseInt(setData[`${ei}-${si}`]?.reps) || 0, on: !!done[`${ei}-${si}`] })).filter((l) => l.on);
          const topW = logged.length ? Math.max(...logged.map((l) => l.w)) : 0;
          const vol = logged.reduce((n, l) => n + l.w * l.reps, 0);
          const meta = exDone
            ? [`${ratedCount} set${ratedCount === 1 ? "" : "s"}`, topW > 0 ? `${wStr(topW, u)} ${u}` : null, vol > 0 ? `${kFmt(fmtW(vol, u))} ${u}` : null].filter(Boolean).join(" · ")
            : `${rows.length} set${rows.length === 1 ? "" : "s"} planned`;
          return (
            <button key={ei} onClick={() => setExpandedEx(ei)} style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", textAlign: "left", background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: "13px 15px", marginBottom: 10, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
              {exDone ? <CheckCircle size={22} weight="fill" color={ACC} /> : <CircleDashed size={22} color={NEU.n700} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: SANS, fontSize: 15, fontWeight: 500, color: exDone ? NEU.n400 : C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{exName(exx.id)}</div>
                <div style={{ fontFamily: SANS, fontSize: 12, color: NEU.n600, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>{meta}</div>
              </div>
              <CaretDown size={16} color={C.faint} />
            </button>
          );
        }
        return (
          <div key={ei} style={{ position: "relative", overflow: "hidden", background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: "16px 16px 16px 18px", marginBottom: 10 }}>
            <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 2, background: AC.base }} />
            <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 12 }}>
              <ExerciseThumb exercise={exFull(exx.id)} onOpen={setDetail} />
              <div onClick={() => setDetail(exFull(exx.id))} style={{ flex: 1, cursor: "pointer", minWidth: 0 }}><div style={{ fontFamily: SANS, fontSize: 16, fontWeight: 500, color: C.ink }}>{exName(exx.id)}</div><div style={{ fontFamily: SANS, fontSize: 11.5, color: NEU.n600, marginTop: 2 }}>Set {Math.min(ratedCount + 1, rows.length)} of {rows.length} · {exMuscle(exx.id).toLowerCase()}</div></div>
              {!bw && <button onClick={() => setCalcOpen({ initialKg: tm || rec.w || 0 })} style={{ ...miniRound, width: 34, height: 34 }}><Calculator size={15} /></button>}
              {ei !== currentIdx && <button onClick={() => setExpandedEx(null)} style={{ ...miniRound, width: 34, height: 34 }} aria-label="Collapse"><CaretUp size={15} /></button>}
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
                    <button onClick={() => (strategy.setRatingKind === "log" ? rate(key, "logged") : setOpenRating(openRating === key ? null : key))} style={{ width: 48, height: 44, borderRadius: 10, cursor: "pointer", border: rated ? "none" : `1.5px solid ${C.line}`, background: rated ? (ratings[rated]?.c || ACC) : C.card, display: "flex", alignItems: "center", justifyContent: "center", WebkitTapHighlightColor: "transparent" }}><Check size={18} color={rated ? C.page : C.faint} strokeWidth={rated ? 3 : 2.4} /></button>
                  </div>
                  {openRating === key && (
                    <div style={{ padding: "4px 0 10px" }}><div style={{ fontFamily: MONO, fontSize: 10, color: C.faint, letterSpacing: 1, marginBottom: 8 }}>{strategy.setRatingKind === "hitmiss" ? "DID YOU HIT THE TARGET REPS?" : "HOW HARD WAS THAT SET?"}</div>
                      <div style={{ display: "grid", gridTemplateColumns: ratingKeys.map(() => "1fr").join(" "), gap: 8 }}>{ratingKeys.map((cc) => (<button key={cc} onClick={() => { rate(key, cc); setOpenRating(null); }} style={{ height: 60, borderRadius: 12, border: "none", background: ratings[cc].bg, cursor: "pointer", WebkitTapHighlightColor: "transparent", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3 }}><div style={{ width: 15, height: 15, borderRadius: 8, background: ratings[cc].c }} /><span style={{ fontFamily: SANS, fontSize: 12, fontWeight: 650, color: ratings[cc].c }}>{ratings[cc].label}</span><span style={{ fontFamily: MONO, fontSize: 8.5, color: ratings[cc].c, opacity: .85 }}>{ratings[cc].note}</span></button>))}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
      <div style={{ height: 6 }} />
      <BigButton tone="acc" onClick={() => setPhase("review")} disabled={doneCount === 0}>Finish workout</BigButton>
      {confirmDiscard && <><div style={{ height: 12 }} /><ConfirmPanel title="Discard this workout?" body="Everything you've logged in this session will be deleted. Your previous sessions are unaffected." slideLabel="Slide to discard" onConfirm={discard} onCancel={() => setConfirmDiscard(false)} /></>}
      {restUntil && <RestFooter until={restUntil} onExtend={(ms) => setRestUntil((t) => Math.max(Date.now() + 1000, t + ms))} onSkip={() => setRestUntil(null)} />}
      {detail && <ExerciseDetail exercise={detail} onClose={() => setDetail(null)} />}
      {calcOpen && <PlateCalculator targetKg={calcOpen.initialKg} equipment={equipment} setEquipment={setEquipment} unit={u} onClose={() => setCalcOpen(null)} />}
    </div>
  );
}

const tagPill = (color, bg) => ({ fontFamily: MONO, fontSize: 10.5, color, background: bg, padding: "3px 8px", borderRadius: 6, letterSpacing: 0.3, whiteSpace: "nowrap" });
// One distinct, generic (no people/photos) icon per catalog program so the library is easy
// to tell apart at a glance, rather than several programs sharing one tag-based icon.
const CATALOG_ICON_BY_ID = {
  cat_531bbb: Hexagon,
  cat_gzclp: Target,
};
function catalogIcon(templateId, tags) {
  if (CATALOG_ICON_BY_ID[templateId]) return CATALOG_ICON_BY_ID[templateId];
  if (tags.includes("push/pull/legs")) return Activity;
  if (tags.includes("upper/lower")) return Layers;
  if (tags.includes("body part split")) return Target;
  if (tags.includes("531") || tags.includes("gzcl")) return BarChart3;
  if (tags.includes("powerlifting")) return Medal;
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
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: C.scrim, zIndex: 55, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
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
  const Icon = catalogIcon(template.templateId, template.tags);
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
              {p.active && <span style={{ fontFamily: MONO, fontSize: 10, background: isPaused(p) ? C.amber : ACC, color: C.page, padding: "2px 7px", borderRadius: 5, letterSpacing: .5 }}>{isPaused(p) ? "PAUSED" : "ACTIVE"}</span>}
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
      <button onClick={() => go("train")} style={backBtn}><ChevronLeft size={18} /> Train</button>
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
  const [activeDayIdx, setActiveDayIdx] = useState(null); // which day's exercise list is mid-reorder, for the spotlight/fence treatment
  const sensors = useReorderSensors();
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
    setActiveDayIdx(null);
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
        {[1, 2, 3, 4, 5, 6, 0].map((wd) => { const on = pickDays.includes(wd); return (<button key={wd} onClick={() => toggleDay(wd)} style={{ flex: 1, height: 46, borderRadius: 11, border: `1.5px solid ${on ? ACC : C.line}`, background: on ? ACC : C.card, color: on ? C.page : C.sub, fontFamily: SANS, fontSize: 14, fontWeight: 650, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>{WD_LETTER[wd]}</button>); })}
      </div>
      <BigButton tone="acc" disabled={pickDays.length === 0} onClick={() => confirmStart([...pickDays].sort((a, b) => monFirst(a) - monFirst(b)))}>Start on {pickDays.length} day{pickDays.length !== 1 ? "s" : ""}/week</BigButton>
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
      {/* autoScroll off: with a day-level and a per-day exercise-level DndContext both
          mounted at once, letting either auto-scroll the page during a drag desyncs the
          dragged item's position from the pointer (it visually goes missing/behind other
          cards mid-scroll). These lists are short enough that manual scroll-then-drag is fine.
          While an exercise is mid-reorder, its own day's card is spotlighted (raised above a
          full-screen scrim) and the drag itself is fenced to that card via dnd-kit's
          restrictToParentElement modifier — reordering an exercise was never meant to move it
          into a different day, so now it's visually and functionally impossible to. */}
      {activeDayIdx != null && <div style={{ position: "fixed", inset: 0, background: C.scrim, zIndex: 5, pointerEvents: "none" }} />}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDayDragEnd} autoScroll={false} modifiers={[restrictToVerticalAxis]}>
        <SortableContext items={days.map(dayKey)} strategy={verticalListSortingStrategy}>
          {days.map((d, di) => {
            const spotlighted = activeDayIdx === di;
            return (
            <Sortable key={dayKey(d)} id={dayKey(d)}>
              {({ attributes, listeners, isDragging }) => (
                <div style={{ marginBottom: 12, position: "relative", zIndex: spotlighted ? 6 : "auto" }}>
                  <SwipeToDelete onDelete={() => removeDay(di)} disabled={isDragging} radius={14} dragProps={{ attributes, onPointerDown: listeners.onPointerDown }}>
                    <Card style={{ padding: 16, ...(spotlighted ? { border: `2px solid ${ACC}`, boxShadow: C.shadowLg } : {}) }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: d.ex.length ? 12 : 8 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: 1.2, color: ACC, fontWeight: 600 }}>WORKOUT {WLETTER[di] || di + 1}</div>
                          <input value={d.name} onChange={(e) => renameDay(di, e.target.value)} onPointerDown={(e) => e.stopPropagation()} style={{ width: "100%", fontFamily: SANS, fontSize: 16, fontWeight: 650, color: C.ink, border: "none", outline: "none", background: "transparent", marginTop: 2 }} />
                        </div>
                      </div>
                      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleExDragEnd(di)} onDragStart={() => setActiveDayIdx(di)} onDragCancel={() => setActiveDayIdx(null)} autoScroll={false} modifiers={[restrictToVerticalAxis, restrictToParentElement]}>
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
            );
          })}
        </SortableContext>
      </DndContext>
      {days.length > 0 && <div style={{ fontFamily: SANS, fontSize: 11.5, color: C.faint, padding: "0 4px", margin: "0 0 12px", lineHeight: 1.5 }}>Swipe right to remove a day or exercise, or press and hold to reorder it. You'll train Day 1 → Day 2 → … in order, one per training day you pick when you start.</div>}
      <button onClick={addDay} style={{ width: "100%", height: 54, borderRadius: 13, border: "none", background: C.ink, color: C.page, fontFamily: SANS, fontSize: 15, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4, marginBottom: 18, WebkitTapHighlightColor: "transparent" }}><Plus size={18} strokeWidth={2.5} /> Add training day</button>

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
      {exercise.gif && <div style={{ position: "absolute", inset: 0, background: "rgba(8,9,14,0.42)", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ width: 16, height: 16, borderRadius: 8, background: "rgba(233,233,237,0.92)", display: "flex", alignItems: "center", justifyContent: "center" }}><Play size={9} color={C.page} weight="fill" /></div></div>}
    </div>
  );
}
function ExerciseDetail({ exercise, inDay, onToggle, onClose }) {
  const on = inDay?.includes(exercise.id);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: C.scrim, zIndex: 60, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
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
const PLATE_SHADES = ["#F3F5FE", "#E4E7F5", "#CFD3E5", "#B2B6CA", "#9397AB", "#B5ABFC", "#968AE0"];

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
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: C.scrim, zIndex: 62, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
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
          <button onClick={addPlate} style={{ width: 48, height: 48, borderRadius: 11, border: "none", background: C.ink, color: C.page, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", WebkitTapHighlightColor: "transparent" }}><Plus size={20} /></button>
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
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: C.scrim, zIndex: 61, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
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
                    <span style={{ writingMode: "vertical-rl", fontFamily: MONO, fontSize: 10, color: C.page, fontWeight: 700 }}>{p.kg}</span>
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
      <div style={{ display: "flex", gap: 7, overflowX: "auto", marginBottom: 16, paddingBottom: 2 }}>{EQUIP_OPTIONS.map((eq) => (<button key={eq} onClick={() => setEquip(eq)} style={{ whiteSpace: "nowrap", padding: "8px 15px", borderRadius: 20, cursor: "pointer", border: `1.5px solid ${equip === eq ? C.ink : C.line}`, background: equip === eq ? ACC : C.card, color: equip === eq ? C.page : C.sub, fontFamily: SANS, fontSize: 13, fontWeight: 550, WebkitTapHighlightColor: "transparent" }}>{eq === "All" ? eq : cap(eq)}</button>))}</div>
      {filtered.map((e) => { const on = inDay.includes(e.id); return (
        <button key={e.id} onClick={() => onToggle(e.id)} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", background: C.card, border: `1px solid ${on ? ACC : C.line}`, borderRadius: 13, padding: "10px 16px", marginBottom: 8, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
          <ExerciseThumb exercise={e} onOpen={setDetail} />
          <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontFamily: SANS, fontSize: 15, fontWeight: 600, color: C.ink }}>{e.name}</div><div style={{ fontFamily: MONO, fontSize: 10, color: C.faint, marginTop: 3 }}>{e.bodyPart.toUpperCase()} · {e.equipment.toUpperCase()}</div></div>
          <div style={{ width: 30, height: 30, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", background: on ? ACC : C.card, border: `1.5px solid ${on ? ACC : C.line}`, flexShrink: 0 }}>{on ? <Check size={16} color={C.page} strokeWidth={3} /> : <Plus size={16} color={C.faint} />}</div>
        </button>
      ); })}
      {matched.length > PICKER_LIMIT && <div style={{ fontFamily: SANS, fontSize: 12.5, color: C.faint, textAlign: "center", padding: "8px 0 0" }}>Showing {PICKER_LIMIT} of {matched.length} matches — keep typing to narrow it down.</div>}
      {matched.length === 0 && <div style={{ fontFamily: SANS, fontSize: 13.5, color: C.sub, textAlign: "center", padding: "20px 0" }}>No exercises match "{q}".</div>}
      {detail && <ExerciseDetail exercise={detail} inDay={inDay} onToggle={onToggle} onClose={() => setDetail(null)} />}
    </div>
  );
}

/* ================================================================
   SETTINGS — a bottom sheet off the Today avatar, not a tab of its own
================================================================ */
const cmToFtIn = (cm) => { const t = cm / 2.54; const f = Math.floor(t / 12); const i = Math.round(t - f * 12); return `${f}'${i}"`; };
function FriendsSheet({ friendsApi, onClose }) {
  const { user, friends, incoming, sent, refresh } = friendsApi;
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const run = async (fn, okText) => { setBusy(true); setMsg(null); const r = await fn(); setBusy(false); setMsg(r.ok ? { text: okText } : { bad: true, text: r.reason }); await refresh(); };
  const row = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "11px 0", borderBottom: `1px solid ${C.lineSoft}` };
  const small = { height: 30, padding: "0 11px", borderRadius: 8, background: "none", fontFamily: SANS, fontSize: 12.5, fontWeight: 500, cursor: "pointer", flexShrink: 0, WebkitTapHighlightColor: "transparent" };
  return (
    <div onClick={onClose} style={sheetScrim}>
      <div onClick={(e) => e.stopPropagation()} style={sheetShell}>
        <div style={grabHandle} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <h2 style={{ fontFamily: SANS, fontSize: 20, fontWeight: 500, color: C.ink, margin: 0, letterSpacing: -0.3 }}>Friends</h2>
          <button onClick={onClose} style={miniRound}><X size={17} /></button>
        </div>
        <div style={{ fontFamily: SANS, fontSize: 12.5, color: C.sub, lineHeight: 1.55, marginBottom: 16 }}>
          Friends see the percentage of your visible habits hit this month, and any quotes you write down. They never see your training, your weight or your finances.
        </div>

        <div style={finLabel}>Invite by email</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="off" placeholder="them@example.com" style={{ ...finField, flex: 1 }} />
          <button disabled={busy || !email.trim()} onClick={() => run(() => Friends.sendInvite(user, email), "Invite sent. It waits until they sign in.").then(() => setEmail(""))}
            style={{ ...small, height: 44, padding: "0 15px", border: `1px solid ${email.trim() ? AC.base : C.line}`, color: email.trim() ? ACC : C.faint }}>Invite</button>
        </div>
        {msg && <div style={{ fontFamily: SANS, fontSize: 12.5, color: msg.bad ? C.red : C.green, marginBottom: 12, lineHeight: 1.45 }}>{msg.text}</div>}

        {incoming.length > 0 && (<>
          <div style={{ ...finLabel, marginTop: 14 }}>Waiting for you</div>
          {incoming.map((iv) => (
            <div key={iv.id} style={row}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: SANS, fontSize: 14, color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{iv.name}</div>
                <div style={{ fontFamily: SANS, fontSize: 11.5, color: NEU.n600, marginTop: 2 }}>invited you {timeAgo(iv.created_at)}</div>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button disabled={busy} onClick={() => run(() => Friends.declineInvite(iv), "Invite declined.")} style={{ ...small, border: `1px solid ${C.line}`, color: C.sub }}>Decline</button>
                <button disabled={busy} onClick={() => run(() => Friends.acceptInvite(user, iv), "Connected.")} style={{ ...small, border: `1px solid ${AC.base}`, color: ACC }}>Accept</button>
              </div>
            </div>
          ))}
        </>)}

        <div style={{ ...finLabel, marginTop: 16 }}>Connected{friends.length ? ` · ${friends.length}` : ""}</div>
        {friends.length === 0 ? (
          <div style={{ fontFamily: SANS, fontSize: 13, color: NEU.n600, padding: "6px 0 4px", lineHeight: 1.5 }}>Nobody yet. An invite only becomes a connection once they accept it.</div>
        ) : friends.map((f) => (
          <div key={f.id} style={row}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <div style={{ width: 30, height: 30, flexShrink: 0, borderRadius: 15, border: `1px solid ${AC.a800}`, background: AC.a900, color: NEU.n200, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SANS, fontSize: 12 }}>{(f.name || "?").trim().charAt(0).toUpperCase()}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: SANS, fontSize: 14, color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.name}</div>
                <div style={{ fontFamily: SANS, fontSize: 11.5, color: NEU.n600, marginTop: 2 }}>sees your habits and quotes</div>
              </div>
            </div>
            <button disabled={busy} onClick={() => run(() => Friends.removeFriend(f.id), "Removed.")} style={{ ...small, border: `1px solid ${C.line}`, color: C.sub }}>Remove</button>
          </div>
        ))}

        {sent.length > 0 && (<>
          <div style={{ ...finLabel, marginTop: 16 }}>Invited</div>
          {sent.map((iv) => (
            <div key={iv.id} style={row}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: SANS, fontSize: 14, color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{iv.email}</div>
                <div style={{ fontFamily: SANS, fontSize: 11.5, color: NEU.n600, marginTop: 2 }}>sent {timeAgo(iv.created_at)} · not accepted yet</div>
              </div>
              <button disabled={busy} onClick={() => run(() => Friends.cancelInvite(iv), "Invite withdrawn.")} style={{ ...small, border: `1px solid ${C.line}`, color: C.sub }}>Cancel</button>
            </div>
          ))}
        </>)}
      </div>
    </div>
  );
}

function SettingsSheet({ profile, setProfile, programs, history, weightLog, onReset, equipment, setEquipment, fin, setFin, sync, friendsApi, onClose }) {
  const [view, setView] = useState("main");
  const [confirmReset, setConfirmReset] = useState(false);
  const [editingEquip, setEditingEquip] = useState(false);
  const [snaps] = useState(() => readSnaps());
  const [confirmSnap, setConfirmSnap] = useState(null);
  const [restoreErr, setRestoreErr] = useState(null);
  const fileRef = useRef(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPw, setAuthPw] = useState("");
  const [authMsg, setAuthMsg] = useState(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const setP = (k, v) => setProfile((p) => ({ ...p, [k]: v }));
  const u = profile.unit;
  const active = activeProgram(programs);
  const cur = lastWeight(weightLog) ?? profile.currentKg;
  const g = deriveGoal(profile, cur);
  const weeksToGoal = g.type !== "maintain" && g.mag > 0 ? Math.ceil(Math.abs(g.goal - cur) / g.mag) : null;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: C.scrim, zIndex: 58, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 430, background: C.card, borderRadius: "20px 20px 0 0", padding: "18px 20px 34px", maxHeight: "86vh", overflowY: "auto" }}>
        <div style={{ width: 38, height: 4, borderRadius: 2, background: C.line, margin: "0 auto 16px" }} />
        {view === "report" ? (
          <StatsView sessions={history} unit={u} title="All-time report" sub={`Since ${fmtDate(profile.createdAt)}`} onBack={() => setView("main")} />
        ) : (<>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <h2 style={{ fontFamily: SANS, fontSize: 22, fontWeight: 500, color: C.ink, margin: 0, letterSpacing: -0.4 }}>Settings</h2>
          <button onClick={onClose} style={miniRound}><X size={18} /></button>
        </div>
      <Card style={{ padding: 20, marginBottom: 16, display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ width: 60, height: 60, borderRadius: 30, border: `1px solid ${AC.a800}`, background: AC.a900, color: NEU.n200, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SANS, fontSize: 22, fontWeight: 500 }}>{(profile.name || "?").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}</div>
        <div style={{ flex: 1 }}><div style={{ display: "flex", alignItems: "center", gap: 6 }}><input value={profile.name || ""} onChange={(e) => setP("name", e.target.value)} style={{ border: "none", outline: "none", background: "transparent", fontFamily: SANS, fontSize: 19, fontWeight: 500, color: C.ink, width: "100%" }} /><Pencil size={13} color={C.faint} /></div><div style={{ fontFamily: MONO, fontSize: 12, color: C.sub, marginTop: 2 }}>Age {ageFrom(profile.birthDate)} · since {fmtDate(profile.createdAt)}</div></div>
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

      <SectionLabel icon={<Wallet size={13} />}>Money</SectionLabel>
      <Card style={{ padding: "4px 16px", marginBottom: 16 }}>
        <Row label="Currency" sub="Used for every money value in Finance">
          <select value={fin.currency || "GBP"} onChange={(e) => setFin((f) => ({ ...f, currency: e.target.value }))} style={{ background: C.page, border: `1px solid ${C.line}`, borderRadius: 8, color: C.ink, fontFamily: SANS, fontSize: 14, padding: "8px 10px", outline: "none" }}>
            {Object.keys(CURRENCIES).map((k) => <option key={k} value={k}>{k} {CURRENCIES[k]}</option>)}
          </select>
        </Row>
        <Row label="Update reminder" sub="How often Finance asks you to check in" last>
          <div style={{ width: 150 }}><Segmented small options={[{ v: "monthly", l: "Monthly" }, { v: "quarterly", l: "Quarterly" }]} value={fin.cadence || "quarterly"} onChange={(v) => setFin((f) => ({ ...f, cadence: v }))} /></div>
        </Row>
      </Card>

      <SectionLabel icon={<Calculator size={13} />}>Equipment</SectionLabel>
      <Card style={{ padding: "4px 16px", marginBottom: 16 }}>
        <Row label="Bars and plates" sub="What the plate calculator loads from" last>
          <button onClick={() => setEditingEquip(true)} style={{ height: 34, padding: "0 13px", borderRadius: 8, border: `1px solid ${AC.base}`, background: "none", color: ACC, fontFamily: SANS, fontSize: 13, fontWeight: 500, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>Edit</button>
        </Row>
      </Card>

      <SectionLabel icon={<Clock size={13} />}>Daily reminder</SectionLabel>
      <Card style={{ padding: "4px 16px", marginBottom: 16 }}>
        <Row label="Reminder" sub="Nudge to log your weigh-in"><Switch on={profile.reminderOn} onToggle={() => setP("reminderOn", !profile.reminderOn)} /></Row>
        <Row label="Time" last><div style={pill}><input type="time" value={profile.reminderTime || "07:30"} onChange={(e) => setP("reminderTime", e.target.value)} style={{ border: "none", outline: "none", background: "transparent", fontFamily: MONO, fontSize: 14, color: C.ink }} /><Pencil size={12} color={C.faint} /></div></Row>
        <div style={{ fontFamily: SANS, fontSize: 11.5, color: C.faint, padding: "0 0 12px", lineHeight: 1.45 }}>Note: real phone notifications need the installed app version — this saves your preferred time for now.</div>
      </Card>

      {sync.configured && <>
        <SectionLabel icon={<RotateCw size={13} />}>Sync</SectionLabel>
        <Card style={{ padding: 16, marginBottom: 16 }}>
          {sync.user ? (<>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: SANS, fontSize: 14, color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sync.user.email}</div>
                <div style={{ fontFamily: SANS, fontSize: 11.5, color: sync.status === "error" ? C.red : NEU.n600, marginTop: 3 }}>
                  {sync.status === "syncing" ? "Syncing…" : sync.status === "error" ? (sync.error || "Sync failed") : sync.lastSync ? `Synced ${timeAgo(sync.lastSync)}` : "Not synced yet"}
                </div>
              </div>
              <button onClick={sync.run} disabled={sync.status === "syncing"} style={{ height: 34, padding: "0 13px", borderRadius: 8, border: `1px solid ${AC.base}`, background: "none", color: ACC, fontFamily: SANS, fontSize: 13, fontWeight: 500, cursor: "pointer", flexShrink: 0 }}>Sync now</button>
            </div>
            <button onClick={() => setFriendsOpen(true)} style={{ marginTop: 12, height: 38, width: "100%", borderRadius: 8, border: `1px solid ${C.line}`, background: "none", color: C.ink, fontFamily: SANS, fontSize: 13.5, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 13px", WebkitTapHighlightColor: "transparent" }}>
              <span>Friends</span>
              <span style={{ display: "flex", alignItems: "center", gap: 6, color: NEU.n600, fontSize: 12.5 }}>
                {friendsApi.incoming.length > 0 && <span style={{ color: ACC }}>{friendsApi.incoming.length} waiting</span>}
                {friendsApi.friends.length || "none"}<ChevronRight size={14} />
              </span>
            </button>
            <button onClick={async () => { await supabase.auth.signOut(); }} style={{ marginTop: 8, height: 38, width: "100%", borderRadius: 8, border: `1px solid ${C.line}`, background: "none", color: C.sub, fontFamily: SANS, fontSize: 13.5, cursor: "pointer" }}>Sign out</button>
            <div style={{ fontFamily: SANS, fontSize: 11.5, color: NEU.n600, marginTop: 12, lineHeight: 1.5 }}>Your data stays on this device and works offline. Signing out leaves it here — it does not delete anything.</div>
          </>) : (<>
            <div style={{ fontFamily: SANS, fontSize: 13, color: C.sub, lineHeight: 1.55, marginBottom: 13 }}>Sign in to keep your history on more than one device. Everything keeps working offline either way.</div>
            <input value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} type="email" autoComplete="email" placeholder="you@example.com" style={{ ...finField, marginBottom: 8 }} />
            <input value={authPw} onChange={(e) => setAuthPw(e.target.value)} type="password" autoComplete="current-password" placeholder="Password" style={{ ...finField, marginBottom: 10 }} />
            {authMsg && <div style={{ fontFamily: SANS, fontSize: 12.5, color: authMsg.bad ? C.red : C.green, marginBottom: 10, lineHeight: 1.45 }}>{authMsg.text}</div>}
            <div style={{ display: "flex", gap: 8 }}>
              <button disabled={authBusy} onClick={async () => {
                setAuthBusy(true); setAuthMsg(null);
                const { error } = await supabase.auth.signInWithPassword({ email: authEmail.trim(), password: authPw });
                setAuthBusy(false); if (error) setAuthMsg({ bad: true, text: error.message });
              }} style={{ flex: 1, height: 42, borderRadius: 8, border: `1px solid ${AC.base}`, background: "none", color: ACC, fontFamily: SANS, fontSize: 14, fontWeight: 500, cursor: "pointer" }}>Sign in</button>
              <button disabled={authBusy} onClick={async () => {
                setAuthBusy(true); setAuthMsg(null);
                const { data, error } = await supabase.auth.signUp({ email: authEmail.trim(), password: authPw });
                setAuthBusy(false);
                if (error) setAuthMsg({ bad: true, text: error.message });
                else if (!data.session) setAuthMsg({ bad: false, text: "Check your email to confirm the account, then sign in." });
              }} style={{ flex: 1, height: 42, borderRadius: 8, border: `1px solid ${C.line}`, background: "none", color: C.ink, fontFamily: SANS, fontSize: 14, fontWeight: 500, cursor: "pointer" }}>Create account</button>
            </div>
          </>)}
        </Card>
      </>}

      <SectionLabel icon={<RotateCcw size={13} />}>Backups</SectionLabel>
      <Card style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ fontFamily: SANS, fontSize: 13, color: C.sub, lineHeight: 1.55 }}>
          Saved automatically every minute while the app is open, and again when you close it. Kept in this browser, so export a file too if it matters.
        </div>
        <div style={{ display: "flex", gap: 8, margin: "14px 0 4px" }}>
          <button onClick={exportBackup} style={{ flex: 1, height: 40, borderRadius: 8, border: `1px solid ${AC.base}`, background: "none", color: ACC, fontFamily: SANS, fontSize: 13.5, fontWeight: 500, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>Export a file</button>
          <button onClick={() => fileRef.current?.click()} style={{ flex: 1, height: 40, borderRadius: 8, border: `1px solid ${C.line}`, background: "none", color: C.ink, fontFamily: SANS, fontSize: 13.5, fontWeight: 500, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>Import a file</button>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" style={{ display: "none" }}
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) importBackup(f, (ok) => ok ? window.location.reload() : setRestoreErr("That file could not be read as a backup.")); }} />
        {restoreErr && <div style={{ fontFamily: SANS, fontSize: 12.5, color: C.red, marginTop: 8 }}>{restoreErr}</div>}
        {snaps.length > 0 && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.lineSoft}` }}>
            <div style={{ fontFamily: SANS, fontSize: 11, color: NEU.n600, marginBottom: 9 }}>{snaps.length} snapshot{snaps.length === 1 ? "" : "s"} · newest first</div>
            {snaps.slice().sort((a, b) => b.t.localeCompare(a.t)).map((s) => (
              <div key={s.t} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "8px 0" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: SANS, fontSize: 13.5, color: C.ink }}>{timeAgo(s.t)}</div>
                  <div style={{ fontFamily: MONO, fontSize: 10.5, color: NEU.n600, marginTop: 2 }}>{new Date(s.t).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
                </div>
                {confirmSnap === s.t ? (
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button onClick={() => setConfirmSnap(null)} style={{ height: 32, padding: "0 11px", borderRadius: 8, border: `1px solid ${C.line}`, background: "none", color: C.sub, fontFamily: SANS, fontSize: 12.5, cursor: "pointer" }}>Cancel</button>
                    <button onClick={() => { writeSnapshot(); applyData(s.data); window.location.reload(); }} style={{ height: 32, padding: "0 11px", borderRadius: 8, border: `1px solid ${C.amber}`, background: "none", color: C.amber, fontFamily: SANS, fontSize: 12.5, fontWeight: 500, cursor: "pointer" }}>Confirm</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmSnap(s.t)} style={{ height: 32, padding: "0 12px", borderRadius: 8, border: `1px solid ${C.line}`, background: "none", color: ACC, fontFamily: SANS, fontSize: 12.5, fontWeight: 500, cursor: "pointer", flexShrink: 0, WebkitTapHighlightColor: "transparent" }}>Restore</button>
                )}
              </div>
            ))}
          </div>
        )}
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
        </>)}
        {editingEquip && <EquipmentManager equipment={equipment} setEquipment={setEquipment} unit={u} onClose={() => setEditingEquip(false)} />}
        {friendsOpen && <FriendsSheet friendsApi={friendsApi} onClose={() => setFriendsOpen(false)} />}
      </div>
    </div>
  );
}

/* ================================================================
   APP SHELL
================================================================ */
/* ================================================================
   HABITS
================================================================ */
const HEAT_LEGEND = [NEU.n900, AC.a800, AC.a700, AC.base];

function HeatGrid({ habits, weeks, onPickDay, selKey }) {
  const end = startOfDay(new Date());
  const start = addDays(mondayOf(end), -(weeks - 1) * 7);
  const cells = Array.from({ length: weeks * 7 }).map((_, i) => {
    const dt = addDays(start, i), key = ymd(dt);
    return { key, dt, future: dt > end, pct: dt > end ? null : habitDayPct(habits, key), isToday: sameDay(dt, end) };
  });
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 5 }}>
      {cells.map((c) => {
        const sel = c.key === selKey && !c.isToday;
        return (
          <button key={c.key} onClick={c.future || !onPickDay ? undefined : () => onPickDay(c.key)}
            aria-label={`${c.dt.getDate()} ${MON[c.dt.getMonth()]}${c.pct != null ? ` — ${c.pct}%` : ""}`}
            style={{ padding: 0, aspectRatio: "1", borderRadius: 3, background: c.future ? "transparent" : heatColor(c.pct),
              border: c.future ? `1px solid ${NEU.n900}` : "none",
              outline: c.isToday ? `1px solid ${AC.a300}` : sel ? `1px solid ${NEU.n400}` : "none", outlineOffset: 1,
              cursor: c.future || !onPickDay ? "default" : "pointer", WebkitTapHighlightColor: "transparent" }} />
        );
      })}
    </div>
  );
}

const HeatLegend = () => (
  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
    <span style={{ fontFamily: SANS, fontSize: 10, color: NEU.n600 }}>0</span>
    {HEAT_LEGEND.map((c) => <div key={c} style={{ width: 11, height: 11, borderRadius: 3, background: c }} />)}
    <span style={{ fontFamily: SANS, fontSize: 10, color: NEU.n600 }}>100%</span>
  </div>
);

function HabitSheet({ habit, onSave, onDelete, onClose }) {
  const [name, setName] = useState(habit.name || "");
  const [detail, setDetail] = useState(habit.detail || "");
  const [visible, setVisible] = useState(!!habit.visibleToFriends);
  const [confirmDel, setConfirmDel] = useState(false);
  const field = { width: "100%", background: C.page, border: `1px solid ${C.line}`, borderRadius: 8, padding: "12px 13px", fontFamily: SANS, fontSize: 15, color: C.ink, outline: "none" };
  const btn = { flex: 1, height: 44, borderRadius: 8, background: "none", cursor: "pointer", fontFamily: SANS, fontSize: 14.5, fontWeight: 500, WebkitTapHighlightColor: "transparent" };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: C.scrim, zIndex: 60, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 430, background: C.card, borderRadius: "14px 14px 0 0", boxShadow: C.shadowLg, padding: "18px 17px 26px", maxHeight: "86vh", overflowY: "auto" }}>
        <div style={{ width: 36, height: 3, borderRadius: 2, background: C.line, margin: "0 auto 18px" }} />
        <div style={{ fontFamily: SANS, fontSize: 10, fontWeight: 500, letterSpacing: 1.6, textTransform: "uppercase", color: NEU.n500, marginBottom: 6 }}>Habit</div>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Habit name" style={{ ...field, fontSize: 17, marginBottom: 14 }} />
        <div style={{ fontFamily: SANS, fontSize: 10, fontWeight: 500, letterSpacing: 1.6, textTransform: "uppercase", color: NEU.n500, marginBottom: 6 }}>Details</div>
        <textarea value={detail} onChange={(e) => setDetail(e.target.value)} rows={3} placeholder="What does doing this actually look like?" style={{ ...field, resize: "none", lineHeight: 1.5, marginBottom: 16 }} />
        {/* Off unless you say otherwise, and the current state written out rather than left
            to the reader to infer from a switch position. */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: C.page, borderRadius: 8, padding: "12px 13px", marginBottom: 16 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: SANS, fontSize: 14, color: C.ink }}>Visible to friends</div>
            <div style={{ fontFamily: SANS, fontSize: 11.5, color: visible ? AC.a300 : NEU.n600, marginTop: 3, lineHeight: 1.45 }}>
              {visible
                ? "Counted in the monthly percentage your friends see. The name and your day-by-day record stay private."
                : "Off. Nothing about this habit leaves your device."}
            </div>
          </div>
          <Switch on={visible} onToggle={() => setVisible((v) => !v)} />
        </div>
        {habit.id && (confirmDel ? (
          <div style={{ background: C.redBg, borderRadius: 8, padding: 13, marginBottom: 16 }}>
            <div style={{ fontFamily: SANS, fontSize: 13.5, color: C.ink, lineHeight: 1.5, marginBottom: 10 }}>Delete this habit and its history? This cannot be undone.</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setConfirmDel(false)} style={{ ...btn, height: 38, border: `1px solid ${C.line}`, color: C.sub }}>Keep it</button>
              <button onClick={onDelete} style={{ ...btn, height: 38, border: `1px solid ${C.red}`, color: C.red }}>Delete</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setConfirmDel(true)} style={{ display: "flex", alignItems: "center", gap: 7, background: "none", border: "none", cursor: "pointer", padding: "0 0 16px", fontFamily: SANS, fontSize: 13.5, color: C.red, WebkitTapHighlightColor: "transparent" }}><Trash2 size={15} /> Delete habit</button>
        ))}
        <div style={{ display: "flex", gap: 9 }}>
          <button onClick={onClose} style={{ ...btn, border: `1px solid ${C.line}`, color: C.sub }}>Cancel</button>
          <button onClick={() => name.trim() && onSave({ name: name.trim(), detail: detail.trim(), visibleToFriends: visible })} style={{ ...btn, border: `1px solid ${name.trim() ? AC.base : C.line}`, color: name.trim() ? ACC : C.faint }}>Save</button>
        </div>
      </div>
    </div>
  );
}

function MonthHistorySheet({ habits, onClose }) {
  const [back, setBack] = useState(0);
  const now = new Date();
  const m = new Date(now.getFullYear(), now.getMonth() - back, 1);
  const stats = habitMonthStats(habits, m);
  const prev = habitMonthStats(habits, new Date(m.getFullYear(), m.getMonth() - 1, 1));
  const first = new Date(m.getFullYear(), m.getMonth(), 1);
  const lead = (first.getDay() + 6) % 7; // grid starts Monday
  const dim = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
  const today0 = startOfDay(now);
  const tile = { flex: 1, background: C.page, borderRadius: 8, padding: "11px 12px" };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: C.scrim, zIndex: 60, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 430, background: C.card, borderRadius: "14px 14px 0 0", boxShadow: C.shadowLg, padding: "18px 17px 26px", maxHeight: "86vh", overflowY: "auto" }}>
        <div style={{ width: 36, height: 3, borderRadius: 2, background: C.line, margin: "0 auto 18px" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <button onClick={() => setBack(back + 1)} style={miniRound} aria-label="Previous month"><ChevronLeft size={17} /></button>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: SANS, fontSize: 18, fontWeight: 500, color: C.ink, letterSpacing: -0.3 }}>{MON_LONG[m.getMonth()]} {m.getFullYear()}</div>
            <div style={{ fontFamily: SANS, fontSize: 12.5, color: stats.pct == null ? NEU.n600 : AC.a300, marginTop: 2 }}>{stats.pct == null ? "Nothing tracked yet" : `${stats.pct}% of habits hit`}</div>
          </div>
          <button onClick={() => setBack(Math.max(0, back - 1))} style={miniRound} aria-label="Next month"><ChevronRight size={17} color={back > 0 ? C.ink : C.faint} /></button>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", margin: "14px 0 8px" }}><HeatLegend /></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 5, marginBottom: 16 }}>
          {Array.from({ length: lead }).map((_, i) => <div key={`l${i}`} />)}
          {Array.from({ length: dim }).map((_, i) => {
            const dt = new Date(m.getFullYear(), m.getMonth(), i + 1), key = ymd(dt), future = startOfDay(dt) > today0;
            return <div key={key} style={{ aspectRatio: "1", borderRadius: 3, background: future ? "transparent" : heatColor(habitDayPct(habits, key)), border: future ? `1px solid ${NEU.n900}` : "none", outline: sameDay(dt, now) ? `1px solid ${AC.a300}` : "none", outlineOffset: 1 }} />;
          })}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {[{ k: "Best run", v: `${habitBestRun(habits)}d` }, { k: "Perfect days", v: String(stats.perfect) }, { k: "Missed", v: String(stats.missed) }].map((t) => (
            <div key={t.k} style={tile}>
              <div style={{ fontFamily: SANS, fontSize: 9, fontWeight: 500, letterSpacing: 1.1, textTransform: "uppercase", color: NEU.n600, whiteSpace: "nowrap" }}>{t.k}</div>
              <div style={{ fontFamily: SANS, fontSize: 20, fontWeight: 500, color: C.ink, marginTop: 5, fontVariantNumeric: "tabular-nums" }}>{t.v}</div>
            </div>
          ))}
        </div>
        {prev.pct != null && stats.pct != null && <div style={{ fontFamily: SANS, fontSize: 12.5, color: NEU.n600, marginTop: 14, textAlign: "center" }}>Last month was {prev.pct}%.</div>}
      </div>
    </div>
  );
}

function Habits({ habits, setHabits, friendsApi }) {
  const [sheet, setSheet] = useState(null); // {habit} | "month"
  const todayKey = ymd(new Date());
  const [selKey, setSelKey] = useState(todayKey);
  const selDate = startOfDay(new Date(selKey));
  const isToday = selKey === todayKey;
  // Future days cannot be marked — you have not had the chance to do them yet.
  const shiftDay = (n) => { const d = addDays(selDate, n); if (startOfDay(d) > startOfDay(new Date())) return; setSelKey(ymd(d)); };
  // Only habits that existed on the selected day are markable on it.
  const active = habitsOn(habits, selKey);
  const doneToday = active.filter((h) => habitState(h, selKey) === HABIT_GREEN).length;
  const countedToday = active.filter((h) => habitCounts(habitState(h, selKey))).length;
  // Tapping cycles unmarked -> green -> orange -> red -> unmarked, so every state is
  // reachable with repeat taps and nothing needs a long-press or a menu. Marks whichever
  // day is selected, so a day you forgot can be filled in after the fact.
  const cycle = (id) => cycleHabitOn(setHabits, id, selKey);
  const save = (id, patch) => setHabits((hs) => id ? hs.map((h) => h.id === id ? { ...h, ...patch } : h) : [...hs, { id: `hb_${Date.now()}`, createdAt: new Date().toISOString(), ticks: {}, visibleToFriends: false, ...patch }]);
  const remove = (id) => setHabits((hs) => hs.filter((h) => h.id !== id));

  const thisMonth = habitMonthStats(habits, new Date());
  const lastMonth = habitMonthStats(habits, new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1));
  const ahead = thisMonth.pct != null && lastMonth.pct != null ? thisMonth.pct - lastMonth.pct : null;

  return (
    <div style={{ padding: "6px 17px 24px" }}>
      <div style={{ fontFamily: SANS, fontSize: 10, fontWeight: 500, letterSpacing: 1.6, textTransform: "uppercase", color: NEU.n500 }}>
        {active.length ? `${doneToday} of ${countedToday} done${countedToday < active.length ? ` · ${active.length - countedToday} not counting` : ""}` : "Nothing tracked yet"}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, margin: "8px 0 14px" }}>
        <h1 style={{ fontFamily: SANS, fontSize: 27, fontWeight: 500, color: C.ink, margin: 0, letterSpacing: -0.54 }}>Habits</h1>
        <button onClick={() => setSheet({ habit: {} })} aria-label="New habit" style={{ width: 32, height: 32, flexShrink: 0, borderRadius: 16, border: `1px solid ${AC.base}`, background: "none", color: ACC, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}><Plus size={17} /></button>
      </div>

      {/* Day picker. Forgetting to mark a day is normal, so any past day can be filled in. */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 12, padding: "0 2px" }}>
        <button onClick={() => shiftDay(-1)} aria-label="Previous day" style={{ ...miniRound, width: 30, height: 30 }}><ChevronLeft size={15} /></button>
        <div style={{ textAlign: "center", minWidth: 0 }}>
          <div style={{ fontFamily: SANS, fontSize: 14, fontWeight: 500, color: isToday ? C.ink : AC.a300, whiteSpace: "nowrap" }}>
            {isToday ? "Today" : `${WD_LONG[selDate.getDay()]} ${selDate.getDate()} ${MON[selDate.getMonth()]}`}
          </div>
          {!isToday && <button onClick={() => setSelKey(todayKey)} style={{ background: "none", border: "none", padding: 0, marginTop: 1, cursor: "pointer", fontFamily: SANS, fontSize: 11, color: NEU.n600, WebkitTapHighlightColor: "transparent" }}>Back to today</button>}
        </div>
        <button onClick={() => shiftDay(1)} aria-label="Next day" disabled={isToday} style={{ ...miniRound, width: 30, height: 30, opacity: isToday ? 0.35 : 1, cursor: isToday ? "default" : "pointer" }}><ChevronRight size={15} /></button>
      </div>

      {active.length === 0 ? (
        <Card style={{ padding: 26, textAlign: "center", marginBottom: 16 }}>
          <div style={{ fontFamily: SANS, fontSize: 17, fontWeight: 500, color: C.ink, letterSpacing: -0.2 }}>No habits yet</div>
          <div style={{ fontFamily: SANS, fontSize: 13.5, color: C.sub, margin: "7px 0 16px", lineHeight: 1.55 }}>Add the few things you want to do most days. Two or three is plenty to start.</div>
          <button onClick={() => setSheet({ habit: {} })} style={{ height: 40, padding: "0 18px", borderRadius: 8, border: `1px solid ${AC.base}`, background: "none", color: ACC, fontFamily: SANS, fontSize: 14, fontWeight: 500, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>Add a habit</button>
        </Card>
      ) : (
        <Card style={{ padding: "4px 15px", marginBottom: 18 }}>
          {active.map((h, i) => {
            const st = habitState(h, selKey), streak = habitStreak(h);
            const dim = st === HABIT_GREEN || st === HABIT_RED;
            const label = habitStateLabel(st);
            return (
              <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 0", borderBottom: i === active.length - 1 ? "none" : `1px solid ${C.lineSoft}` }}>
                <button onClick={() => cycle(h.id)} aria-label={`${h.name} — ${label || "not marked"}, tap to change`} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", flexShrink: 0, WebkitTapHighlightColor: "transparent" }}>
                  {st ? <CheckCircle size={24} weight="fill" color={habitStateColor(st)} /> : <Circle size={24} color={NEU.n700} />}
                </button>
                <button onClick={() => setSheet({ habit: h })} style={{ flex: 1, minWidth: 0, textAlign: "left", background: "none", border: "none", padding: 0, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
                  <div style={{ fontFamily: SANS, fontSize: 15, fontWeight: 500, color: dim ? NEU.n400 : C.ink, textDecoration: st === HABIT_GREEN ? "line-through" : "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{h.name}</div>
                  <div style={{ fontFamily: SANS, fontSize: 12, color: st ? habitStateColor(st) : NEU.n600, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label || h.detail || "Not marked yet"}</div>
                </button>
                <span style={{ fontFamily: SANS, fontSize: 12.5, color: streak > 0 ? AC.a300 : NEU.n600, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{streak > 0 ? `${streak}d` : "—"}</span>
              </div>
            );
          })}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, paddingTop: 12, marginTop: 2, borderTop: `1px solid ${C.lineSoft}`, paddingBottom: 12 }}>
            {[[C.green, HABIT_LABEL[HABIT_GREEN]], [C.amber, HABIT_LABEL[HABIT_ORANGE]], [C.red, HABIT_LABEL[HABIT_RED]]].map(([c, t]) => (
              <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: SANS, fontSize: 11, color: NEU.n600 }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: c }} />{t}
              </span>
            ))}
            <span style={{ fontFamily: SANS, fontSize: 11, color: NEU.n600, width: "100%" }}>Tap a circle to cycle. Not able leaves the day out of your score entirely — it was never a fair test.</span>
          </div>
        </Card>
      )}

      {habits.length > 0 && (<>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, margin: "0 2px 8px" }}>
          <Eyebrow>Last 3 weeks</Eyebrow>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <HeatLegend />
            <button onClick={() => setSheet("month")} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: SANS, fontSize: 11, color: ACC, WebkitTapHighlightColor: "transparent" }}>History</button>
          </div>
        </div>
        <Card style={{ padding: 14 }}>
          {/* Tapping a square jumps the checklist above to that day, which is the quickest
              route to a day you forgot. */}
          <HeatGrid habits={habits} weeks={3} selKey={selKey} onPickDay={setSelKey} />
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.lineSoft}` }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: SANS, fontSize: 14, fontWeight: 500, color: ahead == null ? C.sub : ahead >= 0 ? AC.a300 : C.sub }}>
                {ahead == null ? "Building a picture" : ahead >= 0 ? "Ahead of last month" : "Behind last month"}
              </div>
              <div style={{ fontFamily: SANS, fontSize: 12, color: NEU.n600, marginTop: 3 }}>
                {thisMonth.pct == null ? "Tick a few days to compare." : `${thisMonth.pct}% of habits hit${lastMonth.pct != null ? ` · was ${lastMonth.pct}%` : ""}`}
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontFamily: SANS, fontSize: 9, fontWeight: 500, letterSpacing: 1.1, textTransform: "uppercase", color: NEU.n600 }}>Best run</div>
              <div style={{ fontFamily: SANS, fontSize: 18, fontWeight: 500, color: C.ink, marginTop: 3, fontVariantNumeric: "tabular-nums" }}>{habitBestRun(habits)}d</div>
            </div>
          </div>
        </Card>
      </>)}

      {/* Ranked on the shared percentage only. Nobody's habit names or daily record travel. */}
      {friendsApi?.friends?.length > 0 && (() => {
        const mine = habits.filter((h) => h.visibleToFriends);
        const myPct = mine.length ? (habitMonthStats(mine, new Date()).pct ?? 0) : null;
        const rows = [
          ...friendsApi.friends.filter((f) => f.stats).map((f) => ({ id: f.userId, name: f.name, pct: f.stats.habit_pct ?? 0 })),
          ...(myPct != null ? [{ id: "me", name: "You", pct: myPct, me: true }] : []),
        ].sort((a, b) => b.pct - a.pct);
        if (!rows.length) return null;
        return (<>
          <SectionLabel>Friends · habits hit this month</SectionLabel>
          <Card style={{ padding: "6px 14px 10px", marginTop: 8 }}>
            {rows.map((r, i) => (
              <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 8px", margin: "2px -8px", borderRadius: 8, background: r.me ? AC.a900 : "transparent" }}>
                <span style={{ fontFamily: SANS, fontSize: 11.5, color: NEU.n600, width: 14, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{i + 1}</span>
                <span style={{ fontFamily: SANS, fontSize: 13, color: C.ink, width: 62, flexShrink: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</span>
                <div style={{ flex: 1, height: 4, borderRadius: 2, background: NEU.n900, overflow: "hidden" }}>
                  <div style={{ width: `${Math.max(0, Math.min(100, r.pct))}%`, height: "100%", background: r.me ? AC.base : NEU.n700 }} />
                </div>
                <span style={{ fontFamily: SANS, fontSize: 12.5, color: r.me ? AC.a300 : NEU.n600, fontWeight: r.me ? 500 : 400, width: 34, textAlign: "right", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{r.pct}%</span>
              </div>
            ))}
            {mine.length === 0 && <div style={{ fontFamily: SANS, fontSize: 11.5, color: NEU.n600, padding: "8px 0 2px", lineHeight: 1.5 }}>None of your habits are shared yet. Open one and turn on "Visible to friends" to appear here.</div>}
          </Card>
        </>);
      })()}

      {sheet === "month" && <MonthHistorySheet habits={habits} onClose={() => setSheet(null)} />}
      {sheet && sheet !== "month" && (
        <HabitSheet habit={sheet.habit}
          onSave={(patch) => { save(sheet.habit.id, patch); setSheet(null); }}
          onDelete={() => { remove(sheet.habit.id); setSheet(null); }}
          onClose={() => setSheet(null)} />
      )}
    </div>
  );
}

/* ================================================================
   READ — reading is a habit, quotes are what you keep from it
================================================================ */
function Ring({ pct, size = 34, stroke = 2.5 }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} stroke={NEU.n800} strokeWidth={stroke} fill="none" />
      <circle cx={size / 2} cy={size / 2} r={r} stroke={AC.base} strokeWidth={stroke} fill="none" strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, pct / 100))} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} />
    </svg>
  );
}

function TagSheet({ quotes, current, onPick, onClose }) {
  const [val, setVal] = useState(current || "");
  const counts = tagCounts(quotes);
  const clean = val.trim().replace(/^#/, "").toLowerCase();
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: C.scrim, zIndex: 60, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 430, background: C.card, borderRadius: "14px 14px 0 0", boxShadow: C.shadowLg, padding: "18px 17px 26px", maxHeight: "86vh", overflowY: "auto" }}>
        <div style={{ width: 36, height: 3, borderRadius: 2, background: C.line, margin: "0 auto 18px" }} />
        <div style={{ fontFamily: SANS, fontSize: 10, fontWeight: 500, letterSpacing: 1.6, textTransform: "uppercase", color: NEU.n500, marginBottom: 6 }}>Tag</div>
        <input value={val} onChange={(e) => setVal(e.target.value)} placeholder="sleep" style={{ width: "100%", background: C.page, border: `1px solid ${C.line}`, borderRadius: 8, padding: "12px 13px", fontFamily: SANS, fontSize: 16, color: C.ink, outline: "none", marginBottom: 14 }} />
        {counts.length > 0 && (<>
          <div style={{ fontFamily: SANS, fontSize: 10, fontWeight: 500, letterSpacing: 1.6, textTransform: "uppercase", color: NEU.n500, marginBottom: 8 }}>Already using</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 18 }}>
            {counts.map(({ tag, n }) => (
              <button key={tag} onClick={() => onPick(tag)} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 11px", borderRadius: 99, border: "none", background: NEU.n900, color: C.ink, fontFamily: SANS, fontSize: 12, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>#{tag} <span style={{ color: NEU.n600 }}>{n}</span></button>
            ))}
          </div>
        </>)}
        <div style={{ display: "flex", gap: 9 }}>
          <button onClick={() => onPick(null)} style={{ flex: 1, height: 44, borderRadius: 8, border: `1px solid ${C.line}`, background: "none", color: C.sub, fontFamily: SANS, fontSize: 14.5, fontWeight: 500, cursor: "pointer" }}>{current ? "Remove tag" : "Cancel"}</button>
          <button onClick={() => clean && onPick(clean)} style={{ flex: 1, height: 44, borderRadius: 8, border: `1px solid ${clean ? AC.base : C.line}`, background: "none", color: clean ? ACC : C.faint, fontFamily: SANS, fontSize: 14.5, fontWeight: 500, cursor: "pointer" }}>Use tag</button>
        </div>
      </div>
    </div>
  );
}

function Read({ read, setRead, friendsApi }) {
  const [draftQuote, setDraftQuote] = useState("");
  const [draftSource, setDraftSource] = useState("");
  const [draftTag, setDraftTag] = useState(null);
  const [tagOpen, setTagOpen] = useState(false);
  const [editGoal, setEditGoal] = useState(false);
  const [q, setQ] = useState("");
  const todayKey = ymd(new Date());
  const goal = read.goalMin || 20;
  const doneMin = readMin(read, todayKey);
  const left = Math.max(0, goal - doneMin);
  const quotes = read.quotes || [];

  const addMin = (n) => setRead((r) => ({ ...r, log: { ...r.log, [todayKey]: Math.max(0, (r.log?.[todayKey] || 0) + n) } }));
  const logQuote = () => {
    const text = draftQuote.trim(); if (!text) return;
    setRead((r) => ({ ...r, quotes: [{ id: `qt_${Date.now()}`, text, tag: draftTag, source: draftSource.trim(), createdAt: new Date().toISOString() }, ...(r.quotes || [])] }));
    setDraftQuote(""); setDraftSource(""); setDraftTag(null);
  };
  const removeQuote = (id) => setRead((r) => ({ ...r, quotes: (r.quotes || []).filter((x) => x.id !== id) }));

  const counts = tagCounts(quotes);
  const needle = q.trim().toLowerCase();
  const shown = needle ? quotes.filter((x) => x.text.toLowerCase().includes(needle) || (x.tag || "").includes(needle) || (x.source || "").toLowerCase().includes(needle)) : quotes;

  return (
    <div style={{ padding: "6px 17px 24px" }}>
      <h1 style={{ fontFamily: SANS, fontSize: 27, fontWeight: 500, color: C.ink, margin: "0 0 20px", letterSpacing: -0.54 }}>Read</h1>

      {/* TODAY'S READING */}
      <div style={{ position: "relative", overflow: "hidden", background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: "16px 16px 16px 18px", marginBottom: 18 }}>
        <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 2, background: AC.base }} />
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 500, color: AC.a300 }}>Today · {doneMin} of {goal} min</div>
            <div style={{ fontFamily: SANS, fontSize: 15, fontWeight: 500, color: C.ink, marginTop: 4 }}>{left === 0 ? "Done for today" : `${left} min to go · ${read.when || "before bed"}`}</div>
          </div>
          <Ring pct={(doneMin / goal) * 100} />
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 13 }}>
          {[5, 10, 20].map((n) => (
            <button key={n} onClick={() => addMin(n)} style={{ flex: 1, height: 36, borderRadius: 8, border: `1px solid ${C.line}`, background: "none", color: C.ink, fontFamily: SANS, fontSize: 13, fontWeight: 500, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>+{n} min</button>
          ))}
          {doneMin > 0 && <button onClick={() => setRead((r) => ({ ...r, log: { ...r.log, [todayKey]: 0 } }))} style={{ width: 42, height: 36, borderRadius: 8, border: `1px solid ${C.line}`, background: "none", color: C.faint, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", WebkitTapHighlightColor: "transparent" }} aria-label="Clear today"><RotateCcw size={14} /></button>}
        </div>
        {/* Tucked behind a pencil — the target is set once in a while, not every day, so it
            does not deserve permanent space next to the controls you use daily. */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 11 }}>
          <span style={{ fontFamily: SANS, fontSize: 11.5, color: NEU.n600 }}>Target {goal} min a day</span>
          {editGoal ? (
            <div style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
              <button onClick={() => setRead((r) => ({ ...r, goalMin: Math.max(5, (r.goalMin || 20) - 5) }))} aria-label="Less" style={{ width: 26, height: 26, borderRadius: 7, border: `1px solid ${C.line}`, background: "none", color: C.ink, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Minus size={13} /></button>
              <button onClick={() => setRead((r) => ({ ...r, goalMin: Math.min(240, (r.goalMin || 20) + 5) }))} aria-label="More" style={{ width: 26, height: 26, borderRadius: 7, border: `1px solid ${C.line}`, background: "none", color: C.ink, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Plus size={13} /></button>
              <button onClick={() => setEditGoal(false)} style={{ height: 26, padding: "0 10px", borderRadius: 7, border: `1px solid ${AC.base}`, background: "none", color: ACC, fontFamily: SANS, fontSize: 11.5, fontWeight: 500, cursor: "pointer" }}>Done</button>
            </div>
          ) : (
            <button onClick={() => setEditGoal(true)} aria-label="Edit daily target" style={{ width: 26, height: 26, borderRadius: 7, border: "none", background: "none", color: C.faint, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, WebkitTapHighlightColor: "transparent" }}><Pencil size={13} /></button>
          )}
        </div>
      </div>

      {/* QUOTE BOX */}
      <div style={{ background: C.card, border: `1px solid ${NEU.n800}`, borderRadius: 8, padding: 14, marginBottom: 18 }}>
        <textarea value={draftQuote} onChange={(e) => setDraftQuote(e.target.value)} rows={3} placeholder="Write down a quote or impression"
          style={{ width: "100%", minHeight: 88, background: "transparent", border: "none", outline: "none", resize: "none", fontFamily: SANS, fontSize: 14.5, lineHeight: 1.5, color: C.ink }} />
        <input value={draftSource} onChange={(e) => setDraftSource(e.target.value)} placeholder="Source · page (optional)"
          style={{ width: "100%", background: "transparent", border: "none", outline: "none", fontFamily: SANS, fontSize: 12.5, color: C.sub, padding: "4px 0 10px" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, borderTop: `1px solid ${C.lineSoft}`, paddingTop: 11 }}>
          <button onClick={() => setTagOpen(true)} style={{ display: "inline-flex", alignItems: "center", gap: 5, height: 26, padding: "0 11px", borderRadius: 99, cursor: "pointer", WebkitTapHighlightColor: "transparent", fontFamily: SANS, fontSize: 11.5, ...(draftTag ? { border: "none", background: ACC_BG, color: ACC } : { border: `1px dashed ${C.line}`, background: "none", color: NEU.n600 }) }}>
            <Tag size={12} /> {draftTag ? `#${draftTag}` : "Add tag"}
          </button>
          <button onClick={logQuote} disabled={!draftQuote.trim()} style={{ height: 26, padding: "0 13px", borderRadius: 99, border: `1px solid ${draftQuote.trim() ? AC.base : C.line}`, background: "none", color: draftQuote.trim() ? ACC : C.faint, fontFamily: SANS, fontSize: 11.5, fontWeight: 500, cursor: draftQuote.trim() ? "pointer" : "default", WebkitTapHighlightColor: "transparent" }}>Log quote</button>
        </div>
      </div>

      {/* STATS */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 18 }}>
        {[{ k: "This week", v: hm(readWeekTotal(read)) }, { k: "Streak", v: `${readStreak(read)}d`, acc: true }].map((s) => (
          <Card key={s.k} style={{ padding: "13px 14px" }}>
            <div style={{ fontFamily: SANS, fontSize: 9, fontWeight: 500, letterSpacing: 1.1, textTransform: "uppercase", color: NEU.n600 }}>{s.k}</div>
            <div style={{ fontFamily: SANS, fontSize: 21, fontWeight: 500, color: s.acc ? AC.a300 : C.ink, marginTop: 5, fontVariantNumeric: "tabular-nums", letterSpacing: -0.3 }}>{s.v}</div>
          </Card>
        ))}
      </div>

      {/* LIBRARY */}
      {/* Quotes are never truncated — the whole point is reading what they kept. */}
      {friendsApi?.quotes?.length > 0 && (<>
        <SectionLabel icon={<Quotes size={13} />}>Friends · last quote written down</SectionLabel>
        <div style={{ display: "flex", gap: 9, overflowX: "auto", scrollSnapType: "x mandatory", margin: "8px -17px 18px", padding: "0 17px 2px", scrollbarWidth: "none" }}>
          {friendsApi.quotes.map((q) => (
            <div key={q.id} style={{ scrollSnapAlign: "start", flexShrink: 0, width: 246, background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <div style={{ width: 24, height: 24, borderRadius: 12, border: `1px solid ${AC.a800}`, background: AC.a900, color: NEU.n200, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SANS, fontSize: 10.5, flexShrink: 0 }}>{(q.name || "?").trim().charAt(0).toUpperCase()}</div>
                <span style={{ fontFamily: SANS, fontSize: 12.5, color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{q.name}</span>
                <span style={{ fontFamily: SANS, fontSize: 11, color: NEU.n600, flexShrink: 0, marginLeft: "auto" }}>{timeAgo(q.created_at)}</span>
              </div>
              <div style={{ fontFamily: SANS, fontSize: 14.5, lineHeight: 1.5, color: C.ink }}>{q.text}</div>
              {q.source && <div style={{ fontFamily: SANS, fontSize: 11.5, color: NEU.n600, marginTop: 9 }}>{q.source}</div>}
            </div>
          ))}
        </div>
      </>)}

      <SectionLabel>Your library</SectionLabel>
      {quotes.length === 0 ? (
        <Card style={{ padding: 24, textAlign: "center" }}>
          <div style={{ fontFamily: SANS, fontSize: 13.5, color: C.sub, lineHeight: 1.55 }}>Nothing saved yet. Anything you write down above lands here, searchable.</div>
        </Card>
      ) : (<>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.card, border: `1px solid ${C.line}`, borderRadius: 8, padding: "0 12px", height: 38, marginBottom: 10 }}>
          <Search size={15} color={C.faint} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${quotes.length} quote${quotes.length === 1 ? "" : "s"}`} style={{ border: "none", outline: "none", background: "transparent", fontFamily: SANS, fontSize: 16, color: C.ink, flex: 1, minWidth: 0 }} />
          {q && <X size={15} color={C.faint} onClick={() => setQ("")} style={{ cursor: "pointer" }} />}
        </div>
        {counts.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
            {counts.slice(0, 6).map(({ tag, n }) => {
              const on = needle === tag;
              return <button key={tag} onClick={() => setQ(on ? "" : tag)} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 11px", borderRadius: 99, border: on ? `1px solid ${AC.base}` : "none", background: on ? ACC_BG : NEU.n900, color: on ? ACC : C.ink, fontFamily: SANS, fontSize: 11.5, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>#{tag} <span style={{ color: on ? ACC : NEU.n600 }}>{n}</span></button>;
            })}
          </div>
        )}
        {shown.length === 0 ? (
          <div style={{ fontFamily: SANS, fontSize: 13.5, color: C.sub, textAlign: "center", padding: "18px 0" }}>Nothing matches “{q}”.</div>
        ) : shown.map((qt) => (
          <Card key={qt.id} style={{ padding: 15, marginBottom: 9 }}>
            <div style={{ fontFamily: SANS, fontSize: 14.5, lineHeight: 1.5, color: C.ink }}>{qt.text}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
              {qt.tag && <span style={{ fontFamily: SANS, fontSize: 11, color: ACC, background: ACC_BG, padding: "3px 8px", borderRadius: 99 }}>#{qt.tag}</span>}
              <span style={{ fontFamily: SANS, fontSize: 11.5, color: NEU.n600, flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{qt.source || fmtDate(qt.createdAt)}</span>
              <button onClick={() => removeQuote(qt.id)} aria-label="Delete quote" style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex", flexShrink: 0, WebkitTapHighlightColor: "transparent" }}><Trash2 size={14} color={C.faint} /></button>
            </div>
          </Card>
        ))}
      </>)}

      {tagOpen && <TagSheet quotes={quotes} current={draftTag} onPick={(t) => { setDraftTag(t); setTagOpen(false); }} onClose={() => setTagOpen(false)} />}
    </div>
  );
}

/* ================================================================
   FINANCE — mortgage-centred, never shared
================================================================ */
const sheetShell = { width: "100%", maxWidth: 430, background: C.card, borderRadius: "14px 14px 0 0", boxShadow: C.shadowLg, padding: "18px 17px 26px", maxHeight: "86vh", overflowY: "auto" };
const sheetScrim = { position: "fixed", inset: 0, background: C.scrim, zIndex: 60, display: "flex", alignItems: "flex-end", justifyContent: "center" };
const grabHandle = { width: 36, height: 3, borderRadius: 2, background: C.line, margin: "0 auto 18px" };
const finField = { width: "100%", background: C.page, border: `1px solid ${C.line}`, borderRadius: 8, padding: "11px 12px", fontFamily: SANS, fontSize: 16, color: C.ink, outline: "none" };
const finLabel = { fontFamily: SANS, fontSize: 10, fontWeight: 500, letterSpacing: 1.6, textTransform: "uppercase", color: NEU.n500, marginBottom: 6 };
const sheetBtn = { flex: 1, height: 44, borderRadius: 8, background: "none", cursor: "pointer", fontFamily: SANS, fontSize: 14.5, fontWeight: 500, WebkitTapHighlightColor: "transparent" };

function LoanSheet({ group, currency, onSave, onDelete, onClose }) {
  const [name, setName] = useState(group.name || "");
  const [valuation, setValuation] = useState(String(group.valuation ?? ""));
  const [loans, setLoans] = useState((group.loans || []).map((l) => ({ ...l })));
  const [extra, setExtra] = useState(group.overpayment || 0);
  const [confirmDel, setConfirmDel] = useState(false);
  const setLoan = (i, k, v) => setLoans((ls) => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  const num = (s) => { const n = parseFloat(String(s).replace(/[^0-9.\-]/g, "")); return isNaN(n) ? 0 : n; };
  const clean = loans.map((l) => ({ ...l, balance: num(l.balance), ratePct: num(l.ratePct), paymentMonthly: num(l.paymentMonthly) }));
  const base = simulateLoans(clean, 0);
  const withExtra = simulateLoans(clean, extra);
  const sooner = base.settles && withExtra.settles ? base.months - withExtra.months : 0;
  const t = groupTotals({ loans: clean });
  return (
    <div onClick={onClose} style={sheetScrim}>
      <div onClick={(e) => e.stopPropagation()} style={sheetShell}>
        <div style={grabHandle} />
        <div style={finLabel}>Name</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Home" style={{ ...finField, fontSize: 17 }} />
          <Pencil size={14} color={C.faint} />
        </div>
        <div style={finLabel}>Valuation</div>
        <input value={valuation} onChange={(e) => setValuation(e.target.value)} inputMode="decimal" placeholder="1150000" style={{ ...finField, marginBottom: 16 }} />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ ...finLabel, marginBottom: 0 }}>{money(t.balance, currency)} across {clean.length} loan{clean.length === 1 ? "" : "s"}</div>
          <button onClick={() => setLoans((ls) => [...ls, { id: `ln_${Date.now()}`, name: `Loan ${ls.length + 1}`, balance: 0, ratePct: 0, paymentMonthly: 0 }])} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: SANS, fontSize: 12, color: ACC, WebkitTapHighlightColor: "transparent" }}>+ Add a loan</button>
        </div>
        {clean.map((l, i) => (
          <div key={l.id || i} style={{ background: C.page, borderRadius: 8, padding: 12, marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <input value={loans[i].name || ""} onChange={(e) => setLoan(i, "name", e.target.value)} placeholder={`Loan ${i + 1}`} style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontFamily: SANS, fontSize: 14, fontWeight: 500, color: C.ink }} />
              {loans.length > 1 && <button onClick={() => setLoans((ls) => ls.filter((_, j) => j !== i))} aria-label="Remove loan" style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex" }}><X size={14} color={C.faint} /></button>}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 1fr", gap: 6 }}>
              {[["balance", "Balance"], ["ratePct", "Rate %"], ["paymentMonthly", "Per mo"]].map(([k, ph]) => (
                <div key={k}>
                  <div style={{ fontFamily: SANS, fontSize: 9.5, color: NEU.n600, marginBottom: 3 }}>{ph}</div>
                  <input value={loans[i][k] ?? ""} onChange={(e) => setLoan(i, k, e.target.value)} inputMode="decimal" style={{ ...finField, padding: "8px 9px", fontSize: 14 }} />
                </div>
              ))}
            </div>
          </div>
        ))}

        <div style={{ ...finLabel, marginTop: 16 }}>Overpayment · {money(extra, currency)}/mo</div>
        <input type="range" min={0} max={1500} step={50} value={extra} onChange={(e) => setExtra(Number(e.target.value))} style={{ width: "100%", accentColor: AC.base, marginBottom: 12 }} />
        <div style={{ background: C.page, borderRadius: 8, padding: 12, marginBottom: 16 }}>
          <div style={{ fontFamily: SANS, fontSize: 11, color: NEU.n600, marginBottom: 9 }}>Across {clean.length === 1 ? "this loan" : "all loans"}</div>
          {[["Interest this month", money(withExtra.first.interest, currency)],
            ["Principal this month", money(withExtra.first.principal, currency)],
            ["Clear by", withExtra.settles ? monthLabel(addMonths(new Date(), withExtra.months)) : "Never at this payment"]].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "4px 0" }}>
              <span style={{ fontFamily: SANS, fontSize: 13, color: C.sub }}>{k}</span>
              <span style={{ fontFamily: SANS, fontSize: 13, color: C.ink, fontVariantNumeric: "tabular-nums" }}>{v}</span>
            </div>
          ))}
          {sooner > 0 && <div style={{ fontFamily: SANS, fontSize: 13, color: AC.a300, marginTop: 7, paddingTop: 7, borderTop: `1px solid ${C.lineSoft}` }}>{sooner >= 12 ? `${(sooner / 12).toFixed(1)} years sooner` : `${sooner} months sooner`}</div>}
        </div>

        {group.id && (confirmDel ? (
          <div style={{ background: C.redBg, borderRadius: 8, padding: 13, marginBottom: 14 }}>
            <div style={{ fontFamily: SANS, fontSize: 13.5, color: C.ink, lineHeight: 1.5, marginBottom: 10 }}>Delete {name || "this"} and its loans?</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setConfirmDel(false)} style={{ ...sheetBtn, height: 38, border: `1px solid ${C.line}`, color: C.sub }}>Keep it</button>
              <button onClick={onDelete} style={{ ...sheetBtn, height: 38, border: `1px solid ${C.red}`, color: C.red }}>Delete</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setConfirmDel(true)} style={{ display: "flex", alignItems: "center", gap: 7, background: "none", border: "none", cursor: "pointer", padding: "0 0 14px", fontFamily: SANS, fontSize: 13.5, color: C.red }}><Trash2 size={15} /> Delete</button>
        ))}
        <div style={{ display: "flex", gap: 9 }}>
          <button onClick={onClose} style={{ ...sheetBtn, border: `1px solid ${C.line}`, color: C.sub }}>Cancel</button>
          <button onClick={() => name.trim() && onSave({ name: name.trim(), valuation: num(valuation), loans: clean, overpayment: extra })} style={{ ...sheetBtn, border: `1px solid ${name.trim() ? AC.base : C.line}`, color: name.trim() ? ACC : C.faint }}>Save</button>
        </div>
      </div>
    </div>
  );
}

function GoalSheet({ group, currency, onSave, onClose }) {
  const loans = group.loans || [];
  const t = groupTotals(group);
  const base = simulateLoans(loans, group.overpayment || 0);
  const baseDate = base.settles ? addMonths(new Date(), base.months) : null;
  const [months, setMonths] = useState(() => {
    if (group.goalMonths) return group.goalMonths;
    return base.settles ? Math.max(12, base.months - 24) : 240;
  });
  const target = addMonths(new Date(), months);
  const needed = loans.reduce((n, l) => n + paymentFor(l.balance || 0, l.ratePct || 0, months), 0);
  const delta = needed - t.payment;
  const interestNow = base.settles ? base.interestPaid : null;
  const interestThen = needed * months - t.balance;
  const saved = interestNow != null ? interestNow - interestThen : null;
  const step = (n) => setMonths((m) => Math.max(12, Math.min(480, m + n)));
  return (
    <div onClick={onClose} style={sheetScrim}>
      <div onClick={(e) => e.stopPropagation()} style={sheetShell}>
        <div style={grabHandle} />
        <div style={finLabel}>Clear {group.name} by</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
          <button onClick={() => step(-12)} style={miniRound} aria-label="Earlier"><Minus size={17} /></button>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: SANS, fontSize: 22, fontWeight: 500, color: C.ink, letterSpacing: -0.4 }}>{monthLabel(target)}</div>
            <div style={{ fontFamily: SANS, fontSize: 12, color: NEU.n600, marginTop: 2 }}>{Math.round(months / 12)} years away</div>
          </div>
          <button onClick={() => step(12)} style={miniRound} aria-label="Later"><Plus size={17} /></button>
        </div>
        <div style={{ background: C.page, borderRadius: 8, padding: 12, marginBottom: 16 }}>
          {[["Pay", `${money(needed, currency)}/mo`],
            ["That is", `${delta >= 0 ? "+" : ""}${money(delta, currency)}/mo vs now`],
            ["Interest saved", saved != null && saved > 0 ? money(saved, currency) : saved != null ? `${money(-saved, currency)} more` : "—"]].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "5px 0" }}>
              <span style={{ fontFamily: SANS, fontSize: 13, color: C.sub }}>{k}</span>
              <span style={{ fontFamily: SANS, fontSize: 13, color: k === "Interest saved" && saved > 0 ? AC.a300 : C.ink, fontVariantNumeric: "tabular-nums" }}>{v}</span>
            </div>
          ))}
        </div>
        {baseDate && <div style={{ fontFamily: SANS, fontSize: 12, color: NEU.n600, marginBottom: 16, lineHeight: 1.5 }}>On your current payments these clear {monthLabel(baseDate)}.</div>}
        <div style={{ display: "flex", gap: 9 }}>
          <button onClick={onClose} style={{ ...sheetBtn, border: `1px solid ${C.line}`, color: C.sub }}>Cancel</button>
          <button onClick={() => onSave(months)} style={{ ...sheetBtn, border: `1px solid ${AC.base}`, color: ACC }}>Set goal</button>
        </div>
      </div>
    </div>
  );
}

function QuarterlyUpdateSheet({ fin, onSave, onClose }) {
  const [cadence, setCadence] = useState(fin.cadence || "quarterly");
  const [groups, setGroups] = useState(() => (fin.groups || []).map((g) => ({ ...g, loans: (g.loans || []).map((l) => ({ ...l })) })));
  const num = (s) => { const n = parseFloat(String(s).replace(/[^0-9.\-]/g, "")); return isNaN(n) ? 0 : n; };
  const setL = (gi, li, k, v) => setGroups((gs) => gs.map((g, i) => i !== gi ? g : { ...g, loans: g.loans.map((l, j) => (j === li ? { ...l, [k]: v } : l)) }));
  const setG = (gi, k, v) => setGroups((gs) => gs.map((g, i) => (i === gi ? { ...g, [k]: v } : g)));
  return (
    <div onClick={onClose} style={sheetScrim}>
      <div onClick={(e) => e.stopPropagation()} style={sheetShell}>
        <div style={grabHandle} />
        <h2 style={{ fontFamily: SANS, fontSize: 20, fontWeight: 500, color: C.ink, margin: "0 0 4px", letterSpacing: -0.3 }}>Check in</h2>
        <div style={{ fontFamily: SANS, fontSize: 12.5, color: C.sub, marginBottom: 16, lineHeight: 1.5 }}>Enter what the statements actually say. Every projection re-bases on these numbers.</div>
        <div style={finLabel}>Cadence</div>
        <div style={{ marginBottom: 16 }}><Segmented small options={[{ v: "monthly", l: "Monthly" }, { v: "quarterly", l: "Quarterly" }]} value={cadence} onChange={setCadence} /></div>
        {groups.map((g, gi) => {
          const tt = groupTotals({ loans: g.loans.map((l) => ({ ...l, balance: num(l.balance), ratePct: num(l.ratePct), paymentMonthly: num(l.paymentMonthly) })) });
          return (
            <div key={g.id} style={{ marginBottom: 16 }}>
              <div style={{ ...finLabel, marginBottom: 6 }}>{g.name}</div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontFamily: SANS, fontSize: 9.5, color: NEU.n600, marginBottom: 3 }}>Valuation</div>
                <input value={g.valuation ?? ""} onChange={(e) => setG(gi, "valuation", e.target.value)} inputMode="decimal" style={{ ...finField, padding: "9px 11px", fontSize: 15 }} />
              </div>
              {g.loans.map((l, li) => (
                <div key={l.id || li} style={{ background: C.page, borderRadius: 8, padding: 11, marginBottom: 7 }}>
                  <div style={{ fontFamily: SANS, fontSize: 12.5, fontWeight: 500, color: C.ink, marginBottom: 7 }}>{l.name || `Loan ${li + 1}`}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 1fr", gap: 6 }}>
                    {[["balance", "Balance"], ["ratePct", "Rate %"], ["paymentMonthly", "Per mo"]].map(([k, ph]) => (
                      <div key={k}>
                        <div style={{ fontFamily: SANS, fontSize: 9.5, color: NEU.n600, marginBottom: 3 }}>{ph}</div>
                        <input value={l[k] ?? ""} onChange={(e) => setL(gi, li, k, e.target.value)} inputMode="decimal" style={{ ...finField, padding: "8px 9px", fontSize: 14 }} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {g.loans.length > 1 && <div style={{ fontFamily: SANS, fontSize: 11.5, color: NEU.n600, padding: "2px 2px 0" }}>Combined {money(tt.balance, fin.currency)} · {tt.avgRate.toFixed(2)}% weighted · {money(tt.payment, fin.currency)}/mo</div>}
            </div>
          );
        })}
        <div style={{ display: "flex", gap: 9 }}>
          <button onClick={onClose} style={{ ...sheetBtn, border: `1px solid ${C.line}`, color: C.sub }}>Cancel</button>
          <button onClick={() => onSave({ cadence, groups: groups.map((g) => ({ ...g, valuation: num(g.valuation), loans: g.loans.map((l) => ({ ...l, balance: num(l.balance), ratePct: num(l.ratePct), paymentMonthly: num(l.paymentMonthly) })) })) })} style={{ ...sheetBtn, border: `1px solid ${AC.base}`, color: ACC }}>Save</button>
        </div>
      </div>
    </div>
  );
}

function Finance({ fin, setFin, onSettings }) {
  const [sheet, setSheet] = useState(null);
  const cur = fin.currency || "GBP";
  const groups = fin.groups || [];
  const home = groups.find((g) => g.kind === "home") || groups[0] || null;

  const saveGroup = (id, patch) => setFin((f) => ({ ...f, groups: id ? f.groups.map((g) => (g.id === id ? { ...g, ...patch } : g)) : [...(f.groups || []), { id: `gp_${Date.now()}`, kind: (f.groups || []).length === 0 ? "home" : "other", goalMonths: null, overpayment: 0, ...patch }] }));
  const removeGroup = (id) => setFin((f) => ({ ...f, groups: f.groups.filter((g) => g.id !== id) }));

  const homeProj = home ? simulateLoans(home.loans || [], home.overpayment || 0) : null;
  const freeDate = homeProj?.settles ? addMonths(new Date(), homeProj.months) : null;
  const goalDate = home?.goalMonths ? addMonths(new Date(), home.goalMonths) : null;
  const drift = freeDate && goalDate ? monthsBetween(goalDate, freeDate) : null;
  const ht = home ? groupTotals(home) : null;
  const equity = home && home.valuation ? home.valuation - ht.balance : null;
  const equityPct = equity != null && home.valuation ? Math.round((equity / home.valuation) * 100) : null;

  const nextDue = fin.lastUpdated ? addMonths(new Date(fin.lastUpdated), fin.cadence === "monthly" ? 1 : 3) : new Date();
  const overdue = nextDue <= new Date();

  const cell = { flex: 1, padding: "12px 13px", minWidth: 0 };
  return (
    <div style={{ padding: "6px 17px 24px" }}>
      <div style={{ fontFamily: SANS, fontSize: 10, fontWeight: 500, letterSpacing: 1.6, textTransform: "uppercase", color: NEU.n500 }}>
        {fin.lastUpdated ? `Updated ${fmtDate(fin.lastUpdated)}` : "Not checked in yet"}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, margin: "8px 0 20px" }}>
        <h1 style={{ fontFamily: SANS, fontSize: 27, fontWeight: 500, color: C.ink, margin: 0, letterSpacing: -0.54 }}>Finance</h1>
        <button onClick={onSettings} aria-label="Settings" style={{ width: 32, height: 32, flexShrink: 0, borderRadius: 16, border: `1px solid ${AC.base}`, background: "none", color: ACC, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}><GearSix size={16} /></button>
      </div>

      {groups.length === 0 ? (
        <Card style={{ padding: 26, textAlign: "center", marginBottom: 16 }}>
          <div style={{ fontFamily: SANS, fontSize: 17, fontWeight: 500, color: C.ink, letterSpacing: -0.2 }}>No loans yet</div>
          <div style={{ fontFamily: SANS, fontSize: 13.5, color: C.sub, margin: "7px 0 16px", lineHeight: 1.55 }}>Add a property and the loans against it. Everything here is worked out from the balances, rates and payments you enter.</div>
          <button onClick={() => setSheet({ group: { loans: [{ id: `ln_${Date.now()}`, name: "Loan 1", balance: 0, ratePct: 0, paymentMonthly: 0 }] } })} style={{ height: 40, padding: "0 18px", borderRadius: 8, border: `1px solid ${AC.base}`, background: "none", color: ACC, fontFamily: SANS, fontSize: 14, fontWeight: 500, cursor: "pointer" }}>Add a loan</button>
        </Card>
      ) : (<>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "0 2px 8px" }}>
          <Eyebrow>Your loans · tap to edit</Eyebrow>
          <button onClick={() => setSheet({ group: { loans: [{ id: `ln_${Date.now()}`, name: "Loan 1", balance: 0, ratePct: 0, paymentMonthly: 0 }] } })} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: SANS, fontSize: 11.5, color: ACC, WebkitTapHighlightColor: "transparent" }}>+ Add a loan</button>
        </div>
        {groups.map((g) => {
          const t = groupTotals(g), isHome = g.kind === "home";
          return (
            <button key={g.id} onClick={() => setSheet({ group: g })} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", background: C.card, border: `1px solid ${isHome ? AC.a800 : C.line}`, borderRadius: 14, padding: "14px 15px", marginBottom: 9, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
              <div style={{ width: 38, height: 38, borderRadius: 8, background: C.page, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{isHome ? <Home size={18} color={ACC} /> : <Car size={18} color={C.sub} />}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: SANS, fontSize: 14.5, fontWeight: 500, color: C.ink }}>{g.name}{t.count > 1 ? ` · ${t.count} loans` : ""}</div>
                <div style={{ fontFamily: SANS, fontSize: 12, color: NEU.n600, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>{t.avgRate.toFixed(2)}%{t.count > 1 ? " avg" : ""} · {money(t.payment, cur)}/mo</div>
              </div>
              <div style={{ fontFamily: SANS, fontSize: 15, fontWeight: 500, color: C.ink, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{money(t.balance, cur)}</div>
            </button>
          );
        })}

        {home && (<>
          <Card style={{ display: "flex", padding: 0, overflow: "hidden", margin: "16px 0 12px" }}>
            <div style={{ ...cell, position: "relative", paddingLeft: 15 }}>
              <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 2, background: AC.base }} />
              <div style={{ fontFamily: SANS, fontSize: 9, fontWeight: 500, letterSpacing: 1.1, textTransform: "uppercase", color: NEU.n600, whiteSpace: "nowrap" }}>Mortgage free</div>
              <div style={{ fontFamily: SANS, fontSize: 15, fontWeight: 500, color: C.ink, marginTop: 5, whiteSpace: "nowrap" }}>{freeDate ? monthLabel(freeDate) : "—"}</div>
              {drift != null && <div style={{ fontFamily: SANS, fontSize: 10.5, color: drift > 0 ? C.amber : AC.a300, marginTop: 2, whiteSpace: "nowrap" }}>{drift === 0 ? "on goal" : drift > 0 ? `${drift}mo behind` : `${-drift}mo ahead`}</div>}
            </div>
            <div style={{ ...cell, borderLeft: `1px solid ${NEU.n900}` }}>
              <div style={{ fontFamily: SANS, fontSize: 9, fontWeight: 500, letterSpacing: 1.1, textTransform: "uppercase", color: NEU.n600 }}>Interest</div>
              <div style={{ fontFamily: SANS, fontSize: 15, fontWeight: 500, color: C.ink, marginTop: 5, fontVariantNumeric: "tabular-nums" }}>{money(homeProj.first.interest, cur)}</div>
              <div style={{ fontFamily: SANS, fontSize: 10.5, color: NEU.n600, marginTop: 2 }}>this month</div>
            </div>
            <div style={{ ...cell, borderLeft: `1px solid ${NEU.n900}` }}>
              <div style={{ fontFamily: SANS, fontSize: 9, fontWeight: 500, letterSpacing: 1.1, textTransform: "uppercase", color: NEU.n600 }}>Principal</div>
              <div style={{ fontFamily: SANS, fontSize: 15, fontWeight: 500, color: C.ink, marginTop: 5, fontVariantNumeric: "tabular-nums" }}>{money(homeProj.first.principal, cur)}</div>
              <div style={{ fontFamily: SANS, fontSize: 10.5, color: NEU.n600, marginTop: 2 }}>this month</div>
            </div>
          </Card>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 18, padding: "0 2px" }}>
            <span style={{ fontFamily: SANS, fontSize: 12.5, color: C.sub, minWidth: 0 }}>{goalDate ? `Goal ${monthLabel(goalDate)} · ${home.name}` : `No goal set for ${home.name}`}</span>
            <button onClick={() => setSheet({ goal: home })} style={{ height: 28, padding: "0 12px", borderRadius: 8, border: `1px solid ${AC.base}`, background: "none", color: ACC, fontFamily: SANS, fontSize: 12, fontWeight: 500, cursor: "pointer", flexShrink: 0, WebkitTapHighlightColor: "transparent" }}>{goalDate ? "Update goal" : "Set goal"}</button>
          </div>

          {equity != null && home.valuation > 0 && (<>
            <Eyebrow>Your equity</Eyebrow>
            <Card style={{ padding: 16, margin: "8px 0 18px" }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
                <span style={{ fontFamily: SANS, fontSize: 24, fontWeight: 500, color: C.ink, fontVariantNumeric: "tabular-nums", letterSpacing: -0.4 }}>{money(equity, cur)}</span>
                <span style={{ fontFamily: SANS, fontSize: 12, color: NEU.n600 }}>{equityPct}% of {moneyShort(home.valuation, cur)}</span>
              </div>
              <div style={{ display: "flex", height: 4, borderRadius: 2, overflow: "hidden", background: NEU.n900, marginTop: 12 }}>
                <div style={{ width: `${Math.max(0, Math.min(100, equityPct))}%`, background: AC.base }} />
              </div>
            </Card>
          </>)}
        </>)}

        <button onClick={() => setSheet("update")} style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", textAlign: "left", background: C.card, border: `1px solid ${overdue ? AC.a800 : C.line}`, borderRadius: 14, padding: "14px 15px", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
          <Bell size={17} color={overdue ? ACC : C.faint} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: SANS, fontSize: 14, fontWeight: 500, color: C.ink }}>{overdue ? `${fin.cadence === "monthly" ? "Monthly" : "Quarterly"} update due` : "Next check-in"}</div>
            <div style={{ fontFamily: SANS, fontSize: 11.5, color: NEU.n600, marginTop: 2 }}>{monthLabel(nextDue)} · valuation, balance, rate</div>
          </div>
          <span style={{ height: 28, padding: "0 12px", borderRadius: 8, border: `1px solid ${AC.base}`, color: ACC, fontFamily: SANS, fontSize: 12, fontWeight: 500, display: "flex", alignItems: "center", flexShrink: 0 }}>Update</span>
        </button>
      </>)}

      {sheet === "update" && <QuarterlyUpdateSheet fin={fin} onClose={() => setSheet(null)}
        onSave={({ cadence, groups: gs }) => { setFin((f) => ({ ...f, cadence, groups: gs, lastUpdated: new Date().toISOString() })); setSheet(null); }} />}
      {sheet?.goal && <GoalSheet group={sheet.goal} currency={cur} onClose={() => setSheet(null)}
        onSave={(m) => { saveGroup(sheet.goal.id, { goalMonths: m }); setSheet(null); }} />}
      {sheet?.group && <LoanSheet group={sheet.group} currency={cur} onClose={() => setSheet(null)}
        onSave={(patch) => { saveGroup(sheet.group.id, patch); if (!fin.lastUpdated) setFin((f) => ({ ...f, lastUpdated: new Date().toISOString() })); setSheet(null); }}
        onDelete={() => { removeGroup(sheet.group.id); setSheet(null); }} />}
    </div>
  );
}

/* ================================================================
   PILLARS — the five lifestyle modules. Train ships first; the rest are
   visible but locked. Adding one later is a `locked: false` flip plus a
   render line, not a shell rewrite.
================================================================ */
const PILLARS = [
  { id: "today", label: "Today", Icon: Home },
  { id: "train", label: "Train", Icon: Dumbbell },
  { id: "read", label: "Read", Icon: BookOpen },
  { id: "habits", label: "Habits", Icon: Target },
  { id: "finance", label: "Finance", Icon: Wallet },
];
// screens reachable by `go()` but with no tab of their own — they light up their parent pillar
const TAB_PARENT = { programs: "train" };

function LockedScreen({ label, Icon, blurb }) {
  return (
    <div style={{ padding: "78px 34px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
      <div style={{ width: 86, height: 86, borderRadius: 43, border: `2px dashed ${C.line}`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 22 }}>
        <Icon size={34} color={C.faint} />
      </div>
      <div style={{ fontFamily: SANS, fontSize: 19, fontWeight: 500, color: C.sub, letterSpacing: -0.2 }}>{label}</div>
      <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: 1.5, textTransform: "uppercase", color: C.faint, fontWeight: 500, margin: "10px 0 12px" }}>Not built yet</div>
      <div style={{ fontFamily: SANS, fontSize: 13.5, color: C.faint, lineHeight: 1.6, maxWidth: 250 }}>{blurb}</div>
    </div>
  );
}

export default function App() {
  // This used to delete profile, weigh-ins, programs and history whenever VER changed — a
  // silent, unrecoverable wipe triggered by editing one constant. Fine for a prototype,
  // unacceptable now it holds real training history. It only records the version now; if a
  // stored shape ever genuinely changes, migrate it here rather than deleting it.
  useState(() => { if (loadLS("wa_ver", null) !== VER) saveLS("wa_ver", VER); return null; });
  useAutoSnapshot();
  const sync = useSync();
  const [profile, setProfile] = usePersist("wa_profile", { onboarded: false });
  const [weightLog, setWeightLog] = usePersist("wa_weightlog", {});
  const [programs, setPrograms] = usePersist("wa_programs", []);
  const [history, setHistory] = usePersist("wa_history", []);
  const [draft, setDraft] = usePersist("wa_draft", null);
  const [maxes, setMaxes] = usePersist("wa_maxes", {});
  const [equipment, setEquipment] = usePersist("wa_equipment", DEFAULT_EQUIPMENT);
  const [habits, setHabits] = usePersist("wa_habits", []);
  const [read, setRead] = usePersist("wa_read", READ_DEFAULT);
  const [fin, setFin] = usePersist("wa_finance", FIN_DEFAULT);
  // after the state it reads, or it would touch these bindings before they exist
  const friendsApi = useFriends(sync, habits, read, profile);
  const [tab, setTab] = useState("today");
  const [settingsOpen, setSettingsOpen] = useState(false);
  // one-time cleanup: drop the old auto-seeded p1/p2/p3 defaults if they were never actually started
  useEffect(() => { setPrograms((ps) => ps.filter((p) => !(["p1", "p2", "p3"].includes(p.id) && !p.startedAt && !p.completedAt))); }, []);

  if (!profile.onboarded) return <Onboarding onDone={(p) => setProfile(p)} />;

  const finishSession = (session, updatedDays, readiness) => { setPrograms((ps) => ps.map((p) => p.id === session.programId ? { ...p, days: updatedDays, lastReadiness: readiness } : p)); setHistory((h) => [...h, session]); };
  const reorderSchedule = (id, scheduleDays) => setPrograms((ps) => ps.map((p) => p.id === id ? { ...p, scheduleDays } : p));
  const resetAll = () => { try { ["wa_profile", "wa_weightlog", "wa_programs", "wa_history", "wa_draft", "wa_maxes", "wa_equipment", "wa_habits", "wa_read", "wa_finance"].forEach((k) => localStorage.removeItem(k)); } catch {} setWeightLog({}); setPrograms([]); setHistory([]); setDraft(null); setMaxes({}); setEquipment(DEFAULT_EQUIPMENT); setHabits([]); setRead(READ_DEFAULT); setFin(FIN_DEFAULT); setProfile({ onboarded: false }); setTab("today"); setSettingsOpen(false); };

  const pillar = PILLARS.find((p) => p.id === tab);
  const navId = TAB_PARENT[tab] ?? tab;
  const openSettings = () => setSettingsOpen(true);
  return (
    <div className="app-shell" style={{ background: C.page, display: "flex", justifyContent: "center", fontFamily: SANS }}>
      <div style={{ width: "100%", maxWidth: 430, background: C.page, display: "flex", flexDirection: "column", height: "100%" }}>
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch", paddingTop: 14 }}>
          {pillar?.locked && <LockedScreen label={pillar.label} Icon={pillar.Icon} blurb={pillar.blurb} />}
          {tab === "today" && <Dashboard profile={profile} weightLog={weightLog} setWeightLog={setWeightLog} programs={programs} history={history} habits={habits} setHabits={setHabits} read={read} go={setTab} onSettings={openSettings} />}
          {tab === "train" && <Train profile={profile} programs={programs} history={history} draft={draft} setDraft={setDraft} onFinish={finishSession} onReorderSchedule={reorderSchedule} go={setTab} equipment={equipment} setEquipment={setEquipment} />}
          {tab === "read" && <Read read={read} setRead={setRead} friendsApi={friendsApi} />}
          {tab === "finance" && <Finance fin={fin} setFin={setFin} onSettings={openSettings} />}
          {tab === "habits" && <Habits habits={habits} setHabits={setHabits} friendsApi={friendsApi} />}
          {tab === "programs" && <Programs programs={programs} setPrograms={setPrograms} history={history} maxes={maxes} setMaxes={setMaxes} go={setTab} />}
        </div>
        <div style={{ flexShrink: 0, background: "rgba(22,24,38,0.92)", backdropFilter: "blur(12px)", borderTop: `1px solid ${C.line}`, display: "flex", padding: "8px 8px max(22px, env(safe-area-inset-bottom))" }}>
          {PILLARS.map((p) => { const on = navId === p.id, Icon = p.Icon; return (
            <button key={p.id} onClick={() => setTab(p.id)} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "8px 0", WebkitTapHighlightColor: "transparent" }}>
              <div style={{ position: "relative", display: "flex" }}>
                <Icon size={23} color={on ? ACC : C.faint} weight={on ? "fill" : "regular"} />
                {p.locked && <div style={{ position: "absolute", right: -5, bottom: -2, width: 13, height: 13, borderRadius: 7, background: C.faint, display: "flex", alignItems: "center", justifyContent: "center" }}><LockSimple size={8} weight="fill" color={C.page} /></div>}
              </div>
              <span style={{ fontFamily: SANS, fontSize: 11, fontWeight: on ? 600 : 500, color: on ? ACC : C.faint }}>{p.label}</span>
            </button>); })}
        </div>
      </div>
      {settingsOpen && <SettingsSheet profile={profile} setProfile={setProfile} programs={programs} history={history} weightLog={weightLog} onReset={resetAll} equipment={equipment} setEquipment={setEquipment} fin={fin} setFin={setFin} sync={sync} friendsApi={friendsApi} onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
