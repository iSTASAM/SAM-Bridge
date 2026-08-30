# LINE notification monitor

Notifications should fire **immediately** when iXacs Push reaches `/api/push`.
The monitor is only a fallback for missed Push events.

## Immediate path (preferred)

1. Create a Push API key in `/settings/push` for each production line.
2. Point iXacs Push to `https://your-domain/api/push` with that key.
3. Keep Messaging API channel access token set in `/settings/notifications/line-webhook`.
4. In alert settings, set **hold duration = 0** (ทันที / Immediate).

## Fallback monitor (every minute)

### Vercel Cron

`vercel.json` schedules `GET /api/notifications/monitor` every minute.

1. Set `CRON_SECRET` in Vercel (and local `.env`) to a random value of at least 32 characters.
2. Vercel sends `Authorization: Bearer <CRON_SECRET>` automatically.
3. On **Hobby**, Vercel may still limit cron frequency — use Supabase Cron below for reliable 1-minute checks.

### Supabase Cron

1. Create Vault secrets:

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

2. Apply migration `009_line_notification_monitor_cron.sql`.
3. Check **Integrations → Cron → Jobs** for `sam-bridge-line-monitor` (`* * * * *`).

Also apply `015_line_notification_immediate_duration.sql` so existing rules use duration `0` (send immediately).
