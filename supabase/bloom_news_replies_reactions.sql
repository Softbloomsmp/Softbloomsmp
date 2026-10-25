-- Run once in Supabase SQL Editor after bloom_news.sql.
-- Threaded replies, constrained to their parent announcement.
alter table public.bloom_news_comments
 add column if not exists parent_id uuid references public.bloom_news_comments(id) on delete cascade;
create index if not exists bloom_news_comments_parent_idx on public.bloom_news_comments(parent_id);
create or replace function public.bloom_news_reply_guard()
returns trigger language plpgsql set search_path='' as $$
declare parent_news uuid;
begin
 if tg_op='UPDATE' then
  if new.news_id is distinct from old.news_id
     or new.parent_id is distinct from old.parent_id
     or new.user_id is distinct from old.user_id then
   raise exception 'Cannot change comment ownership or thread';
  end if;
 end if;
 if new.parent_id is not null then
  if new.parent_id=new.id then raise exception 'Cannot reply to yourself as a comment'; end if;
  select news_id into parent_news from public.bloom_news_comments where id=new.parent_id;
  if parent_news is distinct from new.news_id then raise exception 'Reply must belong to same news post'; end if;
 end if;
 return new;
end $$;
drop trigger if exists bloom_news_reply_guard_trigger on public.bloom_news_comments;
create trigger bloom_news_reply_guard_trigger before insert or update on public.bloom_news_comments
for each row execute function public.bloom_news_reply_guard();

create table if not exists public.bloom_news_comment_reactions(
 comment_id uuid not null references public.bloom_news_comments(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 emoji text not null check(emoji in ('❤️','👍','🥰','😂','😮','😢','🌸')),
 primary key(comment_id,user_id)
);
alter table public.bloom_news_comment_reactions enable row level security;
grant select,insert,update,delete on public.bloom_news_comment_reactions to authenticated;
drop policy if exists bloom_news_comment_reactions_read on public.bloom_news_comment_reactions;
create policy bloom_news_comment_reactions_read on public.bloom_news_comment_reactions for select to authenticated using(true);
drop policy if exists bloom_news_comment_reactions_insert on public.bloom_news_comment_reactions;
create policy bloom_news_comment_reactions_insert on public.bloom_news_comment_reactions for insert to authenticated with check(user_id=auth.uid());
drop policy if exists bloom_news_comment_reactions_update on public.bloom_news_comment_reactions;
create policy bloom_news_comment_reactions_update on public.bloom_news_comment_reactions for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists bloom_news_comment_reactions_delete on public.bloom_news_comment_reactions;
create policy bloom_news_comment_reactions_delete on public.bloom_news_comment_reactions for delete to authenticated using(user_id=auth.uid());
