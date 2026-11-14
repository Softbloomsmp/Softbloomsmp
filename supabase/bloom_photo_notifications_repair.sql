begin;
alter table public.notifications add column if not exists photo_id uuid references public.profile_photos(id) on delete cascade;
alter table public.notifications add column if not exists photo_comment_id uuid references public.profile_photo_comments(id) on delete cascade;
-- Preserve the existing notification kinds and add photo events.
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check(kind in ('post_reaction','comment','reply','comment_reaction','message','follow','profile_photo_comment','cover_photo_comment','profile_photo_reply'));
create unique index if not exists notifications_photo_event_unique on public.notifications(recipient_id,photo_comment_id,kind) where photo_comment_id is not null;
create or replace function public.guard_notification_update() returns trigger language plpgsql set search_path='' as $$
begin
 if (to_jsonb(new)-'read_at') is distinct from (to_jsonb(old)-'read_at') then raise exception 'Notification content is immutable'; end if;
 if old.read_at is not null and new.read_at is distinct from old.read_at then raise exception 'Read notifications cannot be reset'; end if;
 if old.read_at is null and new.read_at is null then return new; end if;
 if new.read_at is null or new.read_at > now()+interval '1 minute' then raise exception 'Invalid read timestamp'; end if;
 return new;
end $$;
create or replace function public.emit_profile_photo_notification() returns trigger language plpgsql security definer set search_path='' as $$
declare owner_id uuid; photo_kind text; parent_author uuid;
begin
 select user_id,kind into owner_id,photo_kind from public.profile_photos where id=new.photo_id and not pending;
 if owner_id is null then return new; end if;
 if owner_id<>new.user_id then
 insert into public.notifications(recipient_id,actor_id,kind,post_owner_id,photo_id,photo_comment_id)
 values(owner_id,new.user_id,case when photo_kind='cover' then 'cover_photo_comment' else 'profile_photo_comment' end,owner_id,new.photo_id,new.id) on conflict do nothing;
 end if;
 if new.parent_id is not null then
 select user_id into parent_author from public.profile_photo_comments where id=new.parent_id and photo_id=new.photo_id;
 if parent_author is not null and parent_author<>new.user_id and parent_author<>owner_id then
 insert into public.notifications(recipient_id,actor_id,kind,post_owner_id,photo_id,photo_comment_id)
 values(parent_author,new.user_id,'profile_photo_reply',owner_id,new.photo_id,new.id) on conflict do nothing;
 end if;
 end if;
 return new;
end $$;
drop trigger if exists notify_profile_photo_comment on public.profile_photo_comments;
create trigger notify_profile_photo_comment after insert on public.profile_photo_comments for each row execute function public.emit_profile_photo_notification();
revoke execute on function public.emit_profile_photo_notification() from public,anon,authenticated;
-- Verify the trigger is installed and enabled before committing.
do $$ begin
 if not exists (select 1 from pg_trigger where tgrelid='public.profile_photo_comments'::regclass and tgname='notify_profile_photo_comment' and tgenabled in ('O','A') and not tgisinternal) then
  raise exception 'Photo notification trigger is missing or disabled';
 end if;
end $$;
-- Restrict notification reads to the recipient, as in the original schema.
alter table public.notifications enable row level security;
drop policy if exists notifications_read on public.notifications;
create policy notifications_read on public.notifications for select to authenticated using(recipient_id=(select auth.uid()));
grant select on public.notifications to authenticated;
-- Refresh PostgREST metadata after adding columns.
notify pgrst, 'reload schema';
commit;
-- Diagnostic: shows whether existing comments have matching notifications.
-- Missing rows can also mean that the recipient cleared notifications.
select p.kind as photo_kind, c.id as photo_comment_id, c.created_at,
 exists(select 1 from public.notifications n where n.photo_comment_id=c.id and n.recipient_id=p.user_id) as owner_notification_exists
from public.profile_photo_comments c join public.profile_photos p on p.id=c.photo_id
where c.user_id<>p.user_id and not p.pending
order by c.created_at desc limit 20;

