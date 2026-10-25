SoftBloomSMP — admin player lookup by username and unique usernames

1. Run supabase/username_account_picker.sql in Supabase SQL Editor AFTER prior shop/admin SQL.
2. Replace app/shop/page.tsx and app/settings/page.tsx in GitHub.
3. Redeploy Vercel.

Admins can type part of a username (at least two characters), see up to eight matching existing profiles, and select one. BCoins and post limit updates use the selected account's UUID internally; the admin no longer needs to copy UUIDs.

Username uniqueness is case-insensitive: Testuser and testuser cannot belong to different users. A released username becomes available after its owner successfully changes it. Existing 7-day change cooldown remains.

IMPORTANT: If your database already contains usernames differing only by capitalization, the unique-index migration will fail. Run the duplicate-detection query at the top of the SQL file, resolve conflicts, then rerun.

Also corrects a legacy 5-post guard that would otherwise override the new configurable post limits; the configurable limit guard remains.

Build and live database migrations have NOT been tested.
