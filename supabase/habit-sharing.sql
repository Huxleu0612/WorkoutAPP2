-- Compound · per-friend habit sharing
-- Run AFTER friends.sql, in the Supabase SQL editor. Safe to re-run.
--
-- WHAT CHANGES, AND WHY IT IS STILL SAFE.
--
-- Until now a friend could see one number: the percentage of your shared habits hit this
-- month. This adds what HabitShare actually shows a friend — the habit's name, its current
-- run, and the last four weeks of ticks — because a percentage on its own gives nobody
-- anything to hold you to.
--
-- The control is per habit AND per friend, and everything is off until you turn it on.
-- That is enforced by the shape of the table, not by a filter in the app: a habit is
-- written as one row per viewer, with viewer_id on the row, and the read policy only ever
-- returns rows addressed to you. There is no query a friend can write that returns a habit
-- you did not share with them, because that row does not exist.
--
-- app_data is untouched, as before. Training, body weight and finance are not represented
-- here in any column, and finance is never shared by any mechanism.

create extension if not exists pgcrypto;

/* ---------- one row per (habit, viewer) ---------- */
create table if not exists public.shared_habits (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users (id) on delete cascade,
  viewer_id  uuid not null references auth.users (id) on delete cascade,
  local_id   text not null,            -- the habit's local id on the owner's device
  name       text not null,
  streak     int  not null default 0,
  -- { "2026-09-10": "green" | "orange" | "red" }, last 28 days, marked days only.
  days       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint no_self_share check (owner_id <> viewer_id),
  constraint one_row_per_habit_viewer unique (owner_id, viewer_id, local_id)
);

/* ---------- a high five ----------
   Deliberately the whole vocabulary. A nudge that can only ever say one thing cannot be
   used to say something unkind, and it needs no moderation, no text column and no
   notification content to leak. */
create table if not exists public.high_fives (
  id         uuid primary key default gen_random_uuid(),
  from_id    uuid not null references auth.users (id) on delete cascade,
  to_id      uuid not null references auth.users (id) on delete cascade,
  local_id   text,                     -- which habit it was about, if any
  created_at timestamptz not null default now(),
  constraint no_self_five check (from_id <> to_id)
);

alter table public.shared_habits enable row level security;
alter table public.high_fives    enable row level security;

-- Read: rows you wrote, or rows addressed to you by someone you are actually friends with.
-- are_friends is re-checked on read, so removing a friend cuts their access immediately
-- even before the owner's device gets round to deleting the rows.
drop policy if exists shared_habits_read on public.shared_habits;
create policy shared_habits_read on public.shared_habits for select to authenticated
  using (owner_id = auth.uid()
      or (viewer_id = auth.uid() and public.are_friends(auth.uid(), owner_id)));

-- Write: only ever your own rows, and only ever addressed to a current friend.
drop policy if exists shared_habits_write on public.shared_habits;
create policy shared_habits_write on public.shared_habits for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and public.are_friends(auth.uid(), viewer_id));

drop policy if exists high_fives_read on public.high_fives;
create policy high_fives_read on public.high_fives for select to authenticated
  using (to_id = auth.uid() or from_id = auth.uid());
drop policy if exists high_fives_insert on public.high_fives;
create policy high_fives_insert on public.high_fives for insert to authenticated
  with check (from_id = auth.uid() and public.are_friends(auth.uid(), to_id));
drop policy if exists high_fives_delete on public.high_fives;
create policy high_fives_delete on public.high_fives for delete to authenticated
  using (from_id = auth.uid() or to_id = auth.uid());

create index if not exists shared_habits_viewer_idx on public.shared_habits (viewer_id);
create index if not exists high_fives_to_created_idx on public.high_fives (to_id, created_at desc);
