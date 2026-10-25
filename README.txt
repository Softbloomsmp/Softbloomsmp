SoftBloomSMP threaded News comments + emoji reaction picker

1. Run supabase/bloom_news_replies_reactions.sql in Supabase SQL Editor (after bloom_news.sql).
2. Replace app/news/page.tsx and components/news.css in GitHub.
3. Redeploy Vercel.

Posts and comments display one React button. Clicking it opens an animated emoji selector above the button; choosing an emoji reacts. Existing reaction counts remain visible. Comments support nested replies; replies can also be reacted to and replied to. Existing admin-only news posting and media upload are retained. Database RLS prevents forging other users' reactions.

Notes: Replies cascade-delete when a parent comment is deleted. Reactions are one per user per post/comment. A full production build and live Supabase integration test were not performed.
