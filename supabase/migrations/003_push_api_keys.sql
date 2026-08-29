-- SAM Bridge: Push API keys (managed from /settings/push).
-- Keys authenticate iXacs → Bridge push webhooks and bind a company + production line.
-- Run this in Supabase SQL Editor after 001_ixacs_connections.sql.

create table if not exists public.push_api_keys (
  key text primary key,
  created_at timestamptz not null default now(),
  name text,
  status text not null default 'active'
    check (status in ('active', 'disabled')),
  environment text not null default 'live'
    check (environment in ('live', 'test')),
  expires_at timestamptz,
  last_used_at timestamptz,
  line_uuid text,
  connection_id uuid references public.ixacs_connections (id) on delete cascade,
  group_uuid text,
  group_name text,
  line_name text,
  updated_at timestamptz not null default now()
);

create index if not exists push_api_keys_connection_id_idx
  on public.push_api_keys (connection_id);

create index if not exists push_api_keys_line_uuid_idx
  on public.push_api_keys (line_uuid);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists push_api_keys_set_updated_at on public.push_api_keys;
create trigger push_api_keys_set_updated_at
  before update on public.push_api_keys
  for each row
  execute function public.set_updated_at();

-- Server uses service role key; no public/anon access.
alter table public.push_api_keys enable row level security;
