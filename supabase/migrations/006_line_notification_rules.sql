-- Per-LINE-user notification rules and durable status timing state.

create table if not exists public.line_notification_rules (
  id uuid primary key default gen_random_uuid(),
  line_user_id text not null references public.line_logins (line_user_id) on delete cascade,
  connection_id uuid not null references public.ixacs_connections (id) on delete cascade,
  line_uuid text not null,
  line_name text not null,
  group_name text not null default '',
  status_uuid text not null,
  status_name_th text not null default '',
  status_name_en text not null default '',
  status_name_ja text not null default '',
  status_background_color text,
  duration_minutes integer not null default 0 check (duration_minutes between 0 and 1440),
  enabled boolean not null default true,
  observed_status_uuid text,
  status_started_at timestamptz,
  last_notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (line_user_id, line_uuid, status_uuid)
);

create index if not exists line_notification_rules_owner_idx
  on public.line_notification_rules (line_user_id, updated_at desc);

create index if not exists line_notification_rules_monitor_idx
  on public.line_notification_rules (connection_id, line_uuid)
  where enabled = true;

drop trigger if exists line_notification_rules_set_updated_at on public.line_notification_rules;
create trigger line_notification_rules_set_updated_at
  before update on public.line_notification_rules
  for each row
  execute function public.set_updated_at();

alter table public.line_notification_rules enable row level security;
