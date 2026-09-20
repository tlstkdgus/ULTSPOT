-- On-site records a fan chooses to write: check-in, place status, points, spending.
-- This is the first server storage that is not a private per-user draft, so it revises
-- decision C-12 (functional-spec.md §9.1 #3). See docs/specs/on-site-records.md for the
-- permission, consent and deletion contract that evidence-and-execution.md requires.
--
-- Anonymous sign-in makes accounts free to create, so nothing here is unbounded:
--  - one check-in and one status report per user, per place, per day (primary keys)
--  - status is a selection list, never free text, so no unmoderated prose reaches a reader
--  - clients cannot write the point ledger at all; only the functions below can
--  - spending is capped per user by a trigger
--  - no photo or nickname columns: there is no storage, moderation or naming contract yet

-- Reviewed catalog ids only. `personal-` and `custom-` places live in one browser, so a
-- shared record for them would have exactly one member and would leak that user's own list.
create domain public.reviewed_place_id as text check (
  value ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(value) <= 80
  and value not like 'personal-%' and value not like 'custom-%'
);

-- Visiting a place. Kept private to the visitor: a readable history of where somebody was
-- at what time is exactly what F-10 already refuses to put on a share card.
create table public.place_checkins (
  owner_id uuid not null references auth.users(id) on delete cascade,
  place_id public.reviewed_place_id not null,
  visited_on date not null default current_date,
  visited_at timestamptz not null default now(),
  -- A 'gps' row carries the distance the browser measured; a 'manual' row never pretends to.
  source text not null check (source in ('gps', 'manual')),
  distance_m integer check (distance_m between 0 and 100000),
  check ((source = 'gps') = (distance_m is not null)),
  primary key (owner_id, place_id, visited_on)
);
alter table public.place_checkins enable row level security;
revoke all on public.place_checkins from anon;
-- No update: a check-in records a moment. Editing it would make the record meaningless.
grant select, insert, delete on public.place_checkins to authenticated;
create policy "Read own check-ins" on public.place_checkins for select to authenticated using ((select auth.uid()) = owner_id);
create policy "Insert own check-in" on public.place_checkins for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "Delete own check-in" on public.place_checkins for delete to authenticated using ((select auth.uid()) = owner_id);

-- What a place is like right now, as two selection lists (functional-spec.md F-12 scene 3).
-- Other fans read this, so clients never read the table directly: public.place_status_summary
-- returns counts only, which keeps owner_id from becoming a way to follow one person around.
create table public.place_status_reports (
  owner_id uuid not null references auth.users(id) on delete cascade,
  place_id public.reviewed_place_id not null,
  reported_on date not null default current_date,
  reported_at timestamptz not null default now(),
  waiting text not null check (waiting in ('none', 'short', 'medium', 'long')),
  perks text not null check (perks in ('plenty', 'few', 'none', 'unknown')),
  primary key (owner_id, place_id, reported_on)
);
alter table public.place_status_reports enable row level security;
revoke all on public.place_status_reports from anon, authenticated;
-- Write your own row, read nobody's. Reading happens through the summary function.
grant insert, update, delete on public.place_status_reports to authenticated;
create policy "Insert own status report" on public.place_status_reports for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "Update own status report" on public.place_status_reports for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "Delete own status report" on public.place_status_reports for delete to authenticated using ((select auth.uid()) = owner_id);

-- Append-only ledger; a balance is always sum(points). Nothing updates or deletes a row,
-- so a correction is a new row and the history stays readable.
create table public.point_ledger (
  entry_id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (reason in ('checkin', 'status_report', 'unlock')),
  points integer not null check (points between -500 and 500 and points <> 0),
  place_id public.reviewed_place_id not null,
  earned_on date not null default current_date,
  created_at timestamptz not null default now(),
  check ((reason = 'unlock') = (points < 0))
);
-- An award happens once per user, per reason, per place, per day. Deleting a check-in and
-- checking in again cannot pay twice, and editing today's report cannot pay twice.
create unique index point_ledger_one_award_per_day on public.point_ledger (owner_id, reason, place_id, earned_on)
  where reason in ('checkin', 'status_report');
-- Unlocking a place is permanent, so it is charged once ever.
create unique index point_ledger_one_unlock_per_place on public.point_ledger (owner_id, place_id)
  where reason = 'unlock';
alter table public.point_ledger enable row level security;
-- Read-only for clients. Insert is deliberately absent: point values are decided by the
-- security definer functions below, so a browser cannot pay itself.
revoke all on public.point_ledger from anon, authenticated;
grant select on public.point_ledger to authenticated;
create policy "Read own points" on public.point_ledger for select to authenticated using ((select auth.uid()) = owner_id);

-- Spending. Whole won only: the trip is in Seoul, so there is one currency and no rate to
-- get wrong. The column name carries the unit so no caller has to guess.
create table public.expenses (
  expense_id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  place_id public.reviewed_place_id,
  spent_on date not null,
  amount_krw integer not null check (amount_krw between 1 and 100000000),
  label text check (length(label) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index expenses_owner_day on public.expenses (owner_id, spent_on);
alter table public.expenses enable row level security;
revoke all on public.expenses from anon;
grant select, insert, update, delete on public.expenses to authenticated;
create policy "Read own expenses" on public.expenses for select to authenticated using ((select auth.uid()) = owner_id);
create policy "Insert own expense" on public.expenses for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "Update own expense" on public.expenses for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "Delete own expense" on public.expenses for delete to authenticated using ((select auth.uid()) = owner_id);
create trigger expense_updated before update on public.expenses for each row execute function public.touch_guest_trip();

-- The only unbounded table here, so it gets an explicit ceiling per account.
create function public.limit_expense_rows() returns trigger language plpgsql set search_path = '' as $$
begin
  if (select count(*) from public.expenses e where e.owner_id = new.owner_id) >= 2000 then
    raise exception 'This account already has 2000 spending entries. Delete some before adding more.';
  end if;
  return new;
end;
$$;
create trigger expense_row_limit before insert on public.expenses for each row execute function public.limit_expense_rows();

-- Recording a check-in and paying for it happen in one transaction, so the award can never
-- exist without the visit it is for. +10 is functional-spec.md F-12 scene 2; the value lives
-- here rather than in the browser so a client cannot choose its own reward.
create function public.record_checkin(target_place_id text, checkin_source text, measured_distance_m integer default null)
-- The result column is not called visited_on: inside the function that name would be ambiguous
-- with place_checkins.visited_on in the on-conflict target below, and plpgsql refuses to compile.
returns table (checked_in_on date, points_awarded integer, balance integer)
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  awarded integer := 0;
begin
  if uid is null then raise exception 'Sign in before checking in.'; end if;
  insert into public.place_checkins (owner_id, place_id, source, distance_m)
  values (uid, target_place_id, checkin_source, measured_distance_m)
  on conflict (owner_id, place_id, visited_on) do nothing;
  insert into public.point_ledger (owner_id, reason, points, place_id)
  values (uid, 'checkin', 10, target_place_id)
  on conflict do nothing;
  if found then awarded := 10; end if;
  return query select current_date,
    awarded,
    (select coalesce(sum(l.points), 0)::integer from public.point_ledger l where l.owner_id = uid);
end;
$$;

-- +20 for sharing what a place is like (functional-spec.md F-12 scene 3). Updating today's
-- report is allowed and pays nothing extra, so there is no reason to spam edits.
create function public.record_status_report(target_place_id text, waiting_level text, perk_level text)
returns table (points_awarded integer, balance integer)
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  awarded integer := 0;
begin
  if uid is null then raise exception 'Sign in before sharing a place update.'; end if;
  insert into public.place_status_reports (owner_id, place_id, waiting, perks)
  values (uid, target_place_id, waiting_level, perk_level)
  on conflict (owner_id, place_id, reported_on)
    do update set waiting = excluded.waiting, perks = excluded.perks, reported_at = now();
  insert into public.point_ledger (owner_id, reason, points, place_id)
  values (uid, 'status_report', 20, target_place_id)
  on conflict do nothing;
  if found then awarded := 20; end if;
  return query select awarded,
    (select coalesce(sum(l.points), 0)::integer from public.point_ledger l where l.owner_id = uid);
end;
$$;

-- Places you checked in at are open to you because you were there. Other places cost points
-- (product-plan-v0.5.md §5.3). The 30 point price is a product choice recorded in
-- docs/specs/on-site-records.md; no source document sets one.
create function public.unlock_place(target_place_id text) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  cost integer := 30;
  balance integer;
begin
  if uid is null then raise exception 'Sign in before opening another place.'; end if;
  if exists (select 1 from public.place_checkins c where c.owner_id = uid and c.place_id = target_place_id) then
    raise exception 'You checked in here, so this place is already open to you.';
  end if;
  -- Checked before the balance so paying twice reads as "already yours", not "not enough points".
  -- point_ledger_one_unlock_per_place still guarantees it if two calls race.
  if exists (
    select 1 from public.point_ledger l
    where l.owner_id = uid and l.place_id = target_place_id and l.reason = 'unlock'
  ) then
    raise exception 'This place is already open to you.';
  end if;
  select coalesce(sum(l.points), 0)::integer into balance from public.point_ledger l where l.owner_id = uid;
  if balance < cost then raise exception 'You need % more points to open this place.', cost - balance; end if;
  insert into public.point_ledger (owner_id, reason, points, place_id) values (uid, 'unlock', -cost, target_place_id);
  return balance - cost;
end;
$$;

-- Counts only, and only for places open to the caller. A locked place still returns one row
-- so the screen can say it is locked instead of pretending the place has no reports.
-- Reports older than yesterday are not returned: a stale queue length is worse than none.
create function public.place_status_summary(place_ids text[])
returns table (place_id text, open_to_me boolean, waiting text, perks text, reports integer)
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Sign in to read place updates.'; end if;
  if place_ids is null or cardinality(place_ids) < 1 or cardinality(place_ids) > 50 then
    raise exception 'Ask for 1 to 50 places at a time.';
  end if;
  return query
    with asked as (select distinct unnest(place_ids) as pid),
    opened as (
      select a.pid, (
        exists (select 1 from public.place_checkins c where c.owner_id = uid and c.place_id = a.pid)
        or exists (select 1 from public.point_ledger l where l.owner_id = uid and l.place_id = a.pid and l.reason = 'unlock')
      ) as is_open
      from asked a
    )
    select o.pid, o.is_open, r.waiting, r.perks, count(r.owner_id)::integer
    from opened o
    left join public.place_status_reports r
      on o.is_open and r.place_id = o.pid and r.reported_on >= current_date - 1
    group by o.pid, o.is_open, r.waiting, r.perks;
end;
$$;

-- Functions are the only write path for points, so the execute grants are the real permission
-- boundary here. Revoke the implicit public grant before handing them to signed-in users.
revoke all on function public.record_checkin(text, text, integer) from public, anon;
revoke all on function public.record_status_report(text, text, text) from public, anon;
revoke all on function public.unlock_place(text) from public, anon;
revoke all on function public.place_status_summary(text[]) from public, anon;
grant execute on function public.record_checkin(text, text, integer) to authenticated;
grant execute on function public.record_status_report(text, text, text) to authenticated;
grant execute on function public.unlock_place(text) to authenticated;
grant execute on function public.place_status_summary(text[]) to authenticated;
