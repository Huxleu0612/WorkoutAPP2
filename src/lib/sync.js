import { supabase, syncConfigured } from "./supabase";

/* Local-first sync.
   localStorage stays the working store — the app reads and writes it exactly as before and
   keeps functioning with no network, which matters because this gets used in gyms. This
   layer copies that store up and merges what comes back down. */

// wa_draft is deliberately absent: an in-progress session belongs to the device you are
// holding. Syncing it would let two phones fight over a live workout.
export const SYNC_KEYS = ["wa_profile", "wa_weightlog", "wa_programs", "wa_history", "wa_maxes", "wa_equipment", "wa_habits", "wa_read", "wa_finance"];
const LAST_PULL_KEY = "wa_sync_pulled_at";
const TOUCH_KEY = "wa_touched";

/* When this device last changed each key. Without this, "is the remote newer?" was answered
   against the time of the last pull, which says nothing about when you last typed — so a
   stale server row would happily overwrite an edit made seconds ago. */
export function touchKey(k) {
  try {
    const m = JSON.parse(localStorage.getItem(TOUCH_KEY) || "{}");
    m[k] = new Date().toISOString();
    localStorage.setItem(TOUCH_KEY, JSON.stringify(m));
  } catch {}
}
const touchedAt = (k) => { try { return JSON.parse(localStorage.getItem(TOUCH_KEY) || "{}")[k] || null; } catch { return null; } };

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

// Programs carry ids, so union them the same way as habits. Two devices that each added a
// program both keep it, and neither can erase the other's by being written to later.
export function mergePrograms(local = [], remote = []) {
  const m = new Map();
  (remote || []).forEach((p) => p?.id && m.set(p.id, p));
  (local || []).forEach((p) => {
    if (!p?.id) return;
    const r = m.get(p.id);
    // Local wins the body of a program it already knows about — it holds the edits you just
    // made — but a program only the server has still comes down.
    m.set(p.id, r ? { ...r, ...p } : p);
  });
  return [...m.values()];
}

// "Empty" is indistinguishable from "brand new device" in the data, which is why an empty
// value must never be treated as an intentional wipe.
export const isEmptyValue = (v) =>
  v == null || (Array.isArray(v) && v.length === 0) || (typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0);

// remoteNewer decides the settings-like keys. Server time is authoritative, so a device with
// a wrong clock cannot win by claiming the future.
export function mergeKey(key, local, remote, remoteNewer) {
  if (remote == null) return local;
  if (local == null) return remote;
  if (key === "wa_history") return mergeHistory(local, remote);
  if (key === "wa_weightlog") return mergeWeightLog(local, remote);
  if (key === "wa_habits") return mergeHabits(local, remote);
  if (key === "wa_programs") return mergePrograms(local, remote);
  // An empty remote is never allowed to blank out real local data, whatever the timestamps
  // say. Losing a program library to a phone that happened to sync later is unacceptable.
  if (isEmptyValue(remote) && !isEmptyValue(local)) return local;
  return remoteNewer ? remote : local;
}

/* ---- transport ---- */

export async function pull(userId) {
  if (!syncConfigured) return { ok: false, reason: "not-configured" };
  const { data, error } = await supabase.from("app_data").select("key,value,updated_at").eq("user_id", userId);
  if (error) return { ok: false, reason: error.message };
  let changed = 0;
  (data || []).forEach((row) => {
    if (!SYNC_KEYS.includes(row.key)) return;
    const local = readLocal(row.key);
    // Compare the server's write against this device's last edit of the same key, not
    // against when we last pulled. An edit made a moment ago must beat an older server row.
    const localTouched = touchedAt(row.key);
    const remoteNewer = !localTouched || row.updated_at > localTouched;
    const merged = mergeKey(row.key, local, row.value, remoteNewer);
    if (JSON.stringify(merged) !== JSON.stringify(local)) { writeLocal(row.key, merged); changed++; }
  });
  localStorage.setItem(LAST_PULL_KEY, new Date().toISOString());
  return { ok: true, changed };
}

export async function push(userId) {
  if (!syncConfigured) return { ok: false, reason: "not-configured" };
  // Empty values are never pushed. A device that has just signed in and holds nothing yet
  // would otherwise publish that emptiness as fact and blank out every other device.
  // The cost is that genuinely deleting everything does not propagate, which is the right
  // way round to be wrong.
  const rows = SYNC_KEYS.map((k) => ({ user_id: userId, key: k, value: readLocal(k) }))
    .filter((r) => !isEmptyValue(r.value));
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
