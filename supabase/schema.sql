-- ═══════════════════════════════════════════════════════════════
-- LA PIZZA DE NONNO — Esquema de pedidos
--
-- Pega este fichero entero en Supabase → SQL Editor → Run.
-- Es idempotente: puedes ejecutarlo varias veces sin romper nada.
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.orders (
  id            uuid primary key default gen_random_uuid(),
  ref           text not null unique,              -- NN-4821, visible para el cliente
  created_at    timestamptz not null default now(),

  -- Estado del pedido en cocina
  status        text not null default 'nuevo'
                check (status in ('nuevo', 'horno', 'listo', 'entregado', 'cancelado')),

  -- Dónde y cómo
  location_id   text not null,                     -- sangonera | santo-angel
  location_name text not null,
  mode          text not null check (mode in ('pickup', 'delivery')),

  -- Quién
  customer_name  text not null,
  customer_phone text not null,
  address        text,
  notes          text,

  -- Qué (líneas completas con tamaño, extras y nota de cada producto)
  items         jsonb not null,
  item_count    integer not null default 0,
  total         numeric(10,2) not null default 0,

  -- Marcas de cocina
  printed_at    timestamptz,
  seen_at       timestamptz
);

-- El panel siempre pide los más recientes primero
create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_status_idx     on public.orders (status);

-- ── Seguridad ──────────────────────────────────────────────────
-- RLS activado y SIN políticas públicas: con la clave anónima no se
-- puede leer ni escribir nada. Todo pasa por las funciones del
-- servidor, que usan la clave de servicio y nunca llegan al navegador.
alter table public.orders enable row level security;

-- Realtime: el panel se entera al instante de cada pedido nuevo.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end $$;

-- ── Suscripciones de notificaciones push ───────────────────────
create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  endpoint   text not null unique,
  keys       jsonb not null,
  label      text,                                 -- "Ordenador del local"
  -- Qué sede avisa este dispositivo: 'sangonera', 'santo-angel' o
  -- 'all' para la dirección. Un local no recibe avisos del otro.
  scope      text not null default 'all',
  created_at timestamptz not null default now()
);

-- Para instalaciones anteriores a la separación por sede:
alter table public.push_subscriptions
  add column if not exists scope text not null default 'all';

alter table public.push_subscriptions enable row level security;
