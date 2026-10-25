-- Run once in Supabase SQL Editor, after bloom_shop.sql.
-- Public product images; only Bloom administrators may upload/delete.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('bloom-product-images','bloom-product-images',true,8388608,
 array['image/jpeg','image/png','image/gif','image/webp','image/avif','image/bmp'])
on conflict(id) do update set public=true,file_size_limit=8388608,
allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "Bloom admins upload product images" on storage.objects;
create policy "Bloom admins upload product images"
on storage.objects for insert to authenticated
with check(bucket_id='bloom-product-images'
 and public.bloom_is_admin()
 and (storage.foldername(name))[1]='products'
 and (storage.foldername(name))[2]=(select auth.uid())::text);

drop policy if exists "Bloom admins remove product images" on storage.objects;
create policy "Bloom admins remove product images"
on storage.objects for delete to authenticated
using(bucket_id='bloom-product-images' and public.bloom_is_admin());
