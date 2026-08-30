-- Force LINE status alerts to fire immediately when a machine enters the selected status.
-- Admins can still raise duration_minutes later for debounce; 0 means "send now".

update public.line_notification_rules
set duration_minutes = 0
where duration_minutes <> 0;
