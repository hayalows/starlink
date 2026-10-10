-- v1.6.0: independent, append-only minute history vault.
-- Never alter the existing phone-pairing snapshot table. No retention deletion.
-- Only the server's service role can touch raw minute records; all requests
-- must first authenticate a 256-bit existing monitor read/write capability.
create table if not exists public.starlink_archive_minutes (
  monitor_id uuid not null,
  minute bigint not null,
  samples smallint not null check (samples between 0 and 120),
  watt_seconds double precision not null check (watt_seconds >= 0 and watt_seconds <= 600000),
  downlink_bits double precision check (downlink_bits is null or (downlink_bits >= 0 and downlink_bits <= 1e16)),
  uplink_bits double precision check (uplink_bits is null or (uplink_bits >= 0 and uplink_bits <= 1e16)),
  stored_at timestamptz not null default now(),
  primary key (monitor_id, minute),
  constraint archive_minute_aligned check (minute >= 0 and minute % 60 = 0)
);
alter table public.starlink_archive_minutes enable row level security;
revoke all on public.starlink_archive_minutes from anon, authenticated;
grant select, insert on public.starlink_archive_minutes to service_role;
comment on table public.starlink_archive_minutes is
  'Append-only minute telemetry for explicitly opted-in monitors. No device names, credentials, MACs, or billing data. No automatic deletion on phone disconnect. Access only after capability validation in the vault Edge Function.';
