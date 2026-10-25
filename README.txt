SoftBloomSMP — Clear All Notifications
1. Run supabase/clear_notifications.sql in Supabase SQL Editor (once).
2. Replace components/NotificationBell.tsx in GitHub.
3. Redeploy on Vercel.

A Clear all action now appears next to Mark read in the notification dropdown.
It asks for confirmation and permanently deletes only the signed-in user's notifications.
The unread badge resets to zero after successful deletion. New events still produce notifications.
The database policy prevents members from deleting other members' notifications.
No other website files or styles are changed.

Note: the Clear all control is enabled when the most recent 80 notifications list contains items. The database delete itself clears ALL of the user's notifications, not just those 80.
No full production build or live Supabase test was performed.
