create table if not exists public.router_config_snapshots (
  instance_id text primary key,
  format_version integer not null,
  revision bigint not null check (revision > 0),
  ciphertext text not null,
  checksum text not null,
  updated_at timestamptz not null default now()
);

alter table public.router_config_snapshots enable row level security;
revoke all on table public.router_config_snapshots from anon, authenticated;
grant select, insert, update on table public.router_config_snapshots to service_role;

comment on table public.router_config_snapshots is
  'Server-only, application-encrypted 9Router configuration snapshots. Never expose service credentials to browsers.';
