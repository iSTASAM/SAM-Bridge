-- Add history_days to existing excel_export_snapshots installs.
alter table public.excel_export_snapshots
  add column if not exists history_days integer not null default 90;
