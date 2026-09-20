-- One private draft per guest. Anonymous sign-in users are authenticated users;
-- the public anon role has no access. Never expose service_role to the browser.
create table public.guest_trips (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  snapshot jsonb not null check (
    jsonb_typeof(snapshot) = 'object' and snapshot @> '{"version":1}'::jsonb
    and octet_length(snapshot::text) <= 65536
  ),
  updated_at timestamptz not null default now()
);
alter table public.guest_trips enable row level security;
revoke all on public.guest_trips from anon;
grant select, insert, update, delete on public.guest_trips to authenticated;
create policy "Guests read own draft" on public.guest_trips for select to authenticated using ((select auth.uid()) = owner_id);
create policy "Guests create own draft" on public.guest_trips for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "Guests update own draft" on public.guest_trips for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "Guests delete own draft" on public.guest_trips for delete to authenticated using ((select auth.uid()) = owner_id);
create function public.touch_guest_trip() returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger guest_trip_updated before update on public.guest_trips for each row execute function public.touch_guest_trip();
