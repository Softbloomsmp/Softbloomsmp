-- SoftBloomSMP Bloom Shop: administrator archive controls.
-- Run AFTER the original bloom_shop.sql. Existing orders, tickets, and ledger rows are preserved.
alter table public.bloom_tickets add column if not exists archived_at timestamptz;
alter table public.bloom_orders add column if not exists archived_at timestamptz;
create index if not exists bloom_tickets_active_idx on public.bloom_tickets(created_at desc) where archived_at is null;
create index if not exists bloom_orders_active_idx on public.bloom_orders(created_at desc) where archived_at is null;

create or replace function public.bloom_admin_archive(p_kind text,p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare state text;
begin
 if auth.uid() is null or not public.bloom_is_admin() then
  raise exception 'Administrator access required';
 end if;
 if p_kind = 'ticket' then
  select status into state from public.bloom_tickets where id=p_id and archived_at is null for update;
  if not found then raise exception 'Ticket not found or already archived'; end if;
  if state not in ('approved','rejected','closed') then
   raise exception 'Resolve this ticket before archiving it';
  end if;
  update public.bloom_tickets set archived_at=now() where id=p_id;
 elsif p_kind = 'order' then
  select status into state from public.bloom_orders where id=p_id and archived_at is null for update;
  if not found then raise exception 'Order not found or already archived'; end if;
  if state = 'pending' then raise exception 'Pending orders cannot be archived'; end if;
  update public.bloom_orders set archived_at=now() where id=p_id;
 else
  raise exception 'Invalid record type';
 end if;
end $$;
revoke all on function public.bloom_admin_archive(text,uuid) from public;
grant execute on function public.bloom_admin_archive(text,uuid) to authenticated;
