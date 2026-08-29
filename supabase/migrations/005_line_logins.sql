-- LINE portal logins: map LINE user ↔ iXacs connection (no passwords).
-- Cookie still authenticates the LIFF session; this row is the durable login flag
-- for rich-menu switching and rejecting stale cookies after logout.

create table if not exists public.line_logins (
  line_user_id text primary key,
  connection_id uuid references public.ixacs_connections (id) on delete cascade,
  customer_id text not null default '',
  login_id text not null default '',
  logged_in boolean not null default false,
  last_login_at timestamptz,
  last_logout_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists line_logins_connection_id_idx
  on public.line_logins (connection_id);

create index if not exists line_logins_logged_in_idx
  on public.line_logins (logged_in)
  where logged_in = true;

drop trigger if exists line_logins_set_updated_at on public.line_logins;
create trigger line_logins_set_updated_at
  before update on public.line_logins
  for each row
  execute function public.set_updated_at();

alter table public.line_logins enable row level security;
