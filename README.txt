SoftBloomSMP ticket images + admin controls
1. Run supabase/bloom_ticket_admin_controls.sql once in Supabase SQL Editor, after earlier shop/archive SQL.
2. Replace app/shop/page.tsx in GitHub.
3. Redeploy Vercel.

Features:
- Ticket participants may attach JPG, PNG, WebP, GIF pictures up to 8 MB while ticket is open.
- Attachments live in a private Supabase Storage bucket, signed URLs expire after one hour.
- Admins can set an existing user's exact BCoins balance using their Supabase Auth UUID.
  Adjustments are recorded in bloom_wallet_ledger and do not change past orders.
- Admins can set an existing user's maximum total posts; default is 10 for users without an override.
  Admin accounts are exempt from the post limit. Existing posts are not removed if above cap.
- All write permissions enforced by database functions and storage policies.

NOTE: the ticket chat is currently disabled once a ticket is approved/rejected/closed, as before.
NOTE: the maximum-post setting is TOTAL currently existing posts, not posts per day.
No full build or live Supabase test was performed.
