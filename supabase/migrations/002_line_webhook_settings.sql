-- LINE Messaging API / LIFF settings (singleton row).
-- Channel secret is encrypted at the application layer before insert/update.

create table if not exists public.line_webhook_settings (
  id integer primary key default 1 check (id = 1),
  public_url text not null default '',
  channel_secret text not null default '',
  liff_id text not null default '',
  line_login_channel_id text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.line_webhook_settings enable row level security;

insert into public.line_webhook_settings (id)
values (1)
on conflict (id) do nothing;
