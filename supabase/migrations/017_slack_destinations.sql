-- Multiple Slack alert destinations (bot token + channel)
create table if not exists public.slack_destinations (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  channel_id text not null,
  bot_token text not null default '',
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists slack_destinations_enabled_idx
  on public.slack_destinations (enabled) where enabled = true;

alter table public.slack_destinations enable row level security;

alter table public.slack_notification_rules
  add column if not exists destination_id uuid references public.slack_destinations (id) on delete set null;

create index if not exists slack_notification_rules_destination_idx
  on public.slack_notification_rules (destination_id);
