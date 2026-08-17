-- WorkoutAPP2 · friends layer
-- Run AFTER schema.sql, in the Supabase SQL editor.
--
-- SECURITY MODEL — the important part.
--
-- app_data holds everything: training, weight, finance, habits, reading. Its policy stays
-- exactly as it was, own-rows-only, and is NOT touched here. Sharing never widens it.
--
-- Instead the app *publishes* the few things meant to be shared into the narrow tables
-- below. A friend can only ever read those. So a mistake in a policy here could at worst
-- expose a habit percentage or a quote you chose to log. It cannot expose finances, body
-- weight or training history, because none of that ever leaves app_data.
--
-- Finance is never shared. There is deliberately no table, column or flag for it.

create extension if not exists pgcrypto;

/* ---------- who you are, to a friend ---------- */
create table if not exists public.profiles (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  updated_at   timestamptz not null default now()
);

/* ---------- the friendship itself ---------- */
create table if not exists public.friendships (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users (id) on delete cascade,
  addressee_id uuid not null references auth.users (id) on delete cascade,
  status       text not null default 'accepted' check (status in ('accepted', 'blocked')),
  created_at   timestamptz not null default now(),
  constraint no_self_friendship check (requester_id <> addressee_id),
  constraint one_row_per_pair unique (requester_id, addressee_id)
);

/* ---------- invites, addressed by email ----------
   By email on purpose. Looking someone up by address would need an endpoint that confirms
   whether an email has an account, which is exactly the sort of thing that gets abused.
   Here an invite simply waits until that person signs in and finds it. */
create table if not exists public.invites (
  id          uuid primary key default gen_random_uuid(),
  inviter_id  uuid not null references auth.users (id) on delete cascade,
  email       text not null,
  created_at  timestamptz not null default now(),
  accepted_at timestamptz,
  constraint one_open_invite_per_email unique (inviter_id, email)
);

/* ---------- the only things a friend can read ---------- */
create table if not exists public.shared_stats (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  habit_month text,
  habit_pct   int check (habit_pct between 0 and 100),
  habit_count int,
  streak_days int,
  updated_at  timestamptz not null default now()
);

create table if not exists public.shared_quotes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  local_id   text not null,
  text       text not null,
  source     text,
  tag        text,
  created_at timestamptz not null default now(),
  constraint one_row_per_local_quote unique (user_id, local_id)
);

/* ---------- helper ----------
   security definer so it can see friendship rows while deciding whether you may read
   another person's stats. Pinned to an empty search_path so it cannot be tricked into
   resolving some other table of the same name. */
create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester_id = a and f.addressee_id = b)
        or (f.requester_id = b and f.addressee_id = a))
  );
$fn$;
revoke all on function public.are_friends(uuid, uuid) from public;
grant execute on function public.are_friends(uuid, uuid) to authenticated;

/* ---------- policies ---------- */
alter table public.profiles      enable row level security;
alter table public.friendships   enable row level security;
alter table public.invites       enable row level security;
alter table public.shared_stats  enable row level security;
alter table public.shared_quotes enable row level security;

-- profiles: yourself, and anyone you are actually friends with
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
  using (user_id = auth.uid() or public.are_friends(auth.uid(), user_id));
drop policy if exists profiles_write on public.profiles;
create policy profiles_write on public.profiles for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- friendships: only rows you are part of, and you can only create ones naming yourself
drop policy if exists friendships_read on public.friendships;
create policy friendships_read on public.friendships for select to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());
drop policy if exists friendships_insert on public.friendships;
create policy friendships_insert on public.friendships for insert to authenticated
  with check (requester_id = auth.uid() or addressee_id = auth.uid());
drop policy if exists friendships_delete on public.friendships;
create policy friendships_delete on public.friendships for delete to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());

-- invites: ones you sent, and ones addressed to your own email
drop policy if exists invites_read on public.invites;
create policy invites_read on public.invites for select to authenticated
  using (inviter_id = auth.uid() or lower(email) = lower(auth.jwt() ->> 'email'));
drop policy if exists invites_insert on public.invites;
create policy invites_insert on public.invites for insert to authenticated
  with check (inviter_id = auth.uid());
drop policy if exists invites_update on public.invites;
create policy invites_update on public.invites for update to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email'))
  with check (lower(email) = lower(auth.jwt() ->> 'email'));
drop policy if exists invites_delete on public.invites;
create policy invites_delete on public.invites for delete to authenticated
  using (inviter_id = auth.uid() or lower(email) = lower(auth.jwt() ->> 'email'));

-- shared stats and quotes: written only by their owner, read by friends
drop policy if exists shared_stats_read on public.shared_stats;
create policy shared_stats_read on public.shared_stats for select to authenticated
  using (user_id = auth.uid() or public.are_friends(auth.uid(), user_id));
drop policy if exists shared_stats_write on public.shared_stats;
create policy shared_stats_write on public.shared_stats for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists shared_quotes_read on public.shared_quotes;
create policy shared_quotes_read on public.shared_quotes for select to authenticated
  using (user_id = auth.uid() or public.are_friends(auth.uid(), user_id));
drop policy if exists shared_quotes_write on public.shared_quotes;
create policy shared_quotes_write on public.shared_quotes for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists friendships_addressee_idx on public.friendships (addressee_id);
create index if not exists shared_quotes_user_created_idx on public.shared_quotes (user_id, created_at desc);
