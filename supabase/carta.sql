-- ═══════════════════════════════════════════════════════════════
-- CARTA EDITABLE DESDE EL PANEL
-- Precios, productos ocultos y "agotado" por sede. La carta base
-- sigue en el código (src/data/menu.js): estas tablas solo la
-- corrigen por encima. Sin ellas, la web funciona igual que antes.
-- Se puede ejecutar más de una vez sin romper nada.
-- ═══════════════════════════════════════════════════════════════

-- Precio nuevo y/o producto oculto, para todas las sedes.
-- price: producto de precio único. portion_prices: {"racion": 7.9, "media": 4.9}
create table if not exists public.menu_overrides (
  product_id     text primary key,
  price          numeric(8,2) check (price is null or price >= 0),
  portion_prices jsonb,
  hidden         boolean not null default false,
  updated_at     timestamptz not null default now()
);

-- Agotado en una sede concreta: una fila = agotado. Se borra al reponer.
create table if not exists public.menu_soldout (
  location_id text not null,
  product_id  text not null,
  updated_at  timestamptz not null default now(),
  primary key (location_id, product_id)
);

-- Igual que el resto: RLS activado y sin políticas públicas. Todo
-- pasa por el servidor, que usa la clave de servicio.
alter table public.menu_overrides enable row level security;
alter table public.menu_soldout   enable row level security;
