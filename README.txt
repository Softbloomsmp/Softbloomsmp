SoftBloomSMP News / Announcements
1. Run supabase/bloom_news.sql in Supabase SQL Editor after your existing Bloom Shop setup.
2. Add app/news/page.tsx and components/news.css to GitHub.
3. Replace components/AppShell.tsx with the updated file. Keep all existing other files.
4. Deploy Vercel. Admins are determined by bloom_admins and bloom_is_admin().

Features: News button next to logo, per-user unread news count (local browser last-visited timestamp), News page, admin-only publish/edit/delete, picture/video upload (25 MB), emoji quick buttons, member reactions and comments, comment deletion by owner or admin. Media is public; only admins can upload. Posts/comments/reactions are secured with database row-level security.

Notes:
- News badge counts new announcements since the user last opened /news on that browser; this is not synchronized across devices. Badge refreshes on focus and approximately once per minute.
- Deleting a news post does not automatically delete its previously uploaded media object.
- Maximum of 100 latest news announcements loaded; badge counts within this window.
- No production build or live Supabase integration test performed.
