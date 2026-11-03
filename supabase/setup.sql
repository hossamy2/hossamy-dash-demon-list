-- Hossamy Dash Demon List: paste this whole file into Supabase SQL Editor and run it.
-- The anon key is safe to use in the browser because Row Level Security protects the data.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (char_length(username) between 2 and 24),
  role text not null default 'player' check (role in ('player', 'moderator')),
  created_at timestamptz not null default now()
);

create table if not exists public.levels (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  creator text not null check (char_length(creator) between 1 and 100),
  rank integer not null unique check (rank > 0),
  points integer not null default 0 check (points >= 0),
  video_url text,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.records (
  id uuid primary key default gen_random_uuid(),
  level_id uuid not null references public.levels(id) on delete cascade,
  submitted_by uuid not null references public.profiles(id) on delete cascade,
  proof_url text not null check (char_length(proof_url) <= 2048),
  note text check (note is null or char_length(note) <= 500),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists one_approved_record_per_player_level
  on public.records (level_id, submitted_by) where status = 'approved';

create or replace function public.is_moderator()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'moderator');
$$;

create or replace function public.create_profile_for_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare chosen_name text;
begin
  chosen_name := coalesce(nullif(trim(new.raw_user_meta_data ->> 'username'), ''), 'Player_' || left(new.id::text, 8));
  insert into public.profiles (id, username)
  values (new.id, left(chosen_name, 24));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users for each row execute procedure public.create_profile_for_new_user();

alter table public.profiles enable row level security;
alter table public.levels enable row level security;
alter table public.records enable row level security;

drop policy if exists "Profiles are publicly readable" on public.profiles;
create policy "Profiles are publicly readable" on public.profiles for select using (true);

drop policy if exists "Levels are publicly readable" on public.levels;
create policy "Levels are publicly readable" on public.levels for select using (true);
drop policy if exists "Moderators manage levels" on public.levels;
create policy "Moderators manage levels" on public.levels for all using (public.is_moderator()) with check (public.is_moderator());

drop policy if exists "Public can see approved records" on public.records;
create policy "Public can see approved records" on public.records for select using (status = 'approved' or submitted_by = (select auth.uid()) or public.is_moderator());
drop policy if exists "Players submit their own records" on public.records;
create policy "Players submit their own records" on public.records for insert with check (submitted_by = (select auth.uid()) and status = 'pending' and reviewed_by is null and reviewed_at is null);
drop policy if exists "Moderators review records" on public.records;
create policy "Moderators review records" on public.records for update using (public.is_moderator()) with check (public.is_moderator());

grant usage on schema public to anon, authenticated;
grant select on public.levels, public.profiles to anon, authenticated;
grant select, insert, update on public.records to authenticated;
grant insert, update, delete on public.levels to authenticated;
grant execute on function public.is_moderator() to anon, authenticated;
