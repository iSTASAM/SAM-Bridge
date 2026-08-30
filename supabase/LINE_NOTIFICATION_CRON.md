# LINE notification fallback monitor

iXacs Push sends real-time notifications. Supabase Cron calls the monitor every minute so a missed Push event does not leave a notification rule in a stale state.

## Configure once

1. Set `CRON_SECRET` in the Vercel project to a random value of at least 32 characters.
2. In Supabase Dashboard, open **SQL Editor** and create matching Vault secrets:

```sql
select vault.create_secret(
  'https://your-production-domain/api/notifications/monitor',
  'sam_bridge_monitor_url'
);

select vault.create_secret(
  'the-same-value-as-vercel-CRON_SECRET',
  'sam_bridge_cron_secret'
);
```

3. Apply migration `009_line_notification_monitor_cron.sql`.
4. Check **Integrations → Cron → Jobs** for `sam-bridge-line-monitor`.

The monitor endpoint rejects requests whose Bearer token does not exactly match `CRON_SECRET`.
