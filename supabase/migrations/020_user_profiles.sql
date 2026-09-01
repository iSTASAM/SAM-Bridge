-- Per-account profile settings (display name, avatar) for SAM Bridge console users.
-- Password changes are applied to admin_accounts or ixacs_connections, not stored here.

create table if not exists public.user_profiles (
  id text primary key,
  role text not null check (role in ('admin', 'user')),
  username text not null,
  display_name text not null,
  avatar_url text,
  admin_account_id text,
  connection_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_profiles_username_lower_idx
  on public.user_profiles (lower(username));

create index if not exists user_profiles_admin_account_idx
  on public.user_profiles (admin_account_id)
  where admin_account_id is not null;

create index if not exists user_profiles_connection_idx
  on public.user_profiles (connection_id)
  where connection_id is not null;

drop trigger if exists user_profiles_set_updated_at on public.user_profiles;
create trigger user_profiles_set_updated_at
  before update on public.user_profiles
  for each row
  execute function public.set_updated_at();

alter table public.user_profiles enable row level security;
