-- Migration 021: AI Usage Logs and Activity Heatmap Calendar
-- Stores AI API call logs, token usage, latency, and provides daily aggregated views for GitHub-style Heatmap calendar.

-- 1. Create table for individual AI API call logs
create table if not exists public.ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  provider_id text not null default 'openai',
  model text not null default '',
  feature text not null default 'general' check (feature in ('general', 'maintenance', 'production', 'events', 'enrichment', 'chat', 'slack', 'line')),
  prompt_tokens integer not null default 0,
  completion_tokens integer not null default 0,
  total_tokens integer not null default 0,
  latency_ms integer not null default 0,
  status_code integer not null default 200,
  error_message text,
  user_id text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Indexes for efficient time-series querying and filtering
create index if not exists ai_usage_logs_created_at_idx
  on public.ai_usage_logs (created_at desc);

create index if not exists ai_usage_logs_provider_idx
  on public.ai_usage_logs (provider_id, created_at desc);

create index if not exists ai_usage_logs_feature_idx
  on public.ai_usage_logs (feature, created_at desc);

-- Enable RLS
alter table public.ai_usage_logs enable row level security;

drop policy if exists "Allow select ai_usage_logs" on public.ai_usage_logs;
create policy "Allow select ai_usage_logs" on public.ai_usage_logs
  for select using (true);

drop policy if exists "Allow insert ai_usage_logs" on public.ai_usage_logs;
create policy "Allow insert ai_usage_logs" on public.ai_usage_logs
  for insert with check (true);

-- 2. View for Daily AI Usage Aggregation (Asia/Bangkok timezone)
create or replace view public.ai_daily_usage_summary as
select
  (created_at at time zone 'Asia/Bangkok')::date as usage_date,
  count(*)::integer as request_count,
  sum(total_tokens)::bigint as total_tokens,
  sum(prompt_tokens)::bigint as prompt_tokens,
  sum(completion_tokens)::bigint as completion_tokens,
  avg(latency_ms)::integer as avg_latency_ms,
  count(distinct provider_id)::integer as providers_count,
  count(case when status_code >= 400 then 1 end)::integer as error_count
from public.ai_usage_logs
group by (created_at at time zone 'Asia/Bangkok')::date
order by usage_date desc;

-- 3. Helper RPC function to fetch continuous daily heatmap dataset for a given date range
create or replace function public.get_ai_usage_heatmap(
  p_days integer default 365
)
returns table (
  usage_date date,
  request_count integer,
  total_tokens bigint,
  prompt_tokens bigint,
  completion_tokens bigint,
  avg_latency_ms integer,
  providers_count integer,
  error_count integer
)
language sql
stable
as $$
  with date_series as (
    select generate_series(
      (current_date - (p_days || ' days')::interval)::date,
      current_date,
      '1 day'::interval
    )::date as d
  )
  select
    ds.d as usage_date,
    coalesce(s.request_count, 0)::integer as request_count,
    coalesce(s.total_tokens, 0)::bigint as total_tokens,
    coalesce(s.prompt_tokens, 0)::bigint as prompt_tokens,
    coalesce(s.completion_tokens, 0)::bigint as completion_tokens,
    coalesce(s.avg_latency_ms, 0)::integer as avg_latency_ms,
    coalesce(s.providers_count, 0)::integer as providers_count,
    coalesce(s.error_count, 0)::integer as error_count
  from date_series ds
  left join public.ai_daily_usage_summary s on ds.d = s.usage_date
  order by ds.d asc;
$$;
