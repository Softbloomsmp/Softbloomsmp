-- Run once in Supabase SQL Editor. Review before applying to an existing project.
create extension if not exists pgcrypto;
create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 username text not null unique,
 avatar_url text,
 bio text,
 username_changed_at timestamptz,
 created_at timestamptz not null default now(),
 constraint username_format check (username ~ '^[A-Za-z0-9_]{3,24}$'),
 constraint bio_length check (char_length(coalesce(bio,''))<=300)
);
create table if not exists public.posts (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 body text not null default '',
 media_url text,
 media_type text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint post_body_length check (char_length(body)<=5000),
 constraint post_not_empty check (char_length(btrim(body))>0 or media_url is not null),
 constraint post_media_type check ((media_url is null and media_type is null) or (media_url is not null and media_type in ('image','video'))),
 constraint post_media_origin check (media_url is null or media_url like '%/storage/v1/object/public/post-media/' || user_id::text || '/%')
);
create table if not exists public.comments (
 id uuid primary key default gen_random_uuid(),post_id uuid not null references public.posts(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 body text not null check (char_length(btrim(body)) between 1 and 2000),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table if not exists public.reactions (
 post_id uuid not null references public.posts(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 emoji text not null check (emoji in ('❤️','👍','🥰','😂','😮','😢','🌸')),
 primary key(post_id,user_id)
);
create table if not exists public.follows (
 follower_id uuid not null references public.profiles(id) on delete cascade,
 following_id uuid not null references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(follower_id,following_id),check(follower_id<>following_id)
);
create index if not exists posts_user_created on public.posts(user_id,created_at desc);
create index if not exists posts_created on public.posts(created_at desc);
create index if not exists comments_post_created on public.comments(post_id,created_at);
create index if not exists follows_following on public.follows(following_id);

create or replace function public.make_profile() returns trigger language plpgsql security definer set search_path='' as $$
declare base text; candidate text;
begin
 base:=regexp_replace(coalesce(new.raw_user_meta_data->>'user_name',new.raw_user_meta_data->>'preferred_username',new.raw_user_meta_data->>'name','bloom'),'[^A-Za-z0-9_]','','g');
 base:=left(base,14);if length(base)<3 then base:='bloom';end if;
 candidate:=base||'_'||substr(replace(new.id::text,'-',''),1,8);
 insert into public.profiles(id,username,avatar_url) values(new.id,candidate,nullif(new.raw_user_meta_data->>'avatar_url','')) on conflict(id) do nothing;
 return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.make_profile();
-- Backfill accounts that existed before schema installation.
insert into public.profiles(id,username,avatar_url)
select id,'bloom_'||substr(replace(id::text,'-',''),1,8),nullif(raw_user_meta_data->>'avatar_url','') from auth.users
on conflict(id) do nothing;

create or replace function public.guard_profile_update() returns trigger language plpgsql set search_path='' as $$
begin
 if new.id<>old.id or new.created_at<>old.created_at then raise exception 'Immutable profile identity';end if;
 if new.username is distinct from old.username then
  if old.username_changed_at is not null and old.username_changed_at>now()-interval '7 days' then raise exception 'Username may only be changed once every 7 days';end if;
  new.username_changed_at:=now();
 else
  new.username_changed_at:=old.username_changed_at;
 end if;
 -- Avatar is provider managed; do not permit client changes.
 new.avatar_url:=old.avatar_url;
 return new;
end $$;
drop trigger if exists profile_update_guard on public.profiles;
create trigger profile_update_guard before update on public.profiles for each row execute function public.guard_profile_update();

create or replace function public.guard_post() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='INSERT' then
  -- Serialize competing inserts for the same account to enforce the 5-post cap.
  perform 1 from public.profiles where id=new.user_id for update;
  if (select count(*) from public.posts where user_id=new.user_id)>=5 then raise exception 'Maximum of 5 existing posts per user';end if;
  new.created_at:=now();new.updated_at:=now();
 else
  if new.user_id<>old.user_id or new.created_at<>old.created_at then raise exception 'Post ownership is immutable';end if;
  new.updated_at:=now();
 end if;
 return new;
end $$;
drop trigger if exists posts_guard on public.posts;
create trigger posts_guard before insert or update on public.posts for each row execute function public.guard_post();

create or replace function public.guard_comment() returns trigger language plpgsql set search_path='' as $$
begin
 if new.user_id<>old.user_id or new.post_id<>old.post_id or new.created_at<>old.created_at then raise exception 'Comment ownership is immutable';end if;
 new.updated_at:=now();return new;
end $$;
drop trigger if exists comments_guard on public.comments;
create trigger comments_guard before update on public.comments for each row execute function public.guard_comment();

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.reactions enable row level security;
alter table public.follows enable row level security;
-- Force RLS for ordinary client roles. Service-role still bypasses by design.
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to anon,authenticated using(true);
drop policy if exists profiles_edit on public.profiles;
create policy profiles_edit on public.profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
drop policy if exists posts_read on public.posts;
create policy posts_read on public.posts for select to anon,authenticated using(true);
drop policy if exists posts_insert on public.posts;
create policy posts_insert on public.posts for insert to authenticated with check(user_id=(select auth.uid()));
drop policy if exists posts_update on public.posts;
create policy posts_update on public.posts for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
drop policy if exists posts_delete on public.posts;
create policy posts_delete on public.posts for delete to authenticated using(user_id=(select auth.uid()));
drop policy if exists comments_read on public.comments;
create policy comments_read on public.comments for select to anon,authenticated using(true);
drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments for insert to authenticated with check(user_id=(select auth.uid()));
drop policy if exists comments_update on public.comments;
create policy comments_update on public.comments for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
drop policy if exists comments_delete on public.comments;
create policy comments_delete on public.comments for delete to authenticated using(user_id=(select auth.uid()));
drop policy if exists reactions_read on public.reactions;
create policy reactions_read on public.reactions for select to anon,authenticated using(true);
drop policy if exists reactions_insert on public.reactions;
create policy reactions_insert on public.reactions for insert to authenticated with check(user_id=(select auth.uid()));
drop policy if exists reactions_update on public.reactions;
create policy reactions_update on public.reactions for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
drop policy if exists reactions_delete on public.reactions;
create policy reactions_delete on public.reactions for delete to authenticated using(user_id=(select auth.uid()));
drop policy if exists follows_read on public.follows;
create policy follows_read on public.follows for select to anon,authenticated using(true);
drop policy if exists follows_insert on public.follows;
create policy follows_insert on public.follows for insert to authenticated with check(follower_id=(select auth.uid()));
drop policy if exists follows_delete on public.follows;
create policy follows_delete on public.follows for delete to authenticated using(follower_id=(select auth.uid()));

-- Public read, but NO direct client upload/update/delete. Media upload API uses private service-role key.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('post-media','post-media',true,10485760,array['image/jpeg','image/png','image/gif','image/webp','video/mp4','video/webm'])
on conflict(id) do update set public=true,file_size_limit=10485760,allowed_mime_types=excluded.allowed_mime_types;
