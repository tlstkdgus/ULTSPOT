-- Separate storage prevents older clients overwriting multi-day drafts.
create table public.guest_journeys (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  snapshot jsonb not null check (
    jsonb_typeof(snapshot) = 'object'
    and snapshot @> '{"version":2,"timezone":"Asia/Seoul"}'::jsonb
    and coalesce(jsonb_typeof(snapshot->'days') = 'array', false)
    and octet_length(snapshot::text) <= 65536
  ),
  updated_at timestamptz not null default now()
);
alter table public.guest_journeys enable row level security;
revoke all on public.guest_journeys from anon;
grant select, insert, update, delete on public.guest_journeys to authenticated;
create policy "Read own journey" on public.guest_journeys for select to authenticated using ((select auth.uid()) = owner_id);
create policy "Insert own journey" on public.guest_journeys for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "Update own journey" on public.guest_journeys for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "Delete own journey" on public.guest_journeys for delete to authenticated using ((select auth.uid()) = owner_id);
create trigger guest_journey_updated before update on public.guest_journeys for each row execute function public.touch_guest_trip();
