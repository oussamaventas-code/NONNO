-- ═══════════════════════════════════════════════════════════════
-- LA PIZZA DE NONNO — Club Nonno (cuentas de cliente y puntos)
--
-- Pega este fichero entero en Supabase → SQL Editor → Run, DESPUÉS
-- de schema.sql. Es idempotente: se puede ejecutar varias veces.
--
-- Mientras no se ejecute, la web sigue funcionando igual: solo el
-- apartado "Mi cuenta" avisa de que el club aún no está activo.
-- ═══════════════════════════════════════════════════════════════

-- ── Clientes ───────────────────────────────────────────────────
-- Una cuenta por móvil (formato +34XXXXXXXXX). Sin contraseña: se
-- entra con un código que llega por SMS. El saldo de puntos vive
-- aquí; cada movimiento queda apuntado en points_ledger.
create table if not exists public.customers (
  id            uuid primary key default gen_random_uuid(),
  phone         text not null unique,
  name          text,
  points        integer not null default 0 check (points >= 0),
  created_at    timestamptz not null default now(),
  last_login_at timestamptz
);

-- ── Códigos de acceso por SMS ─────────────────────────────────
-- Solo se guarda la huella del código, nunca el código. Con límite
-- de intentos y de envíos por hora para que nadie lo adivine a base
-- de probar ni gaste la tarifa del móvil del local.
create table if not exists public.customer_codes (
  phone        text primary key,
  code_hash    text not null,
  expires_at   timestamptz not null,
  attempts     integer not null default 0,
  sent_at      timestamptz not null default now(),
  window_start timestamptz not null default now(),
  window_count integer not null default 1
);

-- ── Movimientos de puntos ─────────────────────────────────────
-- pedido     +N al entregarse un pedido
-- canje      −N al usar puntos en un pedido
-- devolucion +N si se cancela un pedido en el que se canjearon
-- anulacion  −N si se cancela un pedido que ya había sumado puntos
-- ajuste     ±N a mano desde la base de datos
create table if not exists public.points_ledger (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  order_id    uuid references public.orders (id) on delete set null,
  delta       integer not null,
  reason      text not null check (reason in ('pedido', 'canje', 'devolucion', 'anulacion', 'ajuste')),
  note        text,
  created_at  timestamptz not null default now()
);
-- Cada pedido suma, canjea o devuelve UNA sola vez aunque se repita la petición
create unique index if not exists points_ledger_order_reason_idx
  on public.points_ledger (order_id, reason) where order_id is not null;
create index if not exists points_ledger_customer_idx
  on public.points_ledger (customer_id, created_at desc);

-- ── Pedidos: a qué cliente pertenecen y cuántos puntos usaron ──
alter table public.orders add column if not exists customer_id     uuid references public.customers (id) on delete set null;
alter table public.orders add column if not exists points_redeemed integer not null default 0;
alter table public.orders add column if not exists points_discount numeric(10,2) not null default 0;
create index if not exists orders_customer_idx on public.orders (customer_id, created_at desc);

-- ── Mover puntos de forma segura ──────────────────────────────
-- Apunta el movimiento y cambia el saldo en la misma transacción.
-- · Si ese pedido ya tenía ese movimiento, no hace nada (devuelve el saldo).
-- · Si el saldo quedaría negativo, falla con 'saldo_insuficiente'
--   y no se apunta nada.
create or replace function public.loyalty_move(
  p_customer uuid,
  p_order    uuid,
  p_delta    integer,
  p_reason   text,
  p_note     text default null
) returns integer
language plpgsql
as $$
declare
  new_balance integer;
begin
  insert into public.points_ledger (customer_id, order_id, delta, reason, note)
  values (p_customer, p_order, p_delta, p_reason, p_note)
  on conflict (order_id, reason) where order_id is not null do nothing;

  if not found then
    select points into new_balance from public.customers where id = p_customer;
    return new_balance;
  end if;

  update public.customers
     set points = points + p_delta
   where id = p_customer and points + p_delta >= 0
  returning points into new_balance;

  if new_balance is null then
    raise exception 'saldo_insuficiente' using errcode = 'P0001';
  end if;
  return new_balance;
end
$$;

-- Solo el servidor (clave de servicio) puede mover puntos
revoke execute on function public.loyalty_move(uuid, uuid, integer, text, text) from public, anon, authenticated;
grant  execute on function public.loyalty_move(uuid, uuid, integer, text, text) to service_role;

-- ── Seguridad ──────────────────────────────────────────────────
-- Igual que los pedidos: RLS activado y SIN políticas públicas. Con
-- la clave anónima no se lee ni se escribe nada; todo pasa por las
-- funciones del servidor.
alter table public.customers      enable row level security;
alter table public.customer_codes enable row level security;
alter table public.points_ledger  enable row level security;
