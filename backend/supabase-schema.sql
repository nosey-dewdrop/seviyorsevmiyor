-- whatdoyoumean tables on the SHARED nosey-dewdrop Supabase project.
-- Run once in the project's SQL editor. App-prefixed (wdym_) so apps can share one project.
-- Anon key is client-side; row-level security is what actually protects the data.

create table if not exists public.wdym_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  is_premium boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.wdym_profiles enable row level security;

-- A user can read only their own profile. Nobody can flip is_premium from the client;
-- premium is set server-side (payment webhook / service role) later.
drop policy if exists wdym_profiles_select_own on public.wdym_profiles;
create policy wdym_profiles_select_own on public.wdym_profiles
  for select using (auth.uid() = id);

-- Auto-create a profile row when a user signs up.
create or replace function public.wdym_handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.wdym_profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists wdym_on_auth_user_created on auth.users;
create trigger wdym_on_auth_user_created
  after insert on auth.users
  for each row execute function public.wdym_handle_new_user();

-- Server-enforced daily quota lands here when a payment provider is chosen (Faz 7 open item):
-- a wdym_daily_reads table + an rpc use_read() that upserts today's count and rejects over the
-- free limit unless is_premium. Until then the app uses a local per-device counter.
