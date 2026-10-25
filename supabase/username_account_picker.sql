-- SoftBloomSMP username uniqueness + admin username lookup.
-- Run once AFTER the previous Bloom Shop and admin controls SQL.
-- Case-insensitive uniqueness: Testuser and testuser are the same name.
-- First identify any existing duplicates before applying:
-- SELECT lower(username), array_agg(id) FROM public.profiles
-- GROUP BY lower(username) HAVING count(*) > 1;
-- Rename duplicates through your approved administrative process before proceeding.
create unique index if not exists profiles_username_case_insensitive_unique
 on public.profiles (lower(username));

-- A normal user can release their old username by changing it.
-- Existing 7-day username change cooldown remains in force.
-- Secure lookup: only Bloom Shop admins can search usernames.
create or replace function public.bloom_admin_find_players(p_query text)
returns table(id uuid,username text,avatar_url text)
language plpgsql stable security definer set search_path=''
as $$
begin
 if not public.bloom_is_admin() then raise exception 'Admin only';end if;
 if length(trim(coalesce(p_query,'')))<2 then return;end if;
 return query
 select p.id,p.username,p.avatar_url
 from public.profiles p
 where p.username ilike '%' || replace(replace(replace(trim(p_query),'\\','\\\\'),'%','\\%'),'_','\\_') || '%' escape '\'
 order by case when lower(p.username)=lower(trim(p_query)) then 0 else 1 end,
          p.username
 limit 8;
end $$;
revoke all on function public.bloom_admin_find_players(text) from public;
grant execute on function public.bloom_admin_find_players(text) to authenticated;

-- IMPORTANT: earlier starter schema enforces a fixed 5-post cap in guard_post.
-- Replace it with the admin-configurable cap introduced by bloom_ticket_admin_controls.sql.
-- Preserve original immutable ownership and update timestamps.
create or replace function public.guard_post()
returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='INSERT' then
  new.created_at:=now();new.updated_at:=now();
 else
  if new.user_id<>old.user_id or new.created_at<>old.created_at then
   raise exception 'Post ownership is immutable';
  end if;
  new.updated_at:=now();
 end if;
 return new;
end $$;
-- bloom_posts_limit_guard handles insert caps, including concurrent posts.
