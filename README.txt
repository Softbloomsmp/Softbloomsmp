SoftBloomSMP feed and compact navigation update

1. Run supabase/post_pinning.sql once in Supabase SQL Editor (Bloom Shop admin roles must already exist).
2. Replace components/Feed.tsx, components/AppShell.tsx, app/globals.css in GitHub.
3. Keep your existing public background and guest greeting images, NotificationBell and reaction-picker CSS files.
4. Deploy to Vercel and test with an admin and ordinary member.

Feed shows everyone, pinned first, then followed accounts, then remaining users. Admins alone can pin/unpin. Header is smaller and original cherry blossom background and guest gate retained.

Note: Existing Supabase posts SELECT RLS must permit reading public posts; if it restricts reading to followed accounts, adjust that policy deliberately. No production build or live Supabase tests performed.
