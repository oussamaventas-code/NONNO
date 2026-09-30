-- ═══════════════════════════════════════════════════════════════
-- NÚMERO DE PEDIDO DEL DÍA: 01, 02, 03… en cada sede, desde cero
-- cada día (el día cambia a las 5 de la mañana).
-- Sin ejecutarlo todo funciona igual, con las referencias NN-4821.
-- Se puede ejecutar más de una vez sin romper nada.
-- ═══════════════════════════════════════════════════════════════

-- Día de servicio al que pertenece el pedido.
alter table public.orders add column if not exists service_day date;

-- El número ya no es único para siempre: se repite cada día...
alter table public.orders drop constraint if exists orders_ref_key;

-- ...pero nunca dos iguales el mismo día en la misma sede.
create unique index if not exists orders_day_ref_idx
  on public.orders (location_id, service_day, ref);
