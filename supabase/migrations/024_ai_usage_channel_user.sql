-- Migration 024: AI usage by channel (web/line/slack) and by user

alter table public.ai_usage_logs
  add column if not exists channel text not null default 'web'
    check (channel in ('web', 'line', 'slack', 'unknown'));

create index if not exists ai_usage_logs_channel_idx
  on public.ai_usage_logs (channel, created_at desc);

create index if not exists ai_usage_logs_user_idx
  on public.ai_usage_logs (user_id, created_at desc);

drop function if exists public.get_ai_usage_by_channel(integer);
create function public.get_ai_usage_by_channel(
  p_days integer default 30
)
returns table (
  channel text,
  request_count integer,
  total_tokens bigint,
  cost_usd numeric,
  unique_users integer
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    channel,
    count(*)::integer as request_count,
    sum(total_tokens)::bigint as total_tokens,
    coalesce(sum(cost_usd), 0)::numeric(12, 6) as cost_usd,
    count(distinct nullif(user_id, ''))::integer as unique_users
  from public.ai_usage_logs
  where created_at >= (now() - (p_days || ' days')::interval)
  group by channel
  order by request_count desc;
$$;

drop function if exists public.get_ai_usage_by_user(integer);
create function public.get_ai_usage_by_user(
  p_days integer default 30
)
returns table (
  user_id text,
  channel text,
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
    coalesce(nullif(user_id, ''), '(anonymous)') as user_id,
    channel,
    count(*)::integer as request_count,
    sum(total_tokens)::bigint as total_tokens,
    coalesce(sum(cost_usd), 0)::numeric(12, 6) as cost_usd
  from public.ai_usage_logs
  where created_at >= (now() - (p_days || ' days')::interval)
  group by coalesce(nullif(user_id, ''), '(anonymous)'), channel
  order by cost_usd desc, request_count desc
  limit 50;
$$;

revoke all on function public.get_ai_usage_by_channel(integer) from public, anon, authenticated;
revoke all on function public.get_ai_usage_by_user(integer) from public, anon, authenticated;
grant execute on function public.get_ai_usage_by_channel(integer) to service_role;
grant execute on function public.get_ai_usage_by_user(integer) to service_role;
