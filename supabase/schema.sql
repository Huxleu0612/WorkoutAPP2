-- WorkoutAPP2 sync schema
-- Paste this into the Supabase SQL editor (Dashboard -> SQL Editor -> New query) and run it.
--
-- The app stays local-first: localStorage remains the working store and this table is a
-- synced copy. It mirrors the local key/value shape (wa_profile, wa_history, ...) rather than
-- modelling sessions relationally, so a change to a stored shape does not need a migration
-- here. The social layer will need real relational tables later — those get added alongside
-- this, not instead of it, since a JSON blob cannot answer "who trained most this month".

create table if not exists public.app_data (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  key        text        not null,
  value      jsonb       not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

-- Row Level Security is what actually keeps your data private. Without this every
-- authenticated user could read every row, because the anon key is public by design.
alter table public.app_data enable row level security;

drop policy if exists "own rows only" on public.app_data;
create policy "own rows only"
  on public.app_data
  for all
  to authenticated
  using      (auth.uid() = user_id)   -- which rows you can see
  with check (auth.uid() = user_id);  -- which rows you can write

-- Keep updated_at honest: set it server-side rather than trusting the client, so
-- last-write-wins comparisons cannot be skewed by a device with a wrong clock.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists app_data_touch_updated_at on public.app_data;
create trigger app_data_touch_updated_at
  before insert or update on public.app_data
  for each row execute function public.touch_updated_at();

-- Pulls fetch rows changed since the last sync, so this index earns its keep.
create index if not exists app_data_user_updated_idx
  on public.app_data (user_id, updated_at desc);
