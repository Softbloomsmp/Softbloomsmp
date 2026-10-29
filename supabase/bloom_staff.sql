-- Run after supabase/bloom_shop.sql (provides bloom_is_admin()).
create table if not exists public.bloom_staff (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(trim(name)) between 1 and 80),
 role text not null check(length(trim(role)) between 1 and 100),
 image_url text,
 profile_id uuid references public.profiles(id) on delete set null,
 sort_order integer not null default 0,
 legacy_key text unique,
 created_at timestamptz not null default now()
);
alter table public.bloom_staff enable row level security;
drop policy if exists bloom_staff_read on public.bloom_staff;
create policy bloom_staff_read on public.bloom_staff for select to anon,authenticated using(true);
drop policy if exists bloom_staff_insert on public.bloom_staff;
create policy bloom_staff_insert on public.bloom_staff for insert to authenticated with check(public.bloom_is_admin());
drop policy if exists bloom_staff_update on public.bloom_staff;
create policy bloom_staff_update on public.bloom_staff for update to authenticated using(public.bloom_is_admin()) with check(public.bloom_is_admin());
drop policy if exists bloom_staff_delete on public.bloom_staff;
create policy bloom_staff_delete on public.bloom_staff for delete to authenticated using(public.bloom_is_admin());
-- Seed the existing staff only on the first migration (when table is empty).
-- Do not re-create deleted members on subsequent executions.
do $$ begin
 if not exists (select 1 from public.bloom_staff) then
  insert into public.bloom_staff(name,role,image_url,sort_order,legacy_key) values
   ('Val','Owner & Developer','/softbloom-info/val.png',0,'original-val'),
   ('Adam','Admin','/softbloom-info/adam.png',1,'original-adam'),
   ('Nao','Admin','/softbloom-info/naomi.png',2,'original-nao'),
   ('Camilla','Moderator','/softbloom-info/camilla.png',3,'original-camilla'),
   ('.eleeyz','Recruiter','/softbloom-info/eleeyz.png',4,'original-eleeyz');
 end if;
end $$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('bloom-staff-media','bloom-staff-media',true,3145728,array['image/png','image/jpeg','image/webp'])
on conflict(id) do update set public=true,file_size_limit=3145728,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists bloom_staff_media_insert on storage.objects;
create policy bloom_staff_media_insert on storage.objects for insert to authenticated
with check(bucket_id='bloom-staff-media' and public.bloom_is_admin() and split_part(name,'/',1)=auth.uid()::text);
