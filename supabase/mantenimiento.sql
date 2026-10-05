-- Registro mensual de mantenimiento por sede.
-- La aplicación accede mediante la API autenticada; no crear políticas públicas.
create table if not exists public.maintenance_records (
  id               uuid primary key default gen_random_uuid(),
  location_id      text not null,
  maintenance_date date not null,
  responsible      text not null,
  tasks            text not null,
  incident         text not null default '',
  completed_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists maintenance_records_month
  on public.maintenance_records (location_id, maintenance_date, created_at);

alter table public.maintenance_records enable row level security;
