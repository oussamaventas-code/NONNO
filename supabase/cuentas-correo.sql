-- ═══════════════════════════════════════════════════════════════
-- LA PIZZA DE NONNO — Cuentas con correo y contraseña
--
-- Pega este fichero entero en Supabase → SQL Editor → Run, DESPUÉS
-- de club-nonno.sql. Es idempotente: se puede ejecutar varias veces.
--
-- · El cliente entra con su correo y su contraseña (ya no por SMS).
-- · El móvil se sigue guardando: la tienda lo necesita para llamar y
--   los puntos de los pedidos sin cuenta se buscan por él.
-- · marketing_ok: el cliente ha marcado que quiere recibir ofertas.
--   Sin esa casilla NO se le puede mandar publicidad (RGPD).
-- · El ticket de cada pedido se manda al correo que deje el cliente.
-- ═══════════════════════════════════════════════════════════════

alter table public.customers add column if not exists email          text;
alter table public.customers add column if not exists password_hash  text;
alter table public.customers add column if not exists marketing_ok   boolean not null default false;
alter table public.customers add column if not exists marketing_at   timestamptz;
-- Enlace para cambiar la contraseña: solo se guarda su huella
alter table public.customers add column if not exists reset_hash     text;
alter table public.customers add column if not exists reset_expires  timestamptz;

-- Un correo, una cuenta (sin distinguir mayúsculas)
create unique index if not exists customers_email_idx on public.customers (lower(email));

-- Correo del pedido (para mandarle el ticket) y si quiere ofertas
alter table public.orders add column if not exists customer_email text;
alter table public.orders add column if not exists marketing_ok   boolean not null default false;

-- Los códigos por SMS ya no se usan
drop table if exists public.customer_codes;

-- Mismas reglas que el resto de tablas: solo el servidor (service role)
alter table public.customers enable row level security;
