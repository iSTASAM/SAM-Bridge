-- SAM Bridge: AI provider credentials (Admin Systems → AI Models)
-- api_key is encrypted at the application layer (AES-256-GCM) before write.
-- The plaintext key is never returned to the browser (only key_last4).
-- Run this in Supabase SQL Editor after 001_ixacs_connections.sql.

create table if not exists public.ai_providers (
  id text primary key,
  kind text not null
    check (kind in ('openai', 'anthropic', 'gemini', 'openrouter', 'custom')),
  name text not null,
  api_key text not null default '',
  key_last4 text not null default '',
  model text not null default '',
  base_url text not null default '',
  last_tested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_providers_kind_idx
  on public.ai_providers (kind);

drop trigger if exists ai_providers_set_updated_at on public.ai_providers;
create trigger ai_providers_set_updated_at
  before update on public.ai_providers
  for each row
  execute function public.set_updated_at();

alter table public.ai_providers enable row level security;
