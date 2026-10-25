-- Run AFTER bloom_shop.sql. Product removal is an admin-only archive.
-- Past orders, tickets, and wallet ledger references remain intact.
alter table public.bloom_products add column if not exists archived_at timestamptz;
create index if not exists bloom_products_visible_idx on public.bloom_products(created_at desc) where archived_at is null;

-- Prevent regular customers from seeing archived products in direct API queries.
drop policy if exists bloom_products_read on public.bloom_products;
create policy bloom_products_read on public.bloom_products
for select to authenticated
using (archived_at is null and (active or public.bloom_is_admin()));

create or replace function public.bloom_admin_archive_product(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null or not public.bloom_is_admin() then
  raise exception 'Administrator access required';
 end if;
 update public.bloom_products set archived_at = now(), active = false
 where id = p_id and archived_at is null;
 if not found then raise exception 'Product not found or already deleted'; end if;
end $$;
revoke all on function public.bloom_admin_archive_product(uuid) from public;
grant execute on function public.bloom_admin_archive_product(uuid) to authenticated;

-- Reject new purchases for archived products, including stale tabs.
-- Original purchase functions already check active=true; archive forces active=false.
