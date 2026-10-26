-- Run ONCE after the v001 and v002 bridge migrations.
-- Reserve one announcement per paid Minecraft order, including item stash orders.
create table if not exists public.bloom_bridge_announcements (
  order_id uuid primary key references public.bloom_orders(id) on delete cascade,
  announced_at timestamptz not null default now()
);
revoke all on public.bloom_bridge_announcements from public, anon, authenticated;
-- Do not broadcast historical purchases when the feature is first installed.
insert into public.bloom_bridge_announcements(order_id)
select d.order_id from public.bloom_deliveries d
join public.bloom_orders o on o.id=d.order_id where o.status='paid'
on conflict do nothing;

create or replace function public.bloom_bridge_claim_announcements()
returns table(order_id uuid,recipient_name text,product_title text)
language plpgsql security definer set search_path='' as $$
begin
 if auth.role()<>'service_role' then raise exception 'Forbidden'; end if;
 return query
 with candidates as (
  select d.order_id,d.recipient_name,o.product_title
  from public.bloom_deliveries d
  join public.bloom_orders o on o.id=d.order_id
  where o.status='paid' and not exists
    (select 1 from public.bloom_bridge_announcements a where a.order_id=d.order_id)
  order by o.created_at
  limit 25
 ), reserved as (
  insert into public.bloom_bridge_announcements(order_id)
  select c.order_id from candidates c
  on conflict do nothing
  returning bloom_bridge_announcements.order_id
 )
 select c.order_id,c.recipient_name,c.product_title
 from candidates c join reserved r on r.order_id=c.order_id;
end $$;
revoke all on function public.bloom_bridge_claim_announcements() from public,anon,authenticated;
grant execute on function public.bloom_bridge_claim_announcements() to service_role;
