SoftBloomSMP notification bell

INSTALL ORDER
1. In Supabase SQL Editor, run supabase/notifications.sql ONCE (after the comment replies/reactions and direct messages migrations).
2. Upload these files to GitHub with exactly these paths:
   components/AppShell.tsx (replace)
   components/Feed.tsx (replace)
   components/NotificationBell.tsx (new)
   components/notification-bell.css (new)
3. Deploy through Vercel.
4. Test with two accounts: react to a post, comment, reply to a comment, react to a comment, send a DM, and follow.

FEATURES
- Bell next to top-right profile menu with red unread count.
- Clickable alert list with timestamps and actor usernames.
- Post/comment alerts navigate to the post in its author's profile post list; post auto-expands and scrolls into view.
- DM alerts open conversation; follow alerts open follower profile.
- Mark individual notifications read when clicked; mark all as read.
- Polling every 10 seconds and on tab focus (no Realtime configuration needed).
- Self-notifications excluded. All notification creation happens in database triggers, not from user-controlled browser inserts.

NOTES
- Only events occurring AFTER SQL installation generate notifications; no historic backfill.
- The bell counts all unread notifications; the dropdown displays the latest 80.
- SQL assumes public.direct_messages has an id UUID primary key, and existing comment_reactions table and comments.parent_id.
- Existing app design and functionality retained. Full Vercel production build and Supabase live testing were not available here.
