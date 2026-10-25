-- Run once in Supabase SQL Editor. Existing profiles and posts are preserved.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('profile-avatars','profile-avatars',true,3145728,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=true,file_size_limit=3145728,allowed_mime_types=excluded.allowed_mime_types;

-- Only owners may upload/delete their own files. No overwrites.
drop policy if exists "profile_avatars_upload" on storage.objects;
create policy "profile_avatars_upload" on storage.objects for insert to authenticated
with check (bucket_id='profile-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "profile_avatars_delete" on storage.objects;
create policy "profile_avatars_delete" on storage.objects for delete to authenticated
using (bucket_id='profile-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);

-- Preserve existing username cooldown/identity rules; allow only the user's own bucket URL.
create or replace function public.guard_profile_update() returns trigger language plpgsql set search_path='' as $$
begin
 if new.id<>old.id or new.created_at<>old.created_at then raise exception 'Immutable profile identity';end if;
 if new.username is distinct from old.username then
  if old.username_changed_at is not null and old.username_changed_at>now()-interval '7 days' then raise exception 'Username may only be changed once every 7 days';end if;
  new.username_changed_at:=now();
 else new.username_changed_at:=old.username_changed_at;end if;
 if new.avatar_url is distinct from old.avatar_url then
  if auth.uid() is distinct from new.id then raise exception 'Only owner may change avatar';end if;
  if new.avatar_url is null or new.avatar_url not like '%/storage/v1/object/public/profile-avatars/'||new.id::text||'/%' then
   raise exception 'Invalid profile avatar location';end if;
 end if;
 return new;
end $$;
-- Existing profile_update_guard trigger automatically uses the updated function.
