-- Private worker checkpoint; existing RLS and grants remain unchanged.
alter table public.route_setup_queue
  add column if not exists reward_plan jsonb,
  add column if not exists reward_lease_until timestamptz;

comment on column public.route_setup_queue.reward_plan is
  'Pinned cumulative allocation targets retained until every reward recipient is paid.';
comment on column public.route_setup_queue.reward_lease_until is
  'Atomic per-token worker lease to prevent overlapping reward runs.';
