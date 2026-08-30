# LINE notifications (no Vercel Cron)

LINE alerts are designed to send **immediately** from the iXacs Push webhook.
Do **not** configure Vercel Cron for this app (Hobby plans reject frequent crons and block deploy).

## Immediate path (required)

1. Create a Push API key in `/settings/push` for each production line that should alert.
2. In iXacs, point Push to `https://your-domain/api/push` and use that key (`x-api-key`).
3. Set the Messaging API channel access token in `/settings/notifications/line-webhook`.
4. In alert settings, keep hold duration at **0** (ทันที / Immediate).

When iXacs changes status, it POSTs to `/api/push` → SAM Bridge sends the LINE card right away.

## Optional fallback (Supabase only)

If you want a safety net when a Push event is missed, use Supabase `pg_cron` (not Vercel):

1. Set `CRON_SECRET` in the app environment.
2. Create Vault secrets:

```sql
select vault.create_secret(
  'https://your-production-domain/api/notifications/monitor',
  'sam_bridge_monitor_url'
);

select vault.create_secret(
  'the-same-value-as-CRON_SECRET',
  'sam_bridge_cron_secret'
);
```

3. Apply migration `009_line_notification_monitor_cron.sql`.
4. Apply `015_line_notification_immediate_duration.sql` so existing rules use duration `0`.

This fallback is optional. Instant alerts depend on Push, not on cron.
