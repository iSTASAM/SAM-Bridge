-- Default AI model used when a feature does not pick one.
create table if not exists public.ai_settings (
  id text primary key default 'app',
  default_provider_id text,
  default_model text not null default '',
  updated_at timestamptz not null default now()
);

insert into public.ai_settings (id)
values ('app')
on conflict (id) do nothing;

drop trigger if exists ai_settings_set_updated_at on public.ai_settings;
create trigger ai_settings_set_updated_at
  before update on public.ai_settings
  for each row
  execute function public.set_updated_at();

alter table public.ai_settings enable row level security;
