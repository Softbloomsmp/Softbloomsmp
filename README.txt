SoftBloomSMP Admin Delete (archive) tickets and orders

1. Run supabase/bloom_archive_records.sql in Supabase SQL Editor once.
2. Replace app/shop/page.tsx in GitHub.
3. Deploy via Vercel.

Admin-only Delete buttons added to Admin ticket inbox and Recent orders. Confirmation required. Deletes archive records, keeping wallet ledger and payment history intact. Open/awaiting-payment tickets and pending orders must be resolved before archiving. Archived records disappear from the active shop lists for all users. No refunds or BCoins adjustments occur.

Existing product image upload, GIF support, wallets and ticket replies are preserved. Production build/live DB test not run.
