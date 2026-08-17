import { supabase, syncConfigured } from "./supabase";

/* Friends.
   Nothing here reads app_data. Sharing works by publishing a deliberately small, derived
   slice — a monthly habit percentage, and whichever quotes you logged — into their own
   tables. Finance and training are not represented at all, by design rather than omission. */

const ok = (data) => ({ ok: true, data });
const fail = (e) => ({ ok: false, reason: e?.message || String(e) });

export async function ensureProfile(user, displayName) {
  if (!syncConfigured || !user) return fail("not signed in");
  const { error } = await supabase.from("profiles").upsert(
    { user_id: user.id, display_name: (displayName || user.email || "").trim() || null, updated_at: new Date().toISOString() },
    { onConflict: "user_id" }
  );
  return error ? fail(error) : ok(true);
}

/* ---------- invites ---------- */

export async function sendInvite(user, email) {
  if (!syncConfigured || !user) return fail("not signed in");
  const clean = String(email || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) return fail("That does not look like an email address.");
  if (clean === (user.email || "").toLowerCase()) return fail("That is your own address.");
  const { error } = await supabase.from("invites").upsert(
    { inviter_id: user.id, email: clean, created_at: new Date().toISOString(), accepted_at: null },
    { onConflict: "inviter_id,email" }
  );
  return error ? fail(error) : ok(true);
}

// Invites you have sent that nobody has picked up yet.
export async function listSentInvites(user) {
  if (!syncConfigured || !user) return ok([]);
  const { data, error } = await supabase.from("invites").select("id,email,created_at,accepted_at").eq("inviter_id", user.id).is("accepted_at", null);
  return error ? fail(error) : ok(data || []);
}

// Invites addressed to your email. RLS is what makes this safe: the policy compares against
// the email inside your own token, so this cannot be pointed at anyone else.
export async function listIncomingInvites(user) {
  if (!syncConfigured || !user) return ok([]);
  const { data, error } = await supabase.from("invites").select("id,inviter_id,created_at").is("accepted_at", null).neq("inviter_id", user.id);
  if (error) return fail(error);
  const rows = data || [];
  if (!rows.length) return ok([]);
  const names = await namesFor(rows.map((r) => r.inviter_id));
  return ok(rows.map((r) => ({ ...r, name: names[r.inviter_id] || "Someone" })));
}

export async function acceptInvite(user, invite) {
  if (!syncConfigured || !user) return fail("not signed in");
  const { error: fe } = await supabase.from("friendships").insert({ requester_id: invite.inviter_id, addressee_id: user.id, status: "accepted" });
  // A duplicate just means you were already connected, which is not a failure.
  if (fe && !/duplicate|unique/i.test(fe.message)) return fail(fe);
  const { error } = await supabase.from("invites").update({ accepted_at: new Date().toISOString() }).eq("id", invite.id);
  return error ? fail(error) : ok(true);
}

export async function declineInvite(invite) {
  if (!syncConfigured) return fail("not configured");
  const { error } = await supabase.from("invites").delete().eq("id", invite.id);
  return error ? fail(error) : ok(true);
}

export async function cancelInvite(invite) { return declineInvite(invite); }

/* ---------- connections ---------- */

async function namesFor(ids) {
  const uniq = [...new Set(ids)].filter(Boolean);
  if (!uniq.length) return {};
  const { data } = await supabase.from("profiles").select("user_id,display_name").in("user_id", uniq);
  const out = {};
  (data || []).forEach((p) => { out[p.user_id] = p.display_name; });
  return out;
}

export async function listFriends(user) {
  if (!syncConfigured || !user) return ok([]);
  const { data, error } = await supabase.from("friendships").select("id,requester_id,addressee_id,created_at").eq("status", "accepted");
  if (error) return fail(error);
  const rows = (data || []).map((f) => ({ id: f.id, userId: f.requester_id === user.id ? f.addressee_id : f.requester_id, since: f.created_at }));
  const names = await namesFor(rows.map((r) => r.userId));
  return ok(rows.map((r) => ({ ...r, name: names[r.userId] || "Friend" })));
}

export async function removeFriend(friendshipId) {
  if (!syncConfigured) return fail("not configured");
  const { error } = await supabase.from("friendships").delete().eq("id", friendshipId);
  return error ? fail(error) : ok(true);
}

/* ---------- publishing ----------
   Only habits explicitly marked visible are counted, and only their percentage leaves the
   device. The habits themselves, their names and their day-by-day history stay local. */

export async function publishStats(user, { month, pct, count, streak }) {
  if (!syncConfigured || !user) return fail("not signed in");
  const { error } = await supabase.from("shared_stats").upsert(
    { user_id: user.id, habit_month: month, habit_pct: pct, habit_count: count, streak_days: streak, updated_at: new Date().toISOString() },
    { onConflict: "user_id" }
  );
  return error ? fail(error) : ok(true);
}

// Quotes are shared as a whole, since writing one down is already a deliberate act. Deleting
// one locally removes it here too, so the two never disagree.
export async function publishQuotes(user, quotes) {
  if (!syncConfigured || !user) return fail("not signed in");
  const rows = (quotes || []).slice(0, 50).map((q) => ({
    user_id: user.id, local_id: q.id, text: q.text, source: q.source || null, tag: q.tag || null,
    created_at: q.createdAt || new Date().toISOString(),
  }));
  if (rows.length) {
    const { error } = await supabase.from("shared_quotes").upsert(rows, { onConflict: "user_id,local_id" });
    if (error) return fail(error);
  }
  const keep = rows.map((r) => r.local_id);
  const del = supabase.from("shared_quotes").delete().eq("user_id", user.id);
  const { error: de } = keep.length ? await del.not("local_id", "in", `(${keep.map((k) => `"${k}"`).join(",")})`) : await del;
  return de ? fail(de) : ok(true);
}

/* ---------- reading friends ---------- */

export async function fetchFriendStats(user, friends) {
  if (!syncConfigured || !user || !friends?.length) return ok([]);
  const { data, error } = await supabase.from("shared_stats").select("user_id,habit_month,habit_pct,habit_count,streak_days");
  if (error) return fail(error);
  const byId = {};
  (data || []).forEach((r) => { byId[r.user_id] = r; });
  return ok(friends.map((f) => ({ ...f, stats: byId[f.userId] || null })));
}

export async function fetchFriendQuotes(user, friends, limit = 12) {
  if (!syncConfigured || !user || !friends?.length) return ok([]);
  const ids = friends.map((f) => f.userId);
  const { data, error } = await supabase.from("shared_quotes").select("id,user_id,text,source,tag,created_at")
    .in("user_id", ids).order("created_at", { ascending: false }).limit(limit);
  if (error) return fail(error);
  const nameById = Object.fromEntries(friends.map((f) => [f.userId, f.name]));
  return ok((data || []).map((q) => ({ ...q, name: nameById[q.user_id] || "Friend" })));
}
