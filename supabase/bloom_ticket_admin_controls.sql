-- SoftBloomSMP ticket attachments, admin wallet and post limits
-- Run after bloom_shop.sql and prior archive migrations.
alter table public.bloom_ticket_messages add column if not exists image_path text;
alter table public.bloom_ticket_messages alter column body drop not null;
alter table public.bloom_ticket_messages drop constraint if exists bloom_ticket_messages_body_check;
alter table public.bloom_ticket_messages add constraint bloom_ticket_messages_body_check check(length(coalesce(body,''))<=3000 and (length(trim(coalesce(body,'')))>0 or image_path is not null));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('bloom-ticket-images','bloom-ticket-images',false,8388608,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict(id) do update set public=false,file_size_limit=8388608,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists bloom_ticket_image_insert on storage.objects;
create policy bloom_ticket_image_insert on storage.objects for insert to authenticated
with check(bucket_id='bloom-ticket-images' and
  exists(select 1 from public.bloom_tickets t where t.id::text=split_part(name,'/',1)
  and (t.user_id=auth.uid() or public.bloom_is_admin())
  and t.status not in ('approved','rejected','closed'))
  and split_part(name,'/',2)=auth.uid()::text);
drop policy if exists bloom_ticket_image_read on storage.objects;
create policy bloom_ticket_image_read on storage.objects for select to authenticated
using(bucket_id='bloom-ticket-images' and exists(select 1 from public.bloom_tickets t
 where t.id::text=split_part(name,'/',1) and (t.user_id=auth.uid() or public.bloom_is_admin())));
create or replace function public.bloom_send_ticket_attachment(p_ticket uuid,p_body text default '',p_image_path text default null)
returns void language plpgsql security definer set search_path='' as $$
declare t public.bloom_tickets%rowtype;
begin
 if auth.uid() is null then raise exception 'Sign in required';end if;
 select * into t from public.bloom_tickets where id=p_ticket;
 if not found or (t.user_id<>auth.uid() and not public.bloom_is_admin()) then raise exception 'Ticket not found';end if;
 if t.status in ('approved','rejected','closed') then raise exception 'Ticket closed';end if;
 if length(coalesce(p_body,''))>3000 or (length(trim(coalesce(p_body,'')))=0 and p_image_path is null) then raise exception 'Message required';end if;
 if p_image_path is not null then
  if split_part(p_image_path,'/',1)<>p_ticket::text or split_part(p_image_path,'/',2)<>auth.uid()::text
  or not exists(select 1 from storage.objects where bucket_id='bloom-ticket-images' and name=p_image_path)
  then raise exception 'Invalid attachment';end if;
 end if;
 insert into public.bloom_ticket_messages(ticket_id,sender_id,body,image_path)
 values(p_ticket,auth.uid(),trim(coalesce(p_body,'')),p_image_path);
end $$;
revoke all on function public.bloom_send_ticket_attachment(uuid,text,text) from public;
grant execute on function public.bloom_send_ticket_attachment(uuid,text,text) to authenticated;

-- Admin wallet adjustments: audited in the existing ledger.
create or replace function public.bloom_admin_set_balance(p_user uuid,p_balance bigint)
returns void language plpgsql security definer set search_path='' as $$
declare old_balance bigint; change_amount bigint;
begin
 if not public.bloom_is_admin() then raise exception 'Admin only';end if;
 if p_balance is null or p_balance<0 or p_balance>1000000000000 then raise exception 'Invalid balance';end if;
 perform 1 from auth.users where id=p_user;
 if not found then raise exception 'Unknown player UUID';end if;
 insert into public.bloom_wallets(user_id,balance) values(p_user,0) on conflict do nothing;
 select balance into old_balance from public.bloom_wallets where user_id=p_user for update;
 change_amount:=p_balance-old_balance;
 update public.bloom_wallets set balance=p_balance,updated_at=now() where user_id=p_user;
 if change_amount<>0 then
  insert into public.bloom_wallet_ledger(user_id,delta,reason)
  values(p_user,change_amount,'admin_balance_set_by:'||auth.uid()::text);
 end if;
end $$;
revoke all on function public.bloom_admin_set_balance(uuid,bigint) from public;
grant execute on function public.bloom_admin_set_balance(uuid,bigint) to authenticated;

-- Per-player maximum total posts. Default is 10, configurable below.
create table if not exists public.bloom_post_limits(
 user_id uuid primary key references auth.users(id) on delete cascade,
 max_posts integer not null check(max_posts between 0 and 1000000),
 updated_at timestamptz not null default now()
);
alter table public.bloom_post_limits enable row level security;
drop policy if exists bloom_post_limits_read on public.bloom_post_limits;
create policy bloom_post_limits_read on public.bloom_post_limits for select to authenticated
using(user_id=auth.uid() or public.bloom_is_admin());
grant select on public.bloom_post_limits to authenticated;
create or replace function public.bloom_admin_set_post_limit(p_user uuid,p_limit integer)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.bloom_is_admin() then raise exception 'Admin only';end if;
 if p_limit is null or p_limit<0 or p_limit>1000000 then raise exception 'Invalid post limit';end if;
 perform 1 from auth.users where id=p_user;
 if not found then raise exception 'Unknown player UUID';end if;
 insert into public.bloom_post_limits(user_id,max_posts) values(p_user,p_limit)
 on conflict(user_id) do update set max_posts=excluded.max_posts,updated_at=now();
end $$;
revoke all on function public.bloom_admin_set_post_limit(uuid,integer) from public;
grant execute on function public.bloom_admin_set_post_limit(uuid,integer) to authenticated;

create or replace function public.bloom_enforce_post_limit()
returns trigger language plpgsql security definer set search_path='' as $$
declare lim integer; current_count bigint;
begin
 if public.bloom_is_admin() then return new;end if;
 -- Serialize posting for each author to avoid simultaneous inserts bypassing the cap.
 perform pg_advisory_xact_lock(hashtextextended(new.user_id::text,0));
 select max_posts into lim from public.bloom_post_limits where user_id=new.user_id;
 lim:=coalesce(lim,10);
 select count(*) into current_count from public.posts where user_id=new.user_id;
 if current_count>=lim then raise exception 'Post limit reached (% posts). Contact an admin.',lim;end if;
 return new;
end $$;
drop trigger if exists bloom_posts_limit_guard on public.posts;
create trigger bloom_posts_limit_guard before insert on public.posts
for each row execute function public.bloom_enforce_post_limit();
