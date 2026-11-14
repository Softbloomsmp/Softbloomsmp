begin;
alter table public.notifications add column if not exists reaction_emoji text;
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check(kind in ('post_reaction','comment','reply','comment_reaction','message','follow','profile_photo_comment','cover_photo_comment','profile_photo_reply','profile_photo_reaction','cover_photo_reaction','photo_comment_reaction','photo_reply_reaction'));
-- Preserve comment-event uniqueness, but allow distinct people to react to the same comment.
drop index if exists public.notifications_photo_event_unique;
create unique index notifications_photo_event_unique on public.notifications(recipient_id,photo_comment_id,kind) where photo_comment_id is not null and kind in ('profile_photo_comment','cover_photo_comment','profile_photo_reply');
create unique index if not exists notifications_photo_reaction_unique on public.notifications(actor_id,photo_id,kind) where kind in ('profile_photo_reaction','cover_photo_reaction');
create unique index if not exists notifications_photo_comment_reaction_unique on public.notifications(actor_id,photo_comment_id,kind) where kind in ('photo_comment_reaction','photo_reply_reaction');
create or replace function public.emit_photo_reaction_notification() returns trigger language plpgsql security definer set search_path='' as $$
declare receiver uuid; owner_id uuid; pid uuid; cid uuid; event_kind text; pk text; parent uuid;
begin
 if tg_table_name='profile_photo_reactions' then
  pid:=new.photo_id;
  select user_id,kind into owner_id,pk from public.profile_photos where id=pid and not pending;
  receiver:=owner_id;
  event_kind:=case when pk='cover' then 'cover_photo_reaction' else 'profile_photo_reaction' end;
 elsif tg_table_name='profile_photo_comment_reactions' then
  cid:=new.comment_id;
  select c.user_id,c.photo_id,c.parent_id,p.user_id into receiver,pid,parent,owner_id from public.profile_photo_comments c join public.profile_photos p on p.id=c.photo_id where c.id=cid and not p.pending;
  event_kind:=case when parent is null then 'photo_comment_reaction' else 'photo_reply_reaction' end;
 else return new;
 end if;
 if receiver is not null and receiver<>new.user_id then
  insert into public.notifications(recipient_id,actor_id,kind,post_owner_id,photo_id,photo_comment_id,reaction_emoji)
  values(receiver,new.user_id,event_kind,owner_id,pid,cid,new.emoji) on conflict do nothing;
 end if;
 return new;
end $$;
drop trigger if exists notify_profile_photo_reaction on public.profile_photo_reactions;
create trigger notify_profile_photo_reaction after insert on public.profile_photo_reactions for each row execute function public.emit_photo_reaction_notification();
drop trigger if exists notify_profile_photo_comment_reaction on public.profile_photo_comment_reactions;
create trigger notify_profile_photo_comment_reaction after insert on public.profile_photo_comment_reactions for each row execute function public.emit_photo_reaction_notification();
revoke execute on function public.emit_photo_reaction_notification() from public,anon,authenticated;
notify pgrst, 'reload schema';
commit;
select tgname,tgenabled from pg_trigger where tgname in ('notify_profile_photo_reaction','notify_profile_photo_comment_reaction') and not tgisinternal;
