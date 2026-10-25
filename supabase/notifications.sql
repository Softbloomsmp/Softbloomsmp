-- SoftBloomSMP notifications. Run once in Supabase SQL Editor.
-- Requires existing posts, comments, reactions, comment_reactions and direct_messages tables.
create table if not exists public.notifications (
 id uuid primary key default gen_random_uuid(),
 recipient_id uuid not null references public.profiles(id) on delete cascade,
 actor_id uuid not null references public.profiles(id) on delete cascade,
 kind text not null check(kind in ('post_reaction','comment','reply','comment_reaction','message','follow')),
 post_id uuid references public.posts(id) on delete cascade,
 post_owner_id uuid references public.profiles(id) on delete cascade,
 comment_id uuid references public.comments(id) on delete cascade,
 message_id uuid references public.direct_messages(id) on delete cascade,
 created_at timestamptz not null default now(),
 read_at timestamptz
);
create index if not exists notifications_recipient_latest on public.notifications(recipient_id,created_at desc);
create index if not exists notifications_recipient_unread on public.notifications(recipient_id) where read_at is null;
create unique index if not exists notifications_unique_post_reaction on public.notifications(actor_id,post_id,kind) where kind='post_reaction';
create unique index if not exists notifications_unique_comment_reaction on public.notifications(actor_id,comment_id,kind) where kind='comment_reaction';
create unique index if not exists notifications_unique_comment on public.notifications(comment_id,kind) where kind in ('comment','reply');
create unique index if not exists notifications_unique_message on public.notifications(message_id) where message_id is not null;
alter table public.notifications enable row level security;
drop policy if exists notifications_read on public.notifications;
create policy notifications_read on public.notifications for select to authenticated using(recipient_id=(select auth.uid()));
drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications for update to authenticated
using(recipient_id=(select auth.uid())) with check(recipient_id=(select auth.uid()));
-- No INSERT or DELETE policies: clients cannot manufacture notifications.
revoke all on public.notifications from anon;
revoke all on public.notifications from authenticated;
grant select,update on public.notifications to authenticated;

-- Recipients may ONLY mark their own notifications as read; never change the event.
create or replace function public.guard_notification_update() returns trigger
language plpgsql set search_path='' as $$
begin
 if row(new.id,new.recipient_id,new.actor_id,new.kind,new.post_id,new.post_owner_id,new.comment_id,new.message_id,new.created_at)
 is distinct from
 row(old.id,old.recipient_id,old.actor_id,old.kind,old.post_id,old.post_owner_id,old.comment_id,old.message_id,old.created_at)
 then raise exception 'Notification content is immutable'; end if;
 if old.read_at is not null and new.read_at is distinct from old.read_at then
  raise exception 'Read notifications cannot be reset'; end if;
 if old.read_at is null and new.read_at is null then return new;end if;
 if new.read_at is null or new.read_at > now() + interval '1 minute' then
  raise exception 'Invalid read timestamp'; end if;
 return new;
end $$;
drop trigger if exists guard_notification_update_trigger on public.notifications;
create trigger guard_notification_update_trigger before update on public.notifications
for each row execute function public.guard_notification_update();

-- A single SECURITY DEFINER trigger function generates events from verified rows.
create or replace function public.emit_social_notification() returns trigger
language plpgsql security definer set search_path='' as $$
declare receiver uuid; v_actor_id uuid; owner_id uuid; parent_author uuid; event_kind text; pid uuid; cid uuid; mid uuid;
begin
 if tg_table_name='reactions' then
  if tg_op='DELETE' then
   delete from public.notifications where actor_id=old.user_id and post_id=old.post_id and kind='post_reaction';
   return old;
  end if;
  if tg_op='UPDATE' then return new;end if;
  select user_id into receiver from public.posts where id=new.post_id;
  owner_id:=receiver;pid:=new.post_id;event_kind:='post_reaction';
 elsif tg_table_name='comments' then
  pid:=new.post_id;cid:=new.id;
  select user_id into owner_id from public.posts where id=pid;
  if new.parent_id is not null then
   select user_id into parent_author from public.comments where id=new.parent_id;
   receiver:=parent_author;event_kind:='reply';
  else
   receiver:=owner_id;event_kind:='comment';
  end if;
 elsif tg_table_name='comment_reactions' then
  if tg_op='DELETE' then
   delete from public.notifications where actor_id=old.user_id and comment_id=old.comment_id and kind='comment_reaction';
   return old;
  end if;
  if tg_op='UPDATE' then return new;end if;
  cid:=new.comment_id;
  select c.user_id,c.post_id,p.user_id into receiver,pid,owner_id
  from public.comments c join public.posts p on p.id=c.post_id where c.id=cid;
  event_kind:='comment_reaction';
 elsif tg_table_name='direct_messages' then
  receiver:=new.recipient_id;mid:=new.id;event_kind:='message';
 elsif tg_table_name='follows' then
  receiver:=new.following_id;event_kind:='follow';
 else
  return new;
 end if;

 if tg_table_name='follows' then
  v_actor_id:=new.follower_id;
 elsif tg_table_name='direct_messages' then
  v_actor_id:=new.sender_id;
 else
  v_actor_id:=new.user_id;
 end if;

 if receiver is not null and v_actor_id is not null and receiver<>v_actor_id then
  insert into public.notifications(recipient_id,actor_id,kind,post_id,post_owner_id,comment_id,message_id)
  values(receiver,v_actor_id,event_kind,pid,owner_id,cid,mid)
  on conflict do nothing;
 end if;
 return new;
end $$;
drop trigger if exists notify_post_reaction on public.reactions;
create trigger notify_post_reaction after insert or delete or update on public.reactions
for each row execute function public.emit_social_notification();
drop trigger if exists notify_comment on public.comments;
create trigger notify_comment after insert on public.comments
for each row execute function public.emit_social_notification();
drop trigger if exists notify_comment_reaction on public.comment_reactions;
create trigger notify_comment_reaction after insert or delete or update on public.comment_reactions
for each row execute function public.emit_social_notification();
drop trigger if exists notify_message on public.direct_messages;
create trigger notify_message after insert on public.direct_messages
for each row execute function public.emit_social_notification();
drop trigger if exists notify_follow on public.follows;
create trigger notify_follow after insert on public.follows
for each row execute function public.emit_social_notification();
