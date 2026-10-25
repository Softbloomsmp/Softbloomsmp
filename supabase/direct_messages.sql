-- Run once in Supabase SQL Editor. Only conversation participants can read messages.
create table if not exists public.direct_messages (
 id uuid primary key default gen_random_uuid(),
 sender_id uuid not null references public.profiles(id) on delete cascade,
 recipient_id uuid not null references public.profiles(id) on delete cascade,
 body text not null check (char_length(btrim(body)) between 1 and 2000),
 created_at timestamptz not null default now(),
 constraint dm_no_self check (sender_id <> recipient_id)
);
create index if not exists dm_sender_time on public.direct_messages(sender_id,created_at desc);
create index if not exists dm_recipient_time on public.direct_messages(recipient_id,created_at desc);
alter table public.direct_messages enable row level security;
drop policy if exists dm_read on public.direct_messages;
create policy dm_read on public.direct_messages for select to authenticated using (sender_id=(select auth.uid()) or recipient_id=(select auth.uid()));
drop policy if exists dm_send on public.direct_messages;
create policy dm_send on public.direct_messages for insert to authenticated with check (sender_id=(select auth.uid()) and recipient_id<>(select auth.uid()));
revoke all on public.direct_messages from anon;
revoke all on public.direct_messages from authenticated;
grant select,insert on public.direct_messages to authenticated;
