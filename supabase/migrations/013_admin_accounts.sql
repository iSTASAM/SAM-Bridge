-- Extra admin accounts for /admin/login (in addition to AUTH_USER / AUTH_PASSWORD).
-- password_hash is a one-way scrypt digest — never returned to the browser.

create table if not exists public.admin_accounts (
  id text primary key,
  username text not null,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists admin_accounts_username_lower_idx
  on public.admin_accounts (lower(username));

drop trigger if exists admin_accounts_set_updated_at on public.admin_accounts;
create trigger admin_accounts_set_updated_at
  before update on public.admin_accounts
  for each row
  execute function public.set_updated_at();

alter table public.admin_accounts enable row level security;
