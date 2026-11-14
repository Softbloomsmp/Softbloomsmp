begin;
alter table public.profile_photos add column if not exists position_x integer not null default 50 check (position_x between 0 and 100);
alter table public.profile_photos add column if not exists position_y integer not null default 50 check (position_y between 0 and 100);
create or replace function public.set_profile_cover_position(p_id uuid,p_x integer,p_y integer) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or p_x is null or p_y is null or p_x not between 0 and 100 or p_y not between 0 and 100 then raise exception 'Invalid cover position'; end if;
 update public.profile_photos set position_x=p_x,position_y=p_y where id=p_id and user_id=auth.uid() and kind='cover';
 if not found then raise exception 'Cover photo not found'; end if;
end $$;
revoke execute on function public.set_profile_cover_position(uuid,integer,integer) from public,anon;
grant execute on function public.set_profile_cover_position(uuid,integer,integer) to authenticated;
commit;
