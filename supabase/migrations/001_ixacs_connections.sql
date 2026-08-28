-- SAM Bridge: iXacs machines (connections)
-- Run this in Supabase SQL Editor.

create extension if not exists "pgcrypto";

create table if not exists public.ixacs_connections (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'iXacs',
  base_url text not null,
  login_url text not null,
  customer_id text not null default '',
  customers jsonb not null default '[]'::jsonb,
  login_id text not null default '',
  -- Credential used by the server to call iXacs. Keep access server-side only.
  password text not null default '',
  basic_auth text not null default '',
  session text not null default '',
  line_uuids text[] not null default '{}',
  is_active boolean not null default false,
  last_ok_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ixacs_connections_customers_is_array check (jsonb_typeof(customers) = 'array')
);

-- At most one active machine at a time.
create unique index if not exists ixacs_connections_one_active
  on public.ixacs_connections ((is_active))
  where is_active = true;

create index if not exists ixacs_connections_login_id_idx
  on public.ixacs_connections (lower(login_id));

create index if not exists ixacs_connections_customer_id_idx
  on public.ixacs_connections (customer_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists ixacs_connections_set_updated_at on public.ixacs_connections;
create trigger ixacs_connections_set_updated_at
  before update on public.ixacs_connections
  for each row
  execute function public.set_updated_at();

-- Server uses service role key; no public/anon access.
alter table public.ixacs_connections enable row level security;
