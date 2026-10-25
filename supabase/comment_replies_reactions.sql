-- Run once in Supabase SQL Editor BEFORE deploying the updated Feed.tsx.
-- Keep existing RLS policies enabled.
alter table public.comments add column if not exists parent_id uuid references public.comments(id) on delete cascade;
create index if not exists comments_parent_idx on public.comments(parent_id);

-- Ensure a reply belongs to the same post and cannot reference itself.
create or replace function public.validate_comment_parent() returns trigger
language plpgsql set search_path = '' as $$
declare parent_post uuid;
begin
 if new.parent_id is not null then
  if new.parent_id = new.id then raise exception 'Cannot reply to self'; end if;
  select post_id into parent_post from public.comments where id = new.parent_id;
  if parent_post is distinct from new.post_id then
   raise exception 'Reply must reference a comment on the same post';
  end if;
 end if;
 return new;
end $$;
drop trigger if exists validate_comment_parent_trigger on public.comments;
create trigger validate_comment_parent_trigger before insert on public.comments
for each row execute function public.validate_comment_parent();

-- Parent links cannot be changed after insertion (prevents cycles).
create or replace function public.guard_comment() returns trigger
language plpgsql set search_path = '' as $$
begin
 if new.user_id <> old.user_id or new.post_id <> old.post_id
    or new.created_at <> old.created_at
    or new.parent_id is distinct from old.parent_id then
  raise exception 'Comment ownership and parent are immutable';
 end if;
 new.updated_at := now();
 return new;
end $$;

create table if not exists public.comment_reactions (
 comment_id uuid not null references public.comments(id) on delete cascade,
 post_id uuid not null references public.posts(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 emoji text not null check (emoji in ('❤️','👍','🥰','😂','😮','😢','🌸')),
 primary key(comment_id,user_id)
);
create index if not exists comment_reactions_post_idx on public.comment_reactions(post_id);

-- Prevent an incorrect post_id being assigned to a reaction.
create or replace function public.validate_comment_reaction() returns trigger
language plpgsql set search_path = '' as $$
declare actual_post uuid;
begin
 select post_id into actual_post from public.comments where id = new.comment_id;
 if actual_post is distinct from new.post_id then
  raise exception 'Reaction post does not match comment';
 end if;
 return new;
end $$;
drop trigger if exists validate_comment_reaction_trigger on public.comment_reactions;
create trigger validate_comment_reaction_trigger before insert or update on public.comment_reactions
for each row execute function public.validate_comment_reaction();

alter table public.comment_reactions enable row level security;
drop policy if exists comment_reactions_read on public.comment_reactions;
create policy comment_reactions_read on public.comment_reactions
for select to authenticated using (true);
drop policy if exists comment_reactions_insert on public.comment_reactions;
create policy comment_reactions_insert on public.comment_reactions
for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists comment_reactions_update on public.comment_reactions;
create policy comment_reactions_update on public.comment_reactions
for update to authenticated using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
drop policy if exists comment_reactions_delete on public.comment_reactions;
create policy comment_reactions_delete on public.comment_reactions
for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.comment_reactions from anon;
grant select,insert,update,delete on public.comment_reactions to authenticated;
