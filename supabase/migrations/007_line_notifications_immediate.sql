-- LINE notifications now fire immediately when a machine enters the selected status.

alter table public.line_notification_rules
  drop constraint if exists line_notification_rules_duration_minutes_check;

alter table public.line_notification_rules
  alter column duration_minutes set default 0;

update public.line_notification_rules
set duration_minutes = 0
where duration_minutes <> 0;

alter table public.line_notification_rules
  add constraint line_notification_rules_duration_minutes_check
  check (duration_minutes between 0 and 1440);
