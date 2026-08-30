-- Fallback monitor for Vercel Hobby deployments.
-- iXacs Push remains the real-time path; this job reconciles missed transitions every minute.
-- Before the job can call SAM Bridge, create these two Vault secrets:
--   sam_bridge_monitor_url   = https://your-domain/api/notifications/monitor
--   sam_bridge_cron_secret   = the same value as Vercel CRON_SECRET

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

do $$
declare
  existing_job bigint;
begin
  select jobid into existing_job
  from cron.job
  where jobname = 'sam-bridge-line-monitor'
  limit 1;

  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;
end
$$;

select cron.schedule(
  'sam-bridge-line-monitor',
  '* * * * *',
  $job$
    select net.http_get(
      url := monitor_url.decrypted_secret,
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || monitor_secret.decrypted_secret,
        'User-Agent', 'supabase-pg-cron/sam-bridge'
      ),
      timeout_milliseconds := 50000
    )
    from vault.decrypted_secrets as monitor_url
    cross join vault.decrypted_secrets as monitor_secret
    where monitor_url.name = 'sam_bridge_monitor_url'
      and monitor_secret.name = 'sam_bridge_cron_secret';
  $job$
);
