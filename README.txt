SoftBloomSMP Bloom Shop — updated files only

INSTALL
1. Run supabase/bloom_shop.sql in Supabase SQL Editor.
2. Find your own user UUID in Supabase > Authentication > Users.
3. In a NEW SQL query run:
   INSERT INTO public.bloom_admins(user_id) VALUES ('YOUR_AUTH_USER_UUID') ON CONFLICT DO NOTHING;
   Replace YOUR_AUTH_USER_UUID with your real UUID. NEVER add public self-admin signup.
4. Replace components/AppShell.tsx and app/globals.css; add app/shop/page.tsx.
5. Deploy to Vercel, sign in as the admin, go to Bloom > Shop, add a product.
6. Test with two separate accounts: top-up ticket, admin reply/approval, BCoins purchase, GCash ticket, admin payment verification.

BEHAVIOR
- Bloom dropdown: Shop; Support Us and Contact Us marked Coming Soon.
- Shop: products with image URL, description, two prices, published toggle; only admins may create/edit via secured SQL RPC.
- Wallet: starts at 0; atomic BCoins purchases; ledger records debit and top-up credit.
- Top-ups: users request BCoins and open a private ticket; admin confirms exchange rate/payment instructions and approves only after independently verifying GCash payment.
- GCash product orders: private pending payment ticket; admin verifies and marks paid. No automatic payment gateway.
- Admins can read/reply to all tickets; users can only read their own. Admin approves/rejects ticket exactly once.
- Orders record purchases. Delivery/fulfillment of Minecraft goods is MANUAL; a paid order does NOT grant an in-game item automatically.
- Image URL is an external HTTPS image; image upload/storage is not implemented.
- No GCash account number or conversion rate is hardcoded. Admins must communicate payment instructions securely in tickets.
- Do not use this as an automated real-money payment processor. Verify every GCash receipt independently, not only from screenshots or reference numbers.

IMPORTANT
- The database script is for first-time installation; existing tables with the same names or policies may require migration review.
- The website files are based on the prior patches in this conversation, not a fresh clone of your latest GitHub commit.
- Full production build and live Supabase SQL execution were not completed in this environment.
