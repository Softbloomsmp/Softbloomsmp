-- SoftBloomBridge v0.0.1 stash/reward-type migration. Run after softbloom_bridge_v001.sql.
-- Stash stores immutable reward-command vouchers, NOT serialized physical ItemStacks.
-- Only trusted admins should define reward commands. Test on staging first.
alter table public.bloom_products add column if not exists reward_type text check (reward_type in ('item','non_item'));
alter table public.bloom_orders add column if not exists reward_type text check (reward_type in ('item','non_item'));
alter table public.bloom_deliveries add column if not exists reward_type text not null default 'non_item' check(reward_type in ('item','non_item'));

-- Remove old RPC overloads so clients cannot bypass the new reward-type parameter.
drop function if exists public.bloom_bridge_create_product(text,text,text,bigint,numeric,boolean,integer,boolean,text[]);
drop function if exists public.bloom_bridge_set_product(uuid,text,text,text,bigint,numeric,boolean,integer,boolean,text[]);
create function public.bloom_bridge_create_product(
 p_title text,p_description text,p_image_url text,p_bcoins bigint,p_gcash numeric,p_active boolean,
 p_stock integer,p_is_minecraft boolean,p_commands text[],p_reward_type text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v uuid;
begin
 if not public.bloom_is_admin() then raise exception 'Admin only'; end if;
 if p_stock not between 0 and 1000000 then raise exception 'Invalid stock'; end if;
 if p_is_minecraft and (p_reward_type is null or p_reward_type not in ('item','non_item') or coalesce(array_length(p_commands,1),0) not between 1 and 20 or exists(select 1 from unnest(p_commands) c where length(trim(c)) not between 1 and 300 or c ~ '[\r\n]')) then raise exception 'Invalid reward configuration'; end if;
 insert into public.bloom_products(title,description,image_url,price_bcoins,price_gcash,active,stock,is_minecraft,reward_commands,reward_type)
 values(trim(p_title),coalesce(p_description,''),nullif(p_image_url,''),p_bcoins,p_gcash,p_active,p_stock,p_is_minecraft,case when p_is_minecraft then p_commands else '{}'::text[] end,case when p_is_minecraft then p_reward_type end)
 returning id into v;return v;
end $$;
create function public.bloom_bridge_set_product(
 p_id uuid,p_title text,p_description text,p_image_url text,p_bcoins bigint,p_gcash numeric,p_active boolean,
 p_stock integer,p_is_minecraft boolean,p_commands text[],p_reward_type text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.bloom_is_admin() then raise exception 'Admin only'; end if;
 if p_stock not between 0 and 1000000 then raise exception 'Invalid stock'; end if;
 if p_is_minecraft and (p_reward_type is null or p_reward_type not in ('item','non_item') or coalesce(array_length(p_commands,1),0) not between 1 and 20 or exists(select 1 from unnest(p_commands) c where length(trim(c)) not between 1 and 300 or c ~ '[\r\n]')) then raise exception 'Invalid reward configuration'; end if;
 update public.bloom_products set title=trim(p_title),description=coalesce(p_description,''),image_url=nullif(p_image_url,''),price_bcoins=p_bcoins,price_gcash=p_gcash,active=p_active,stock=p_stock,is_minecraft=p_is_minecraft,reward_commands=case when p_is_minecraft then p_commands else '{}'::text[] end,reward_type=case when p_is_minecraft then p_reward_type end where id=p_id;
 if not found then raise exception 'Product missing'; end if;
end $$;

-- Snapshot reward type at checkout so later product edits do not affect orders.
create or replace function public.bloom_bridge_buy_bcoins(p_product uuid,p_recipient_name text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare p public.bloom_products%rowtype; o uuid; v_uuid uuid;
begin
 if auth.uid() is null then raise exception 'Sign in required';end if;
 select * into p from public.bloom_products where id=p_product and active and stock>0 for update;
 if not found then raise exception 'Product sold out or unavailable';end if;
 if p.is_minecraft then
  select uuid into v_uuid from public.bloom_minecraft_players where lower(player_name)=lower(trim(p_recipient_name));
  if v_uuid is null then raise exception 'Minecraft player not found. The server must register this player first.';end if;
 end if;
 insert into public.bloom_wallets(user_id) values(auth.uid()) on conflict do nothing;
 update public.bloom_wallets set balance=balance-p.price_bcoins,updated_at=now() where user_id=auth.uid() and balance>=p.price_bcoins;
 if not found then raise exception 'Insufficient BCoins';end if;
 update public.bloom_products set stock=stock-1 where id=p.id;
 insert into public.bloom_orders(user_id,product_id,product_title,payment_method,amount_bcoins,status,recipient_name,reward_commands,reward_type)
 values(auth.uid(),p.id,p.title,'bcoins',p.price_bcoins,'paid',case when p.is_minecraft then trim(p_recipient_name) end,p.reward_commands,p.reward_type) returning id into o;
 insert into public.bloom_wallet_ledger(user_id,delta,reason,order_id) values(auth.uid(),-p.price_bcoins,'shop_purchase',o);
 if p.is_minecraft then insert into public.bloom_deliveries(order_id,recipient_uuid,recipient_name,commands,reward_type)
 values(o,v_uuid,trim(p_recipient_name),p.reward_commands,coalesce(p.reward_type,'non_item'));end if;
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
  if v_uuid is null then raise exception 'Minecraft player not found. The server must register this player first.';end if;
 end if;
 update public.bloom_products set stock=stock-1 where id=p.id;
 insert into public.bloom_tickets(user_id,kind,product_id,amount_php,reference,details)
 values(auth.uid(),'gcash_purchase',p.id,p.price_gcash,left(p_reference,120),left(coalesce(p_details,''),2000)) returning id into t;
 insert into public.bloom_orders(user_id,product_id,product_title,payment_method,amount_php,status,ticket_id,recipient_name,reward_commands,reward_type)
 values(auth.uid(),p.id,p.title,'gcash',p.price_gcash,'pending',t,case when p.is_minecraft then trim(p_recipient_name) end,p.reward_commands,p.reward_type) returning id into o;
 if p.is_minecraft then insert into public.bloom_deliveries(order_id,recipient_uuid,recipient_name,commands,reward_type)
 values(o,v_uuid,trim(p_recipient_name),p.reward_commands,coalesce(p.reward_type,'non_item'));end if;
 return t;
end $$;

-- Stash vouchers are shown only when paid, unclaimed, and assigned to this UUID.
create or replace function public.bloom_bridge_list_stash(p_uuid uuid)
returns table(order_id uuid,product_title text)
language plpgsql security definer set search_path='' as $$
begin
 if auth.role()<>'service_role' then raise exception 'Forbidden';end if;
 return query select d.order_id,o.product_title from public.bloom_deliveries d join public.bloom_orders o on o.id=d.order_id
 where d.recipient_uuid=p_uuid and d.reward_type='item' and d.status='pending' and o.status='paid' order by o.created_at limit 100;
end $$;
-- Atomic reservation of a stash voucher. If the server crashes AFTER this reservation but BEFORE
-- executing commands, admins must reconcile the claimed entry; this is deliberately NOT retried.
create or replace function public.bloom_bridge_claim_stash(p_uuid uuid,p_order uuid)
returns table(order_id uuid,commands text[],recipient_name text)
language plpgsql security definer set search_path='' as $$
begin
 if auth.role()<>'service_role' then raise exception 'Forbidden';end if;
 return query update public.bloom_deliveries d set status='claimed',claimed_at=now()
 from public.bloom_orders o where d.order_id=p_order and o.id=d.order_id and o.status='paid'
 and d.recipient_uuid=p_uuid and d.reward_type='item' and d.status='pending'
 returning d.order_id,d.commands,d.recipient_name;
end $$;
-- Automatic polling must NEVER consume stash vouchers.
create or replace function public.bloom_bridge_claim_delivery()
returns table(order_id uuid,recipient_uuid uuid,recipient_name text,commands text[])
language plpgsql security definer set search_path='' as $$
begin
 if auth.role()<>'service_role' then raise exception 'Forbidden';end if;
 return query with claimed as (
  select d.order_id from public.bloom_deliveries d join public.bloom_orders o on o.id=d.order_id
  where d.status='pending' and d.reward_type='non_item' and o.status='paid' order by o.created_at
  for update of d skip locked limit 1
 ) update public.bloom_deliveries d set status='claimed',claimed_at=now()
 from claimed c where d.order_id=c.order_id returning d.order_id,d.recipient_uuid,d.recipient_name,d.commands;
end $$;
revoke all on function public.bloom_bridge_create_product(text,text,text,bigint,numeric,boolean,integer,boolean,text[],text),public.bloom_bridge_set_product(uuid,text,text,text,bigint,numeric,boolean,integer,boolean,text[],text),public.bloom_bridge_list_stash(uuid),public.bloom_bridge_claim_stash(uuid,uuid) from public,anon,authenticated;
grant execute on function public.bloom_bridge_create_product(text,text,text,bigint,numeric,boolean,integer,boolean,text[],text),public.bloom_bridge_set_product(uuid,text,text,text,bigint,numeric,boolean,integer,boolean,text[],text) to authenticated;
grant execute on function public.bloom_bridge_list_stash(uuid),public.bloom_bridge_claim_stash(uuid,uuid) to service_role;
