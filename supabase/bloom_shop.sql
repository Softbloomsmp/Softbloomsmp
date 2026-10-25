-- SoftBloomSMP Bloom Shop v1. Run once in Supabase SQL Editor.
-- Replace YOUR_AUTH_USER_UUID below ONLY in the final INSERT after locating your UUID in Authentication > Users.
create table if not exists public.bloom_admins (user_id uuid primary key references auth.users(id) on delete cascade);
create or replace function public.bloom_is_admin() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.bloom_admins where user_id=auth.uid()) $$;
revoke all on function public.bloom_is_admin() from public;
grant execute on function public.bloom_is_admin() to authenticated;
create table if not exists public.bloom_products (
 id uuid primary key default gen_random_uuid(), title text not null check(length(title) between 1 and 100),
 description text not null default '', image_url text, price_bcoins bigint not null check(price_bcoins>0),
 price_gcash numeric(12,2) not null check(price_gcash>0), active boolean not null default true,
 created_at timestamptz not null default now()
);
create table if not exists public.bloom_wallets (
 user_id uuid primary key references auth.users(id) on delete cascade,
 balance bigint not null default 0 check(balance>=0), updated_at timestamptz not null default now()
);
create table if not exists public.bloom_tickets (
 id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id),
 kind text not null check(kind in ('topup','gcash_purchase')),
 product_id uuid references public.bloom_products(id), requested_bcoins bigint check(requested_bcoins>0),
 amount_php numeric(12,2) check(amount_php>0), reference text, details text not null default '',
 status text not null default 'open' check(status in ('open','awaiting_payment','approved','rejected','closed')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check ((kind='topup' and requested_bcoins is not null and product_id is null) or (kind='gcash_purchase' and product_id is not null and requested_bcoins is null))
);
create table if not exists public.bloom_ticket_messages (
 id uuid primary key default gen_random_uuid(), ticket_id uuid not null references public.bloom_tickets(id) on delete cascade,
 sender_id uuid not null default auth.uid() references auth.users(id), body text not null check(length(body) between 1 and 3000),
 created_at timestamptz not null default now()
);
create table if not exists public.bloom_orders (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
 product_id uuid not null references public.bloom_products(id), product_title text not null,
 payment_method text not null check(payment_method in ('bcoins','gcash')),
 amount_bcoins bigint, amount_php numeric(12,2),
 status text not null default 'paid' check(status in ('paid','pending','fulfilled','cancelled')),
 ticket_id uuid unique references public.bloom_tickets(id), created_at timestamptz not null default now()
);
create table if not exists public.bloom_wallet_ledger (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
 delta bigint not null, reason text not null, ticket_id uuid unique references public.bloom_tickets(id),
 order_id uuid unique references public.bloom_orders(id), created_at timestamptz not null default now()
);
-- All tables RLS-enabled. Clients may never directly modify wallets, orders, tickets, or products.
alter table public.bloom_admins enable row level security;
alter table public.bloom_products enable row level security;
alter table public.bloom_wallets enable row level security;
alter table public.bloom_tickets enable row level security;
alter table public.bloom_ticket_messages enable row level security;
alter table public.bloom_orders enable row level security;
alter table public.bloom_wallet_ledger enable row level security;
create policy bloom_admin_self on public.bloom_admins for select to authenticated using(user_id=auth.uid());
create policy bloom_products_read on public.bloom_products for select to authenticated using(active or public.bloom_is_admin());
create policy bloom_wallet_read on public.bloom_wallets for select to authenticated using(user_id=auth.uid() or public.bloom_is_admin());
create policy bloom_ticket_read on public.bloom_tickets for select to authenticated using(user_id=auth.uid() or public.bloom_is_admin());
create policy bloom_message_read on public.bloom_ticket_messages for select to authenticated using(exists(select 1 from public.bloom_tickets t where t.id=ticket_id and (t.user_id=auth.uid() or public.bloom_is_admin())));
create policy bloom_order_read on public.bloom_orders for select to authenticated using(user_id=auth.uid() or public.bloom_is_admin());
create policy bloom_ledger_read on public.bloom_wallet_ledger for select to authenticated using(user_id=auth.uid() or public.bloom_is_admin());
revoke all on public.bloom_admins,public.bloom_products,public.bloom_wallets,public.bloom_tickets,public.bloom_ticket_messages,public.bloom_orders,public.bloom_wallet_ledger from anon,authenticated;
grant select on public.bloom_admins,public.bloom_products,public.bloom_wallets,public.bloom_tickets,public.bloom_ticket_messages,public.bloom_orders,public.bloom_wallet_ledger to authenticated;
-- Server-authorized RPC functions; authenticated users can only execute allowed operations.
create or replace function public.bloom_create_product(p_title text,p_description text,p_image_url text,p_bcoins bigint,p_gcash numeric,p_active boolean default true)
returns uuid language plpgsql security definer set search_path='' as $$ declare v uuid; begin
 if not public.bloom_is_admin() then raise exception 'Admin only'; end if;
 insert into public.bloom_products(title,description,image_url,price_bcoins,price_gcash,active) values(trim(p_title),coalesce(p_description,''),nullif(p_image_url,''),p_bcoins,p_gcash,p_active) returning id into v;return v;end $$;
create or replace function public.bloom_set_product(p_id uuid,p_title text,p_description text,p_image_url text,p_bcoins bigint,p_gcash numeric,p_active boolean)
returns void language plpgsql security definer set search_path='' as $$ begin
 if not public.bloom_is_admin() then raise exception 'Admin only';end if;
 update public.bloom_products set title=trim(p_title),description=coalesce(p_description,''),image_url=nullif(p_image_url,''),price_bcoins=p_bcoins,price_gcash=p_gcash,active=p_active where id=p_id;
 if not found then raise exception 'Product not found';end if;end $$;
create or replace function public.bloom_open_ticket(p_kind text,p_product uuid default null,p_bcoins bigint default null,p_reference text default null,p_details text default '')
returns uuid language plpgsql security definer set search_path='' as $$ declare v uuid; amount numeric; begin
 if auth.uid() is null then raise exception 'Sign in required';end if;
 if p_kind='gcash_purchase' then
  select price_gcash into amount from public.bloom_products where id=p_product and active=true;
  if amount is null then raise exception 'Product unavailable';end if;
 elsif p_kind='topup' then
  if p_product is not null or p_bcoins is null or p_bcoins<=0 or p_bcoins>100000000 then raise exception 'Invalid top-up amount';end if;
 else raise exception 'Invalid ticket type';end if;
 insert into public.bloom_tickets(user_id,kind,product_id,requested_bcoins,amount_php,reference,details)
 values(auth.uid(),p_kind,p_product,p_bcoins,amount,left(p_reference,120),left(coalesce(p_details,''),2000)) returning id into v;
 if p_kind='gcash_purchase' then
  insert into public.bloom_orders(user_id,product_id,product_title,payment_method,amount_php,status,ticket_id)
  select auth.uid(),id,title,'gcash',amount,'pending',v from public.bloom_products where id=p_product;
 end if;
 return v;end $$;
create or replace function public.bloom_send_ticket_message(p_ticket uuid,p_body text)
returns void language plpgsql security definer set search_path='' as $$ declare owner_id uuid;state text; begin
 select user_id,status into owner_id,state from public.bloom_tickets where id=p_ticket;
 if owner_id is null or (owner_id<>auth.uid() and not public.bloom_is_admin()) then raise exception 'Not allowed';end if;
 if state in ('approved','rejected','closed') then raise exception 'Ticket is closed';end if;
 insert into public.bloom_ticket_messages(ticket_id,sender_id,body) values(p_ticket,auth.uid(),trim(p_body));end $$;
create or replace function public.bloom_buy_bcoins(p_product uuid)
returns uuid language plpgsql security definer set search_path='' as $$ declare price bigint;title text;order_id uuid;newbalance bigint; begin
 if auth.uid() is null then raise exception 'Sign in required';end if;
 select price_bcoins,title into price,title from public.bloom_products where id=p_product and active=true;
 if price is null then raise exception 'Product unavailable';end if;
 insert into public.bloom_wallets(user_id) values(auth.uid()) on conflict do nothing;
 update public.bloom_wallets set balance=balance-price,updated_at=now() where user_id=auth.uid() and balance>=price returning balance into newbalance;
 if not found then raise exception 'Insufficient BCoins';end if;
 insert into public.bloom_orders(user_id,product_id,product_title,payment_method,amount_bcoins,status) values(auth.uid(),p_product,title,'bcoins',price,'paid') returning id into order_id;
 insert into public.bloom_wallet_ledger(user_id,delta,reason,order_id) values(auth.uid(),-price,'shop_purchase',order_id);
 return order_id;end $$;
create or replace function public.bloom_admin_resolve(p_ticket uuid,p_action text)
returns void language plpgsql security definer set search_path='' as $$ declare t public.bloom_tickets%rowtype;begin
 if not public.bloom_is_admin() then raise exception 'Admin only';end if;
 select * into t from public.bloom_tickets where id=p_ticket for update;
 if not found then raise exception 'Ticket missing';end if;
 if t.status in ('approved','rejected','closed') then raise exception 'Ticket already finalized';end if;
 if p_action='approve' then
  if t.kind='topup' then
   insert into public.bloom_wallets(user_id,balance) values(t.user_id,t.requested_bcoins)
   on conflict(user_id) do update set balance=public.bloom_wallets.balance+excluded.balance,updated_at=now();
   insert into public.bloom_wallet_ledger(user_id,delta,reason,ticket_id) values(t.user_id,t.requested_bcoins,'approved_topup',t.id);
  else update public.bloom_orders set status='paid' where ticket_id=t.id;end if;
  update public.bloom_tickets set status='approved',updated_at=now() where id=t.id;
 elsif p_action='reject' then
  update public.bloom_tickets set status='rejected',updated_at=now() where id=t.id;
  update public.bloom_orders set status='cancelled' where ticket_id=t.id;
 elsif p_action='awaiting_payment' then
  update public.bloom_tickets set status='awaiting_payment',updated_at=now() where id=t.id;
 else raise exception 'Invalid action';end if;end $$;
revoke all on function public.bloom_create_product(text,text,text,bigint,numeric,boolean),public.bloom_set_product(uuid,text,text,text,bigint,numeric,boolean),public.bloom_open_ticket(text,uuid,bigint,text,text),public.bloom_send_ticket_message(uuid,text),public.bloom_buy_bcoins(uuid),public.bloom_admin_resolve(uuid,text) from public;
grant execute on function public.bloom_create_product(text,text,text,bigint,numeric,boolean),public.bloom_set_product(uuid,text,text,text,bigint,numeric,boolean),public.bloom_open_ticket(text,uuid,bigint,text,text),public.bloom_send_ticket_message(uuid,text),public.bloom_buy_bcoins(uuid),public.bloom_admin_resolve(uuid,text) to authenticated;
-- AFTER running the script, assign your first admin in a separate query:
-- INSERT INTO public.bloom_admins(user_id) VALUES ('YOUR_AUTH_USER_UUID');
