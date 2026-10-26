-- Run AFTER the existing bloom_shop.sql and archive migrations.
-- Never expose service_role credentials or bridge secrets in browser code.
alter table public.bloom_products add column if not exists stock integer not null default 10 check(stock between 0 and 1000000);
alter table public.bloom_products add column if not exists is_minecraft boolean not null default false;
alter table public.bloom_products add column if not exists reward_commands text[] not null default '{}';
alter table public.bloom_orders add column if not exists recipient_name text;
alter table public.bloom_orders add column if not exists reward_commands text[] not null default '{}';
create table if not exists public.bloom_minecraft_players (
 uuid uuid primary key, player_name text not null, platform text not null check(platform in ('java','bedrock')),
 last_seen timestamptz not null default now()
);
create unique index if not exists bloom_minecraft_players_name on public.bloom_minecraft_players(lower(player_name));
create table if not exists public.bloom_deliveries (
 order_id uuid primary key references public.bloom_orders(id), recipient_uuid uuid not null,
 recipient_name text not null, commands text[] not null,
 status text not null default 'pending' check(status in ('pending','claimed','delivered','failed')),
 claimed_at timestamptz, delivered_at timestamptz, last_error text
);
alter table public.bloom_minecraft_players enable row level security;
alter table public.bloom_deliveries enable row level security;
revoke all on public.bloom_minecraft_players,public.bloom_deliveries from anon,authenticated;

create or replace function public.bloom_bridge_create_product(
 p_title text,p_description text,p_image_url text,p_bcoins bigint,p_gcash numeric,p_active boolean,
 p_stock integer,p_is_minecraft boolean,p_commands text[])
returns uuid language plpgsql security definer set search_path='' as $$
declare v uuid;
begin
 if not public.bloom_is_admin() then raise exception 'Admin only'; end if;
 if p_stock not between 0 and 1000000 then raise exception 'Invalid stock'; end if;
 if p_is_minecraft and (coalesce(array_length(p_commands,1),0) not between 1 and 20 or exists(select 1 from unnest(p_commands) c where length(trim(c)) not between 1 and 300 or c ~ '[\r\n]')) then raise exception 'Invalid reward commands'; end if;
 insert into public.bloom_products(title,description,image_url,price_bcoins,price_gcash,active,stock,is_minecraft,reward_commands)
 values(trim(p_title),coalesce(p_description,''),nullif(p_image_url,''),p_bcoins,p_gcash,p_active,p_stock,p_is_minecraft,case when p_is_minecraft then p_commands else '{}'::text[] end)
 returning id into v;return v;
end $$;
create or replace function public.bloom_bridge_set_product(
 p_id uuid,p_title text,p_description text,p_image_url text,p_bcoins bigint,p_gcash numeric,p_active boolean,
 p_stock integer,p_is_minecraft boolean,p_commands text[])
returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.bloom_is_admin() then raise exception 'Admin only'; end if;
 if p_stock not between 0 and 1000000 then raise exception 'Invalid stock'; end if;
 if p_is_minecraft and (coalesce(array_length(p_commands,1),0) not between 1 and 20 or exists(select 1 from unnest(p_commands) c where length(trim(c)) not between 1 and 300 or c ~ '[\r\n]')) then raise exception 'Invalid reward commands'; end if;
 update public.bloom_products set title=trim(p_title),description=coalesce(p_description,''),image_url=nullif(p_image_url,''),price_bcoins=p_bcoins,price_gcash=p_gcash,active=p_active,stock=p_stock,is_minecraft=p_is_minecraft,reward_commands=case when p_is_minecraft then p_commands else '{}'::text[] end where id=p_id;
 if not found then raise exception 'Product missing'; end if;
end $$;

-- Deliberately resolve recipients only against UUIDs registered by the bridge.
-- If recipient is missing, the transaction rolls back before any funds are deducted.
create or replace function public.bloom_bridge_buy_bcoins(p_product uuid,p_recipient_name text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare p public.bloom_products%rowtype; o uuid; v_uuid uuid;
begin
 if auth.uid() is null then raise exception 'Sign in required';end if;
 select * into p from public.bloom_products where id=p_product and active and stock>0 for update;
 if not found then raise exception 'Product sold out or unavailable';end if;
 if p.is_minecraft then
  select uuid into v_uuid from public.bloom_minecraft_players where lower(player_name)=lower(trim(p_recipient_name));
  if v_uuid is null then raise exception 'Minecraft player not found. Join the server once before purchasing.';end if;
 end if;
 insert into public.bloom_wallets(user_id) values(auth.uid()) on conflict do nothing;
 update public.bloom_wallets set balance=balance-p.price_bcoins,updated_at=now() where user_id=auth.uid() and balance>=p.price_bcoins;
 if not found then raise exception 'Insufficient BCoins';end if;
 update public.bloom_products set stock=stock-1 where id=p.id;
 insert into public.bloom_orders(user_id,product_id,product_title,payment_method,amount_bcoins,status,recipient_name,reward_commands)
 values(auth.uid(),p.id,p.title,'bcoins',p.price_bcoins,'paid',case when p.is_minecraft then trim(p_recipient_name) end,p.reward_commands) returning id into o;
 insert into public.bloom_wallet_ledger(user_id,delta,reason,order_id) values(auth.uid(),-p.price_bcoins,'shop_purchase',o);
 if p.is_minecraft then insert into public.bloom_deliveries(order_id,recipient_uuid,recipient_name,commands)
 values(o,v_uuid,trim(p_recipient_name),p.reward_commands);end if;
 return o;
end $$;

create or replace function public.bloom_bridge_open_gcash_ticket(p_kind text,p_product uuid,p_reference text default null,p_details text default '',p_recipient_name text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare p public.bloom_products%rowtype;t uuid;o uuid;v_uuid uuid;
begin
 if auth.uid() is null or p_kind<>'gcash_purchase' then raise exception 'Invalid purchase';end if;
 select * into p from public.bloom_products where id=p_product and active and stock>0 for update;
 if not found then raise exception 'Product sold out or unavailable';end if;
 if p.is_minecraft then
  select uuid into v_uuid from public.bloom_minecraft_players where lower(player_name)=lower(trim(p_recipient_name));
  if v_uuid is null then raise exception 'Minecraft player not found. Join the server once before purchasing.';end if;
 end if;
 update public.bloom_products set stock=stock-1 where id=p.id;
 insert into public.bloom_tickets(user_id,kind,product_id,amount_php,reference,details)
 values(auth.uid(),'gcash_purchase',p.id,p.price_gcash,left(p_reference,120),left(coalesce(p_details,''),2000)) returning id into t;
 insert into public.bloom_orders(user_id,product_id,product_title,payment_method,amount_php,status,ticket_id,recipient_name,reward_commands)
 values(auth.uid(),p.id,p.title,'gcash',p.price_gcash,'pending',t,case when p.is_minecraft then trim(p_recipient_name) end,p.reward_commands) returning id into o;
 if p.is_minecraft then insert into public.bloom_deliveries(order_id,recipient_uuid,recipient_name,commands)
 values(o,v_uuid,trim(p_recipient_name),p.reward_commands);end if;
 return t;
end $$;
-- Restore reserved stock when an admin rejects a GCash order.
create or replace function public.bloom_bridge_restore_stock() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.status='pending' and new.status='cancelled' then
  update public.bloom_products set stock=stock+1 where id=new.product_id;
 end if;
 return new;
end $$;
drop trigger if exists bloom_bridge_stock_restore on public.bloom_orders;
create trigger bloom_bridge_stock_restore after update of status on public.bloom_orders for each row execute function public.bloom_bridge_restore_stock();

-- Server-only RPCs: callable only with a Supabase service_role JWT.
create or replace function public.bloom_bridge_register_player(p_uuid uuid,p_name text,p_platform text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.role()<>'service_role' then raise exception 'Forbidden';end if;
 if p_name is null or length(p_name) not between 1 and 32 or p_platform not in ('java','bedrock') then raise exception 'Invalid player';end if;
 insert into public.bloom_minecraft_players(uuid,player_name,platform,last_seen)
 values(p_uuid,p_name,p_platform,now())
 on conflict(uuid) do update set player_name=excluded.player_name,platform=excluded.platform,last_seen=now();
end $$;
create or replace function public.bloom_bridge_claim_delivery()
returns table(order_id uuid,recipient_uuid uuid,recipient_name text,commands text[])
language plpgsql security definer set search_path='' as $$
begin
 if auth.role()<>'service_role' then raise exception 'Forbidden';end if;
 return query
 with claimed as (
  select d.order_id from public.bloom_deliveries d join public.bloom_orders o on o.id=d.order_id
  where d.status='pending' and o.status='paid' order by o.created_at for update of d skip locked limit 1
 )
 update public.bloom_deliveries d set status='claimed',claimed_at=now()
 from claimed c where d.order_id=c.order_id
 returning d.order_id,d.recipient_uuid,d.recipient_name,d.commands;
end $$;
create or replace function public.bloom_bridge_finish_delivery(p_order uuid,p_success boolean,p_error text default null)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.role()<>'service_role' then raise exception 'Forbidden';end if;
 update public.bloom_deliveries set status=case when p_success then 'delivered' else 'failed' end,
 delivered_at=case when p_success then now() end,last_error=left(p_error,500)
 where order_id=p_order and status='claimed';
 if not p_success and p_error='Recipient offline at delivery time' then
  update public.bloom_deliveries set status='pending',claimed_at=null where order_id=p_order;
 end if;
 if p_success then update public.bloom_orders set status='fulfilled' where id=p_order and status='paid';end if;
end $$;
revoke all on function public.bloom_bridge_create_product(text,text,text,bigint,numeric,boolean,integer,boolean,text[]),public.bloom_bridge_set_product(uuid,text,text,text,bigint,numeric,boolean,integer,boolean,text[]),public.bloom_bridge_buy_bcoins(uuid,text),public.bloom_bridge_open_gcash_ticket(text,uuid,text,text,text) from public;
grant execute on function public.bloom_bridge_create_product(text,text,text,bigint,numeric,boolean,integer,boolean,text[]),public.bloom_bridge_set_product(uuid,text,text,text,bigint,numeric,boolean,integer,boolean,text[]),public.bloom_bridge_buy_bcoins(uuid,text),public.bloom_bridge_open_gcash_ticket(text,uuid,text,text,text) to authenticated;
revoke all on function public.bloom_bridge_register_player(uuid,text,text),public.bloom_bridge_claim_delivery(),public.bloom_bridge_finish_delivery(uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.bloom_bridge_register_player(uuid,text,text),public.bloom_bridge_claim_delivery(),public.bloom_bridge_finish_delivery(uuid,boolean,text) to service_role;
