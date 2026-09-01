-- Migration 023: Lock down AI usage logs/views/RPCs (server-only via service role)
-- Fixes Supabase "UNRESTRICTED" / security definer view warning on ai_daily_usage_summary.

-- 1) Table: remove public-open RLS policies (service_role bypasses RLS anyway)
drop policy if exists "Allow select ai_usage_logs" on public.ai_usage_logs;
drop policy if exists "Allow insert ai_usage_logs" on public.ai_usage_logs;

revoke all on table public.ai_usage_logs from anon, authenticated;
grant all on table public.ai_usage_logs to service_role;

-- 2) Recreate daily summary as security_invoker so it respects caller privileges / RLS
drop function if exists public.get_ai_usage_heatmap(integer);
drop view if exists public.ai_daily_usage_summary;

create view public.ai_daily_usage_summary
with (security_invoker = true)
as
select
  (created_at at time zone 'Asia/Bangkok')::date as usage_date,
  count(*)::integer as request_count,
  sum(total_tokens)::bigint as total_tokens,
  sum(prompt_tokens)::bigint as prompt_tokens,
  sum(completion_tokens)::bigint as completion_tokens,
  coalesce(sum(cost_usd), 0)::numeric(12, 6) as cost_usd,
  avg(latency_ms)::integer as avg_latency_ms,
  count(distinct provider_id)::integer as providers_count,
  count(case when status_code >= 400 then 1 end)::integer as error_count
from public.ai_usage_logs
group by (created_at at time zone 'Asia/Bangkok')::date
order by usage_date desc;

revoke all on table public.ai_daily_usage_summary from anon, authenticated;
grant select on table public.ai_daily_usage_summary to service_role;

-- 3) Recreate RPCs and restrict to service_role only
create function public.get_ai_usage_heatmap(
  p_days integer default 365
)
returns table (
  usage_date date,
  request_count integer,
  total_tokens bigint,
  prompt_tokens bigint,
  completion_tokens bigint,
  cost_usd numeric,
  avg_latency_ms integer,
  providers_count integer,
  error_count integer
)
language sql
stable
security invoker
set search_path = public
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
    coalesce(s.cost_usd, 0)::numeric(12, 6) as cost_usd,
    coalesce(s.avg_latency_ms, 0)::integer as avg_latency_ms,
    coalesce(s.providers_count, 0)::integer as providers_count,
    coalesce(s.error_count, 0)::integer as error_count
  from date_series ds
  left join public.ai_daily_usage_summary s on ds.d = s.usage_date
  order by ds.d asc;
$$;

drop function if exists public.get_ai_usage_by_model(integer);
create function public.get_ai_usage_by_model(
  p_days integer default 30
)
returns table (
  provider_id text,
  model text,
  request_count integer,
  total_tokens bigint,
  prompt_tokens bigint,
  completion_tokens bigint,
  cost_usd numeric,
  avg_latency_ms integer
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    provider_id,
    nullif(trim(model), '') as model,
    count(*)::integer as request_count,
    sum(total_tokens)::bigint as total_tokens,
    sum(prompt_tokens)::bigint as prompt_tokens,
    sum(completion_tokens)::bigint as completion_tokens,
    coalesce(sum(cost_usd), 0)::numeric(12, 6) as cost_usd,
    avg(latency_ms)::integer as avg_latency_ms
  from public.ai_usage_logs
  where created_at >= (now() - (p_days || ' days')::interval)
  group by provider_id, nullif(trim(model), '')
  order by cost_usd desc, request_count desc;
$$;

drop function if exists public.get_ai_usage_by_feature(integer);
create function public.get_ai_usage_by_feature(
  p_days integer default 30
)
returns table (
  feature text,
  request_count integer,
  total_tokens bigint,
  cost_usd numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    feature,
    count(*)::integer as request_count,
    sum(total_tokens)::bigint as total_tokens,
    coalesce(sum(cost_usd), 0)::numeric(12, 6) as cost_usd
  from public.ai_usage_logs
  where created_at >= (now() - (p_days || ' days')::interval)
  group by feature
  order by request_count desc;
$$;

revoke all on function public.get_ai_usage_heatmap(integer) from public, anon, authenticated;
revoke all on function public.get_ai_usage_by_model(integer) from public, anon, authenticated;
revoke all on function public.get_ai_usage_by_feature(integer) from public, anon, authenticated;

grant execute on function public.get_ai_usage_heatmap(integer) to service_role;
grant execute on function public.get_ai_usage_by_model(integer) to service_role;
grant execute on function public.get_ai_usage_by_feature(integer) to service_role;
