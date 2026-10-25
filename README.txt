SoftBloomSMP notification bell repair
Replace components/AppShell.tsx and components/NotificationBell.tsx, and add components/notification-repair.css. Keep existing dropdown-motion.css and notification-bell.css.

Restores bell visibility/overlay stacking, preserves notification loading, unread count, Mark read, Clear all, links and close-on-outside. Clicking bell closes Bloom/Profile; opening Bloom/Profile closes bell. No SQL needed.

No production build or live browser test performed.
