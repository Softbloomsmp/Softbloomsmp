begin;
create table if not exists public.profile_photos(id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade, kind text not null check(kind in ('avatar','cover')), url text not null, caption text not null default '' check(char_length(caption)<=2000), active boolean not null default false, created_at timestamptz not null default now());
create unique index if not exists profile_photo_active on public.profile_photos(user_id,kind) where active;
create table if not exists public.profile_photo_comments(id uuid primary key default gen_random_uuid(), photo_id uuid not null references public.profile_photos(id) on delete cascade, user_id uuid not null references public.profiles(id) on delete cascade, parent_id uuid, body text not null check(char_length(trim(body)) between 1 and 2000), created_at timestamptz default now(), unique(id,photo_id), foreign key(parent_id,photo_id) references public.profile_photo_comments(id,photo_id) on delete cascade);
create table if not exists public.profile_photo_reactions(photo_id uuid references public.profile_photos(id) on delete cascade,user_id uuid references public.profiles(id) on delete cascade,emoji text not null check(emoji in ('❤️','👍','🥰','😂','😮','😢','🌸')),primary key(photo_id,user_id));
create table if not exists public.profile_photo_comment_reactions(comment_id uuid references public.profile_photo_comments(id) on delete cascade,user_id uuid references public.profiles(id) on delete cascade,emoji text not null check(emoji in ('❤️','👍','🥰','😂','😮','😢','🌸')),primary key(comment_id,user_id));
-- Preserve the existing picture as the first historical photo.
insert into public.profile_photos(user_id,kind,url,active) select id,'avatar',avatar_url,true from public.profiles p where avatar_url is not null and avatar_url<>'' and not exists(select 1 from public.profile_photos x where x.user_id=p.id and x.kind='avatar');
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('profile-photos','profile-photos',true,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do update set file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists "profile_avatars_upload" on storage.objects;
drop policy if exists "profile_avatars_delete" on storage.objects;
-- Uploads are authorized only for a reserved photo ID; the reservation counts toward the quota.
alter table public.profile_photos add column if not exists pending boolean not null default false;
create or replace function public.reserve_profile_photo(p_kind text,p_caption text,p_ext text) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); i uuid:=gen_random_uuid(); begin
 if u is null or p_kind not in ('avatar','cover') or p_ext not in ('jpg','png','webp') then raise exception 'Invalid photo request'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text||p_kind,0));
 if (select count(*) from public.profile_photos where user_id=u and kind=p_kind)>=5 then raise exception 'Maximum five pictures per category'; end if;
 insert into public.profile_photos(id,user_id,kind,url,caption,pending) values(i,u,p_kind,u::text||'/'||i::text||'.'||p_ext,coalesce(p_caption,''),true); return i; end $$;
create policy profile_photo_storage_insert on storage.objects for insert to authenticated with check(bucket_id='profile-photos' and exists(select 1 from public.profile_photos p where p.user_id=auth.uid() and p.pending and p.url=objects.name));
create policy profile_photo_storage_delete on storage.objects for delete to authenticated using(bucket_id='profile-photos' and (storage.foldername(name))[1]=auth.uid()::text and not exists(select 1 from public.profile_photos p where p.user_id=auth.uid() and (p.url=objects.name or p.url like '%/profile-photos/'||objects.name)));
create or replace function public.activate_profile_photo(p_id uuid,p_url text default null) returns void language plpgsql security definer set search_path='' as $$
declare p public.profile_photos; begin
 select * into p from public.profile_photos where id=p_id and user_id=auth.uid(); if not found then raise exception 'Photo not found'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p.user_id::text||p.kind,0));
 if p.pending then
 if not exists(select 1 from storage.objects where bucket_id='profile-photos' and name=p.url) or p_url is null or right(p_url,length('/storage/v1/object/public/profile-photos/'||p.url))<> '/storage/v1/object/public/profile-photos/'||p.url then raise exception 'Upload not found'; end if;
 update public.profile_photos set pending=false,url=p_url where id=p_id; p.url:=p_url;
 end if;
 update public.profile_photos set active=false where user_id=p.user_id and kind=p.kind and active;
 update public.profile_photos set active=true where id=p_id;
 if p.kind='avatar' then update public.profiles set avatar_url=p.url where id=p.user_id; end if;
end $$;
create or replace function public.delete_profile_photo(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare p public.profile_photos; replacement uuid; begin
 select * into p from public.profile_photos where id=p_id and user_id=auth.uid(); if not found then raise exception 'Photo not found'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p.user_id::text||p.kind,0));
 delete from public.profile_photos where id=p_id;
 if p.active then select id into replacement from public.profile_photos where user_id=p.user_id and kind=p.kind and not pending order by created_at desc limit 1;
 if replacement is not null then perform public.activate_profile_photo(replacement); elsif p.kind='avatar' then update public.profiles set avatar_url=null where id=p.user_id; end if; end if;
end $$;
create or replace function public.guard_profile_update() returns trigger language plpgsql set search_path='' as $$ begin
 if new.id<>old.id or new.created_at<>old.created_at then raise exception 'Immutable profile identity'; end if;
 if new.username is distinct from old.username then if old.username_changed_at>now()-interval '7 days' then raise exception 'Username may only be changed once every 7 days'; end if; new.username_changed_at:=now(); else new.username_changed_at:=old.username_changed_at; end if;
 if new.avatar_url is distinct from old.avatar_url then
 if auth.uid() is distinct from new.id or (new.avatar_url is not null and not exists(select 1 from public.profile_photos where user_id=new.id and kind='avatar' and active and not pending and url=new.avatar_url)) or (new.avatar_url is null and exists(select 1 from public.profile_photos where user_id=new.id and kind='avatar' and active)) then raise exception 'Use profile photo manager'; end if; end if; return new; end $$;
alter table public.profile_photos enable row level security;
create policy profile_photos_read on public.profile_photos for select to anon,authenticated using(not pending or user_id=auth.uid());
revoke insert,update,delete on public.profile_photos from anon,authenticated;
grant select on public.profile_photos to anon,authenticated;
do $$ declare t text; begin foreach t in array array['profile_photo_comments','profile_photo_reactions','profile_photo_comment_reactions'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy public_read on public.%I for select to anon,authenticated using(true)',t);
 execute format('create policy own_write on public.%I for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid())',t);
 execute format('grant select on public.%I to anon,authenticated',t);
 execute format('grant insert,update,delete on public.%I to authenticated',t);
 end loop; end $$;
revoke execute on function public.reserve_profile_photo(text,text,text),public.activate_profile_photo(uuid,text),public.delete_profile_photo(uuid) from public,anon;
grant execute on function public.reserve_profile_photo(text,text,text),public.activate_profile_photo(uuid,text),public.delete_profile_photo(uuid) to authenticated;
commit;
