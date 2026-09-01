-- Cached Excel export payloads for fast Power Query refresh (Vercel/serverless).
create table if not exists public.excel_export_snapshots (
  export_id uuid primary key references public.export_configs (id) on delete cascade,
  date_from date not null,
  date_to date not null,
  history_days integer not null default 90,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists excel_export_snapshots_updated_at_idx
  on public.excel_export_snapshots (updated_at desc);

alter table public.excel_export_snapshots enable row level security;
