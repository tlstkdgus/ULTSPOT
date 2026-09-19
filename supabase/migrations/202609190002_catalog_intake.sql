-- Internal intake snapshots. Do not add this schema to Data API exposed schemas.
create schema catalog_private;
revoke all on schema catalog_private from public, anon, authenticated, service_role;

create table catalog_private.intake_versions (
  batch_id text not null check (batch_id ~ '^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$'),
  digest text not null check (digest ~ '^[a-f0-9]{64}$'),
  payload_text text not null check (octet_length(payload_text) <= 10000000),
  payload jsonb generated always as (payload_text::jsonb) stored,
  received_at timestamptz not null default now(),
  primary key (batch_id, digest),
  check (digest = encode(sha256(convert_to(payload_text, 'UTF8')), 'hex')),
  check (jsonb_typeof(payload_text::jsonb) = 'object')
);

-- Append-only review history, bound to the exact version; no public approval flag.
create table catalog_private.intake_reviews (
  review_id bigint generated always as identity primary key,
  batch_id text not null,
  digest text not null,
  decision text not null check (decision in ('hold', 'rejected', 'reviewed')),
  reviewer_alias text not null check (length(reviewer_alias) between 1 and 100),
  notes text not null check (length(notes) between 1 and 4000),
  reviewed_at timestamptz not null default now(),
  foreign key (batch_id, digest) references catalog_private.intake_versions(batch_id, digest)
);
alter table catalog_private.intake_versions enable row level security;
alter table catalog_private.intake_reviews enable row level security;
revoke all on all tables in schema catalog_private from public, anon, authenticated, service_role;
revoke all on all sequences in schema catalog_private from public, anon, authenticated, service_role;
-- Only a database administrator uses these tables through the SQL editor.
-- A reviewed snapshot still needs a separate public-catalog publication step.
