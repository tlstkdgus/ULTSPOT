-- Two fixes found by running 202609200002 against the hosted project (T-043).
-- Both are changes to existing objects; no table is created, dropped or emptied here.

-- 1. Place ids are not all lowercase.
--
-- The original domain allowed `^[a-z0-9]+(-[a-z0-9]+)*$`. Every reviewed landmark matched,
-- so the constraint looked right until the fan birthday cafes arrived with ids like
-- `BC-SEUNGMIN-AUTUMN-BREAK` (PR #48). Those are exactly the places where queue length and
-- gift stock matter most, and they were the only ones that could not be reported on.
--
-- The `personal-`/`custom-` block is the part that actually protects anything: those ids
-- live in one browser, so a shared record for them would have one member and would leak
-- that user's own list. It now compares case-insensitively so `PERSONAL-x` cannot walk past it.
do $$
declare constraint_name text;
begin
  select conname into constraint_name
  from pg_constraint
  where contypid = 'public.reviewed_place_id'::regtype and contype = 'c'
  limit 1;
  if constraint_name is not null then
    execute format('alter domain public.reviewed_place_id drop constraint %I', constraint_name);
  end if;
end $$;

alter domain public.reviewed_place_id add constraint reviewed_place_id_check check (
  value ~ '^[A-Za-z0-9]+(-[A-Za-z0-9]+)*$' and length(value) <= 80
  and lower(value) not like 'personal-%' and lower(value) not like 'custom-%'
);

-- 2. Sharing an update did not open the place you shared it about.
--
-- Opening was granted by a check-in or a 30 point unlock only. But a check-in is `manual`
-- and unverified — one button press — while a status report is the harder contribution,
-- because you have to be standing there to know the queue. So the cheaper act opened the
-- place and the more expensive one did not, and the screen showed no change after +20.
--
-- Reporting is now a third way in. It does not weaken the rule that you cannot read other
-- fans' reports for a place you have no connection to; it just counts a real contribution.
create or replace function public.place_status_summary(place_ids text[])
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
        or exists (select 1 from public.place_status_reports r2 where r2.owner_id = uid and r2.place_id = a.pid)
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

revoke all on function public.place_status_summary(text[]) from public, anon;
grant execute on function public.place_status_summary(text[]) to authenticated;
