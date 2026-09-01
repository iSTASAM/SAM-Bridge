create table if not exists public.slack_settings (
  id smallint primary key default 1 check (id = 1),
  public_url text not null default '',
  incoming_webhook text not null default '',
  channel_id text not null default '',
  bot_token text not null default '',
  signing_secret text not null default '',
  updated_at timestamptz not null default now()
);

insert into public.slack_settings (id) values (1) on conflict (id) do nothing;
alter table public.slack_settings enable row level security;

create table if not exists public.slack_notification_rules (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.ixacs_connections (id) on delete cascade,
  customer_id text not null,
  customer_name text not null default '',
  webhook_url text not null default '',
  lines jsonb not null default '[]'::jsonb,
  status_by_line jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  last_run_at timestamptz,
  last_run_status text check (last_run_status in ('success', 'error')),
  last_run_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists slack_notification_rules_connection_idx
  on public.slack_notification_rules (connection_id) where enabled = true;
alter table public.slack_notification_rules enable row level security;

create table if not exists public.slack_notification_state (
  rule_id uuid not null references public.slack_notification_rules (id) on delete cascade,
  line_uuid text not null,
  status_uuid text,
  updated_at timestamptz not null default now(),
  primary key (rule_id, line_uuid)
);
alter table public.slack_notification_state enable row level security;

create table if not exists public.slack_event_receipts (
  event_id text primary key,
  status text not null default 'processing' check (status in ('processing', 'completed', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.slack_event_receipts enable row level security;
