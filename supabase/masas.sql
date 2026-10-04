-- Masas del día por sede: Nonno pone cuántas hay (p. ej. 180) desde el
-- panel y, cuando se gastan, la web y el mostrador dejan de vender pizzas.
-- Vacío (null) = sin límite. Ejecutar una vez en Supabase › SQL Editor.
alter table public.store_status
  add column if not exists dough_limit integer check (dough_limit is null or dough_limit >= 0);
