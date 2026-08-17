import { supabase, syncConfigured } from "./supabase";

/* Local-first sync.
   localStorage stays the working store — the app reads and writes it exactly as before and
   keeps functioning with no network, which matters because this gets used in gyms. This
   layer copies that store up and merges what comes back down. */

// wa_draft is deliberately absent: an in-progress session belongs to the device you are
// holding. Syncing it would let two phones fight over a live workout.
export const SYNC_KEYS = ["wa_profile", "wa_weightlog", "wa_programs", "wa_history", "wa_maxes", "wa_equipment", "wa_habits", "wa_read", "wa_finance"];
const LAST_PULL_KEY = "wa_sync_pulled_at";

const readLocal = (k) => { try { const v = localStorage.getItem(k); return v != null ? JSON.parse(v) : null; } catch { return null; } };
const writeLocal = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

/* ---- merges ----
   Only two keys are genuinely append-shaped, and those are the ones where last-write-wins
   would actually destroy something: a session or a weigh-in recorded on a phone that was
   offline. Everything else is a settings-like blob where the newer write is the right one. */

const sessionKey = (s) => `${s?.date}|${s?.programId}|${s?.dayIdx}`;
export function mergeHistory(local = [], remote = []) {
  const m = new Map();
  [...(remote || []), ...(local || [])].forEach((s) => {
    if (!s || !s.date) return;
    const k = sessionKey(s), prev = m.get(k);
    // Same session on both sides means one device logged more of it. Keep the fuller one
    // rather than the later one — a half-finished session should not overwrite a complete one.
    if (!prev || (s.sets?.length || 0) > (prev.sets?.length || 0)) m.set(k, s);
  });
  return [...m.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

// Date-keyed, one number each. Union the dates; a local entry wins a clash because it is
// what the user most recently typed on this device.
export const mergeWeightLog = (local = {}, remote = {}) => ({ ...(remote || {}), ...(local || {}) });

// Union by habit id, and union each habit's ticks so a day ticked offline on another device
// survives. Known limitation: a habit deleted on one device can reappear from a stale one,
// because there are no tombstones yet. Losing a week of ticks is worse than a resurrected row.
export function mergeHabits(local = [], remote = []) {
  const m = new Map();
  (remote || []).forEach((h) => h?.id && m.set(h.id, h));
  (local || []).forEach((h) => {
    if (!h?.id) return;
    const r = m.get(h.id);
    m.set(h.id, r ? { ...r, ...h, ticks: { ...(r.ticks || {}), ...(h.ticks || {}) } } : h);
  });
  return [...m.values()];
}

// remoteNewer decides the settings-like keys. Server time is authoritative, so a device with
// a wrong clock cannot win by claiming the future.
export function mergeKey(key, local, remote, remoteNewer) {
  if (remote == null) return local;
  if (local == null) return remote;
  if (key === "wa_history") return mergeHistory(local, remote);
  if (key === "wa_weightlog") return mergeWeightLog(local, remote);
  if (key === "wa_habits") return mergeHabits(local, remote);
  return remoteNewer ? remote : local;
}

/* ---- transport ---- */

export async function pull(userId) {
  if (!syncConfigured) return { ok: false, reason: "not-configured" };
  const { data, error } = await supabase.from("app_data").select("key,value,updated_at").eq("user_id", userId);
  if (error) return { ok: false, reason: error.message };
  const lastPull = localStorage.getItem(LAST_PULL_KEY);
  let changed = 0;
  (data || []).forEach((row) => {
    if (!SYNC_KEYS.includes(row.key)) return;
    const local = readLocal(row.key);
    const remoteNewer = !lastPull || row.updated_at > lastPull;
    const merged = mergeKey(row.key, local, row.value, remoteNewer);
    if (JSON.stringify(merged) !== JSON.stringify(local)) { writeLocal(row.key, merged); changed++; }
  });
  localStorage.setItem(LAST_PULL_KEY, new Date().toISOString());
  return { ok: true, changed };
}

export async function push(userId) {
  if (!syncConfigured) return { ok: false, reason: "not-configured" };
  const rows = SYNC_KEYS.map((k) => ({ user_id: userId, key: k, value: readLocal(k) }))
    .filter((r) => r.value != null);
  if (!rows.length) return { ok: true, pushed: 0 };
  const { error } = await supabase.from("app_data").upsert(rows, { onConflict: "user_id,key" });
  if (error) return { ok: false, reason: error.message };
  return { ok: true, pushed: rows.length };
}

// Pull before push so anything only on the server lands here first and is not overwritten.
export async function syncNow(userId) {
  const pulled = await pull(userId);
  if (!pulled.ok) return pulled;
  const pushed = await push(userId);
  if (!pushed.ok) return pushed;
  return { ok: true, changed: pulled.changed, pushed: pushed.pushed };
}
