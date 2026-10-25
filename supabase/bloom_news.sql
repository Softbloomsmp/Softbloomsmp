-- SoftBloomSMP News. Run after bloom_shop.sql (uses bloom_is_admin()).
create table if not exists public.bloom_news(
 id uuid primary key default gen_random_uuid(),
 author_id uuid not null references public.profiles(id),
 title text not null check(length(trim(title)) between 1 and 140),
 body text not null default '' check(length(body)<=10000),
 media_url text,media_type text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint bloom_news_media_check check(
  (media_url is null and media_type is null) or
  (media_url is not null and media_type in ('image','video') and
   media_url like '%/storage/v1/object/public/bloom-news-media/' || author_id::text || '/%'))
);
create table if not exists public.bloom_news_comments(
 id uuid primary key default gen_random_uuid(),
 news_id uuid not null references public.bloom_news(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 body text not null check(length(trim(body)) between 1 and 2000),
 created_at timestamptz not null default now()
);
create table if not exists public.bloom_news_reactions(
 news_id uuid not null references public.bloom_news(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 emoji text not null check(emoji in ('❤️','👍','🥰','😂','😮','😢','🌸')),
 primary key(news_id,user_id)
);
create index if not exists bloom_news_recent on public.bloom_news(created_at desc);
create index if not exists bloom_news_comments_recent on public.bloom_news_comments(news_id,created_at);
alter table public.bloom_news enable row level security;
alter table public.bloom_news_comments enable row level security;
alter table public.bloom_news_reactions enable row level security;
grant select,insert,update,delete on public.bloom_news,public.bloom_news_comments,public.bloom_news_reactions to authenticated;
drop policy if exists bloom_news_read on public.bloom_news;
create policy bloom_news_read on public.bloom_news for select to authenticated using(true);
drop policy if exists bloom_news_insert on public.bloom_news;
create policy bloom_news_insert on public.bloom_news for insert to authenticated with check(public.bloom_is_admin() and author_id=auth.uid());
drop policy if exists bloom_news_update on public.bloom_news;
create policy bloom_news_update on public.bloom_news for update to authenticated using(public.bloom_is_admin()) with check(public.bloom_is_admin() and author_id=auth.uid());
drop policy if exists bloom_news_delete on public.bloom_news;
create policy bloom_news_delete on public.bloom_news for delete to authenticated using(public.bloom_is_admin());
drop policy if exists bloom_news_comments_read on public.bloom_news_comments;
create policy bloom_news_comments_read on public.bloom_news_comments for select to authenticated using(true);
drop policy if exists bloom_news_comments_insert on public.bloom_news_comments;
create policy bloom_news_comments_insert on public.bloom_news_comments for insert to authenticated with check(user_id=auth.uid());
drop policy if exists bloom_news_comments_delete on public.bloom_news_comments;
create policy bloom_news_comments_delete on public.bloom_news_comments for delete to authenticated using(user_id=auth.uid() or public.bloom_is_admin());
drop policy if exists bloom_news_reactions_read on public.bloom_news_reactions;
create policy bloom_news_reactions_read on public.bloom_news_reactions for select to authenticated using(true);
drop policy if exists bloom_news_reactions_insert on public.bloom_news_reactions;
create policy bloom_news_reactions_insert on public.bloom_news_reactions for insert to authenticated with check(user_id=auth.uid());
drop policy if exists bloom_news_reactions_update on public.bloom_news_reactions;
create policy bloom_news_reactions_update on public.bloom_news_reactions for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists bloom_news_reactions_delete on public.bloom_news_reactions;
create policy bloom_news_reactions_delete on public.bloom_news_reactions for delete to authenticated using(user_id=auth.uid());

-- Block ownership reassignment, protect created_at and bump edit timestamp.
create or replace function public.bloom_news_guard()
returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='UPDATE' then
  if new.author_id<>old.author_id or new.created_at<>old.created_at then
   raise exception 'News ownership and original publish date cannot change';
  end if;
  new.updated_at=now();
 end if;
 return new;
end $$;
drop trigger if exists bloom_news_guard_trigger on public.bloom_news;
create trigger bloom_news_guard_trigger before update on public.bloom_news
for each row execute function public.bloom_news_guard();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('bloom-news-media','bloom-news-media',true,26214400,array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm'])
on conflict(id) do update set public=true,file_size_limit=26214400,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists bloom_news_media_insert on storage.objects;
create policy bloom_news_media_insert on storage.objects for insert to authenticated
with check(bucket_id='bloom-news-media' and public.bloom_is_admin() and split_part(name,'/',1)=auth.uid()::text);
-- Public bucket allows viewing media without giving regular members upload rights.
