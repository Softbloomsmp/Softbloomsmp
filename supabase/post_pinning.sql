-- SoftBloomSMP: administrator-only post pinning. Run once in Supabase SQL Editor.
-- Existing Bloom Shop admin roles (public.bloom_admins) are reused.
alter table public.posts add column if not exists is_pinned boolean not null default false;
create index if not exists posts_pinned_recent_idx on public.posts(is_pinned desc,created_at desc);

-- Prevent non-admin users from changing the pinned flag through direct PostgREST updates.
create or replace function public.guard_post_pin() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.is_pinned is distinct from old.is_pinned
    and not exists(select 1 from public.bloom_admins where user_id=auth.uid()) then
  raise exception 'Only Bloom administrators may pin posts';
 end if;
 return new;
end $$;
drop trigger if exists guard_post_pin_trigger on public.posts;
create trigger guard_post_pin_trigger before update on public.posts
for each row execute function public.guard_post_pin();

-- Admins can pin any member's post, without receiving broad post-edit privileges.
create or replace function public.bloom_set_post_pin(p_post_id uuid,p_pinned boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.bloom_admins where user_id=auth.uid()) then
  raise exception 'Administrator permission required';
 end if;
 update public.posts set is_pinned=p_pinned where id=p_post_id;
 if not found then raise exception 'Post not found';end if;
end $$;
revoke all on function public.bloom_set_post_pin(uuid,boolean) from public,anon;
grant execute on function public.bloom_set_post_pin(uuid,boolean) to authenticated;
