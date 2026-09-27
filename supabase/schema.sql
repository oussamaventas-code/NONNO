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
  seen_at       timestamptz,

  -- Pago: solo relevante para pedidos de recogida (el envío no está
  -- cobrado por la web, pero en el mostrador hay que saber si ya se
  -- ha pagado o queda pendiente al entregar).
  payment_status text not null default 'pendiente'
                  check (payment_status in ('pendiente', 'pagado'))
);

-- Para instalaciones anteriores a esta columna:
alter table public.orders
  add column if not exists payment_status text not null default 'pendiente';

-- Desglose del importe: total = subtotal − descuento + envío.
-- deals guarda qué packs "Llévatelas por menos" se aplicaron.
alter table public.orders add column if not exists subtotal      numeric(10,2);
alter table public.orders add column if not exists discount      numeric(10,2) not null default 0;
alter table public.orders add column if not exists deals         jsonb not null default '[]'::jsonb;
alter table public.orders add column if not exists delivery_fee  numeric(10,2) not null default 0;
alter table public.orders add column if not exists delivery_zone text;

-- Franjas del horno: cuántas unidades van al horno, en qué franjas
-- (oven_slots = [{start, pizzas}]), a qué hora está listo y, si es
-- entrega, a qué hora llega. Mientras oven_slots es null el pedido
-- está recién entrado y el servidor le está asignando franja.
alter table public.orders add column if not exists pizza_count integer not null default 0;
alter table public.orders add column if not exists oven_slots  jsonb;
alter table public.orders add column if not exists ready_at    timestamptz;
alter table public.orders add column if not exists eta_at      timestamptz;
create index if not exists orders_location_created_idx on public.orders (location_id, created_at desc);

-- TPV del mostrador: de dónde viene el pedido (web, mostrador o
-- teléfono), cómo y cuándo se cobró, y si se modificó después.
alter table public.orders add column if not exists channel        text not null default 'web';
alter table public.orders add column if not exists payment_method text;
alter table public.orders add column if not exists paid_at        timestamptz;
alter table public.orders add column if not exists edited_at      timestamptz;

-- Envío por distancia: punto de entrega y km al local. Si el cliente
-- no pudo localizar la dirección (plan B), delivery_verified = false
-- y el local tiene que confirmar la distancia.
alter table public.orders add column if not exists delivery_km       numeric(6,2);
alter table public.orders add column if not exists delivery_lat      double precision;
alter table public.orders add column if not exists delivery_lng      double precision;
alter table public.orders add column if not exists delivery_verified boolean;

-- Clave única del pedido que pone el navegador: si un pedido se
-- reenvía (reintento o cola sin conexión del mostrador) no se duplica.
alter table public.orders add column if not exists client_key text;
create unique index if not exists orders_client_key_idx on public.orders (client_key) where client_key is not null;

-- SMS al cliente: qué avisos se han mandado y si llegaron a salir.
-- { "recibido": {"ok":true,"at":"..."}, "listo": {...}, "cancelado": {...} }
alter table public.orders add column if not exists sms jsonb not null default '{}'::jsonb;

-- Reparto: cuándo salió el pedido con el repartidor y en qué salida
-- (los pedidos de una misma salida comparten route_id).
alter table public.orders add column if not exists dispatched_at timestamptz;
alter table public.orders add column if not exists route_id      text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'orders_payment_status_check'
  ) then
    alter table public.orders
      add constraint orders_payment_status_check
      check (payment_status in ('pendiente', 'pagado'));
  end if;
end $$;

-- El panel siempre pide los más recientes primero
create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_status_idx     on public.orders (status);

-- ── Apertura de la tienda ───────────────────────────────────────
-- "La tienda se abre cuando Nonno le da al ON": cada sede tiene su
-- propio interruptor. Mientras esté cerrada, la web no deja pedir y
-- el servidor rechaza igualmente cualquier pedido que se cuele.
create table if not exists public.store_status (
  location_id text primary key,
  is_open     boolean not null default false,
  updated_at  timestamptz not null default now()
);

insert into public.store_status (location_id, is_open)
values ('sangonera', false), ('santo-angel', false)
on conflict (location_id) do nothing;

alter table public.store_status enable row level security;

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

-- ── Checklist de stock ─────────────────────────────────────────
-- Cada sede tiene su lista de productos con el objetivo diario
-- (lo que tiene que haber al empezar el servicio). Cada día se
-- apunta cuánto hay y la compra es objetivo − lo que hay.
create table if not exists public.stock_items (
  id          uuid primary key default gen_random_uuid(),
  location_id text not null,
  name        text not null,
  unit        text not null default 'kg',
  target      numeric(10,2) not null default 0,
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists stock_items_location_idx on public.stock_items (location_id, position);

create table if not exists public.stock_counts (
  location_id text not null,
  day         date not null,                        -- día de servicio (hora de Madrid)
  item_id     uuid not null references public.stock_items (id) on delete cascade,
  on_hand     numeric(10,2),                        -- lo que hay; null = sin contar
  bought      boolean not null default false,       -- tachado en la lista de la compra
  updated_at  timestamptz not null default now(),
  primary key (location_id, day, item_id)
);

-- Punto de partida: el objetivo que dio el cliente (80 kg al día).
-- Solo se crea si la sede aún no tiene ningún producto.
insert into public.stock_items (location_id, name, unit, target, position)
select s.id, 'Harina / masa', 'kg', 80, 0
from (values ('sangonera'), ('santo-angel')) as s(id)
where not exists (select 1 from public.stock_items i where i.location_id = s.id);

alter table public.stock_items  enable row level security;
alter table public.stock_counts enable row level security;
