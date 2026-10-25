SoftBloomSMP — Bloom Shop Image Upload
1. Run supabase/bloom_product_images.sql in Supabase SQL Editor (requires existing bloom_shop.sql).
2. Replace app/shop/page.tsx in GitHub.
3. Deploy Vercel and test using an admin account.

Admin Add/Edit Product now uses a local picture upload instead of a URL.
Supported: JPEG/JPG, PNG, GIF (animated), WebP, AVIF, BMP. Max 8 MB. Video is rejected.
A preview is shown before saving; files are stored in the public bloom-product-images Supabase Storage bucket.
The upload happens before the product database save; a failed database save attempts to remove the new upload.
When editing a product, an old image in the dedicated bucket is deleted after the product save succeeds.
Other shop functionality and the existing Supabase products table are unchanged.
Production build and live Supabase tests have not been run.
