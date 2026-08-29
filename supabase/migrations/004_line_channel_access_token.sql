-- Add Messaging API channel access token (encrypted at app layer).
-- Used to link/unlink per-user rich menus after /line login.

alter table public.line_webhook_settings
  add column if not exists channel_access_token text not null default '';
