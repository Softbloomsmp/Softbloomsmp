-- Run after the original notifications.sql migration.
-- Allow each signed-in user to delete ONLY their own notifications.
-- Existing SELECT/UPDATE policies and server-generated notification triggers stay intact.
drop policy if exists notifications_delete_own on public.notifications;
create policy notifications_delete_own
on public.notifications
for delete to authenticated
using (recipient_id = (select auth.uid()));

grant delete on public.notifications to authenticated;
