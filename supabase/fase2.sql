-- ═══════════════════════════════════════════════════════════════
-- FASE 2 Y 3 DEL PANEL: pedidos programados, motivo de cancelación
-- y cierre de caja.
-- Sin ejecutarlo la web y el panel funcionan igual que antes; solo
-- fallan estas tres funciones nuevas (con un aviso claro).
-- Se puede ejecutar más de una vez sin romper nada.
-- ═══════════════════════════════════════════════════════════════

-- Pedido "para las 21:30": desde qué momento puede ocupar el horno.
alter table public.orders add column if not exists scheduled_for timestamptz;

-- Por qué se canceló un pedido (cliente, sin producto, error, no se presentó…).
alter table public.orders add column if not exists cancel_reason text;

-- Cierre de caja: una fila por sede y día, con lo esperado y lo contado.
create table if not exists public.cash_closings (
  location_id   text not null,
  day           date not null,
  expected_cash numeric(10,2) not null default 0,
  expected_card numeric(10,2) not null default 0,
  counted_cash  numeric(10,2) not null default 0,
  counted_card  numeric(10,2) not null default 0,
  note          text,
  closed_by     text,
  closed_at     timestamptz not null default now(),
  primary key (location_id, day)
);

-- Igual que el resto: RLS activado y sin políticas públicas. Todo
-- pasa por el servidor, que usa la clave de servicio.
alter table public.cash_closings enable row level security;
