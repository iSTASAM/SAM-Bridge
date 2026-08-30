-- SAM Bridge: export destinations (Excel, Power BI, Slack, SAP, …)
-- Persists /settings/exports on Vercel. Local still falls back to data/export-configs.json.
-- Run this in Supabase SQL Editor after 001_ixacs_connections.sql.

create table if not exists public.export_configs (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Untitled export',
  description text not null default '',
  source_connection_id uuid references public.ixacs_connections (id) on delete set null,
  group_uuids text[] not null default '{}',
  line_uuids text[] not null default '{}',
  all_groups boolean not null default true,
  all_lines boolean not null default true,
  fields text[] not null default '{}',
  destination_type text not null,
  destination_name text not null default '',
  endpoint text not null default '',
  sap_connection_id text not null default '',
  sap_action text not null default 'production-result',
  sap_order jsonb,
  sap_mapping_validated boolean not null default false,
  sap_confirmation_unit text not null default 'PC',
  format text not null default 'canonical-json',
  trigger_mode text not null default 'manual',
  interval_minutes integer not null default 15,
  changes_only boolean not null default true,
  include_nulls boolean not null default false,
  alert_rules jsonb not null default '[]'::jsonb,
  power_bi_settings jsonb not null default '{}'::jsonb,
  power_bi_api_key text not null default '',
  excel_settings jsonb not null default '{}'::jsonb,
  excel_api_key text not null default '',
  status text not null default 'draft'
    check (status in ('draft', 'ready')),
  last_run_at timestamptz,
  last_run_status text
    check (last_run_status is null or last_run_status in ('success', 'error')),
  last_run_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists export_configs_updated_at_idx
  on public.export_configs (updated_at desc);

create index if not exists export_configs_destination_type_idx
  on public.export_configs (destination_type);

create index if not exists export_configs_source_connection_id_idx
  on public.export_configs (source_connection_id);

drop trigger if exists export_configs_set_updated_at on public.export_configs;
create trigger export_configs_set_updated_at
  before update on public.export_configs
  for each row
  execute function public.set_updated_at();

-- Server uses service role key; no public/anon access.
alter table public.export_configs enable row level security;
