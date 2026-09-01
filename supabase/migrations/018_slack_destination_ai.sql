-- Per-channel Slack AI (@mention) toggle
alter table public.slack_destinations
  add column if not exists ai_enabled boolean not null default false;

create index if not exists slack_destinations_ai_enabled_idx
  on public.slack_destinations (ai_enabled)
  where ai_enabled = true;
