-- Nonno Impresora: cola de impresión. El servidor deja aquí cada comanda
-- y cada ticket (ya en el idioma de la impresora) y el programa del local
-- los recoge, los imprime y confirma. Ejecutar una vez en Supabase › SQL Editor.
create table if not exists public.print_jobs (
  id          bigint generated always as identity primary key,
  location_id text not null,
  role        text not null default 'cocina',      -- cocina | mostrador
  kind        text not null,                       -- comanda | ticket | cancelado | prueba
  order_id    uuid references public.orders(id) on delete cascade,
  ref         text,
  data        text not null,                       -- bytes ESC/POS en base64
  status      text not null default 'pendiente',   -- pendiente | impreso | error | navegador
  attempts    integer not null default 0,
  error       text,
  created_at  timestamptz not null default now(),
  printed_at  timestamptz
);
create index if not exists print_jobs_cola on public.print_jobs (location_id, status, id);
alter table public.print_jobs enable row level security;

-- Última señal del programa del local y estado de sus impresoras
alter table public.store_status
  add column if not exists printer_seen_at timestamptz,
  add column if not exists printer_info jsonb;
