-- Portal de repartidores: cada sede da de alta a sus repartidores con
-- un PIN de 4 cifras (no se guarda el PIN, solo su huella). Cada pedido
-- a domicilio apunta quién lo llevó. Ejecutar una vez en Supabase › SQL Editor.
create table if not exists public.drivers (
  id          uuid primary key default gen_random_uuid(),
  location_id text not null,
  name        text not null,
  pin_hash    text not null,
  created_at  timestamptz not null default now()
);
create unique index if not exists drivers_pin_por_sede on public.drivers (location_id, pin_hash);
alter table public.drivers enable row level security;

alter table public.orders
  add column if not exists driver_id uuid references public.drivers(id) on delete set null,
  add column if not exists driver_name text;
create index if not exists orders_driver on public.orders (driver_id);
