SoftBloomSMP — Admin Delete Products

1. Run supabase/bloom_archive_products.sql in Supabase SQL Editor once.
2. Replace app/shop/page.tsx in your GitHub repository.
3. Deploy Vercel and test with admin and ordinary member accounts.

Admin-only Delete button appears beside Edit on each shop product.
A confirmation is required. Deleted products disappear from the shop, cannot be purchased,
and are archived in Supabase so existing orders and transaction records remain intact.
No wallet balances or previous purchases are changed. Existing product images remain in storage
for audit/history; they are not automatically deleted.

This update builds on the previous Admin Ticket & Order Delete release, retaining GIF/image
upload and existing ticket/order archive controls. Production build/live database testing not run.
