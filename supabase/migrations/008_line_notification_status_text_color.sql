alter table public.line_notification_rules
  add column if not exists status_text_color text;
