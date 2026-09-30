-- ═══════════════════════════════════════════════════════════════
-- DESCUENTOS CREADOS DESDE EL PANEL (pestaña Descuentos)
-- Rebajan el precio de toda la carta, de unas categorías o de unos
-- productos, en % o en €. La web, el mostrador y el servidor cobran
-- el precio rebajado. Sin esta tabla, el panel avisa y la carta sigue
-- con sus precios de siempre.
-- Se puede ejecutar más de una vez sin romper nada.
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.discounts (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  kind        text not null check (kind in ('percent', 'amount')),
  value       numeric(8,2) not null check (value > 0),
  -- 'all' toda la carta · 'categories' unas categorías · 'products' unos productos
  target      text not null default 'all' check (target in ('all', 'categories', 'products')),
  target_ids  text[] not null default '{}',
  starts_at   timestamptz,
  ends_at     timestamptz,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Igual que el resto: RLS activado y sin políticas públicas. Todo
-- pasa por el servidor, que usa la clave de servicio.
alter table public.discounts enable row level security;
