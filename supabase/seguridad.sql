-- ═══════════════════════════════════════════════════════════════
-- Seguridad: límite de intentos (login del panel, códigos del Club,
-- SMS y pedidos públicos).
--
-- Pégalo en Supabase → SQL Editor → Run. Se puede ejecutar más de
-- una vez sin problema. Sin esto la web sigue funcionando, pero el
-- límite solo vale dentro de cada instancia del servidor (más flojo).
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.auth_limits (
  key          text primary key,
  hits         integer not null default 0,
  window_start timestamptz not null default now(),
  locked_until timestamptz
);

-- Solo el servidor (service_role) la toca: sin políticas públicas.
alter table public.auth_limits enable row level security;

-- Cuenta un intento de forma ATÓMICA (dos peticiones a la vez no se
-- saltan el límite). Devuelve 0 si puede seguir, o los segundos que
-- queda bloqueado. Pasado p_max intentos en p_window segundos, bloquea
-- p_lock segundos.
create or replace function public.auth_take(p_key text, p_max integer, p_window integer, p_lock integer)
returns integer
language plpgsql
as $$
declare
  r public.auth_limits;
begin
  insert into public.auth_limits as t (key, hits, window_start)
  values (p_key, 1, now())
  on conflict (key) do update set
    hits = case
      when t.window_start < now() - make_interval(secs => p_window) then 1
      else t.hits + 1
    end,
    window_start = case
      when t.window_start < now() - make_interval(secs => p_window) then now()
      else t.window_start
    end
  returning * into r;

  if r.locked_until is not null and r.locked_until > now() then
    return ceil(extract(epoch from (r.locked_until - now())))::integer;
  end if;

  if r.hits > p_max then
    update public.auth_limits
       set locked_until = now() + make_interval(secs => p_lock), hits = 0
     where key = p_key;
    return p_lock;
  end if;

  return 0;
end;
$$;

-- Borra el contador (login correcto).
create or replace function public.auth_clear(p_key text)
returns void
language sql
as $$
  delete from public.auth_limits where key = p_key;
$$;

revoke all on function public.auth_take(text, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.auth_clear(text) from public, anon, authenticated;
grant execute on function public.auth_take(text, integer, integer, integer) to service_role;
grant execute on function public.auth_clear(text) to service_role;

-- Limpieza opcional de contadores viejos (puedes lanzarla cuando quieras):
--   delete from public.auth_limits
--    where window_start < now() - interval '2 days'
--      and (locked_until is null or locked_until < now());
