-- ═══════════════════════════════════════════════════════════════
-- LA PIZZA DE NONNO — ESQUEMA DE SEGURIDAD RBAC Y AISLAMIENTO MULTI-SEDE
--
-- Jerarquía de 3 Roles:
-- 1. Administrador (SuperAdmin / Dirección):
--    - Acceso global a todas las sedes ('all' / 'sangonera' / 'santo-angel').
--    - Lectura y escritura en pedidos, facturación, cierres de caja y configuración.
-- 2. Cajero (Cajero / Operaciones de Sede):
--    - Acceso total pero CONFINADO ESTRICTAMENTE a su sede_id.
--    - Gestión de comandas, cobro de pedidos, creación en mostrador y cierre de caja de su sede.
-- 3. Repartidor (Driver):
--    - Confinado estrictamente a su sede_id.
--    - Permisos estrictamente limitados a consultar datos de envío de sus pedidos asignados
--      y actualizar el estado a 'entregado'.
--    - BLOQUEO TOTAL de acceso a facturación, cierres de caja y edición de líneas/precios de tickets.
--
-- Pega este archivo en Supabase → SQL Editor → Run.
-- Es totalmente idempotente y seguro de re-ejecutar.
-- ═══════════════════════════════════════════════════════════════

-- 1. IDENTIFICACIÓN DE ROLES Y SEDE (JWT / Claims / App Settings)
create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role', ''),
    nullif(current_setting('request.jwt.claims', true)::jsonb -> 'user_metadata' ->> 'role', ''),
    nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'role', ''),
    nullif(current_setting('app.current_role', true), ''),
    'anon'
  );
$$;

create or replace function public.current_sede()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'location_id', ''),
    nullif(current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'sede_id', ''),
    nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'location_id', ''),
    nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sede_id', ''),
    nullif(current_setting('app.current_sede', true), '')
  );
$$;

create or replace function public.current_driver_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'driver_id', ''),
    nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'driver_id', ''),
    nullif(current_setting('app.current_driver_id', true), '')
  );
$$;

-- Funciones booleanas de validación de rol
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.current_role() in ('superadmin', 'admin')
    or (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'location_id') = 'all'
    or current_setting('app.is_superadmin', true) = 'true',
    false
  );
$$;

create or replace function public.is_cajero()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.current_role() = 'cajero'
    or (public.current_role() = 'admin' and not public.is_admin()),
    false
  );
$$;

create or replace function public.is_repartidor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.current_role() = 'repartidor',
    false
  );
$$;

-- Mantener compatibilidad con llamadas anteriores
create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin();
$$;

revoke all on function public.current_role() from public;
revoke all on function public.current_sede() from public;
revoke all on function public.current_driver_id() from public;
revoke all on function public.is_admin() from public;
revoke all on function public.is_cajero() from public;
revoke all on function public.is_repartidor() from public;
revoke all on function public.is_superadmin() from public;

grant execute on function public.current_role() to authenticated, service_role;
grant execute on function public.current_sede() to authenticated, service_role;
grant execute on function public.current_driver_id() to authenticated, service_role;
grant execute on function public.is_admin() to authenticated, service_role;
grant execute on function public.is_cajero() to authenticated, service_role;
grant execute on function public.is_repartidor() to authenticated, service_role;
grant execute on function public.is_superadmin() to authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════
-- 2. ACTIVACIÓN Y FORZADO DE RLS
-- ═══════════════════════════════════════════════════════════════
alter table if exists public.orders enable row level security;
alter table if exists public.orders force row level security;

alter table if exists public.store_status enable row level security;
alter table if exists public.cash_closings enable row level security;
alter table if exists public.drivers enable row level security;
alter table if exists public.stock_items enable row level security;
alter table if exists public.stock_counts enable row level security;
alter table if exists public.print_jobs enable row level security;
alter table if exists public.menu_soldout enable row level security;
alter table if exists public.menu_ingredient_soldout enable row level security;
alter table if exists public.customers enable row level security;
alter table if exists public.points_ledger enable row level security;
alter table if exists public.push_subscriptions enable row level security;
alter table if exists public.site_content enable row level security;
alter table if exists public.auth_limits enable row level security;

-- Columna de trazabilidad de impresión para contingencia WiFi / Offline
alter table if exists public.orders add column if not exists print_status text default 'pendiente';

-- Revocación de permisos peligrosos a anónimos
revoke all on public.orders from anon, public;
revoke all on public.customers from anon, public;
revoke all on public.points_ledger from anon, public;
revoke all on public.drivers from anon, public;
revoke all on public.cash_closings from anon, public;
revoke all on public.print_jobs from anon, public;
revoke all on public.push_subscriptions from anon, public;
revoke all on public.auth_limits from anon, public;

grant select, insert, update, delete on public.orders to service_role;
grant select, insert, update, delete on public.customers to service_role;
grant select, insert, update, delete on public.points_ledger to service_role;
grant select, insert, update, delete on public.drivers to service_role;
grant select, insert, update, delete on public.cash_closings to service_role;
grant select, insert, update, delete on public.print_jobs to service_role;
grant select, insert, update, delete on public.push_subscriptions to service_role;
grant select, insert, update, delete on public.auth_limits to service_role;

-- ═══════════════════════════════════════════════════════════════
-- 3. POLÍTICAS RBAC PARA 'orders' (PEDIDOS Y COMANDAS)
-- ═══════════════════════════════════════════════════════════════
drop policy if exists "orders_rbac_select" on public.orders;
drop policy if exists "orders_rbac_insert" on public.orders;
drop policy if exists "orders_rbac_update" on public.orders;
drop policy if exists "orders_tenant_isolation_select" on public.orders;
drop policy if exists "orders_tenant_isolation_update" on public.orders;

-- SELECT:
-- - Administrador: Todas las sedes
-- - Cajero: Solo su sede_id
-- - Repartidor: Solo pedidos delivery de su sede_id que tenga asignados o estén en reparto
-- - Cliente: Solo sus pedidos propios
create policy "orders_rbac_select"
on public.orders
for select
to authenticated
using (
  -- 1. Administrador (acceso global)
  public.is_admin()

  -- 2. Cajero (acceso a toda su sede)
  or (public.is_cajero() and location_id = public.current_sede())

  -- 3. Repartidor (solo pedidos de envío de su sede_id asignados a él)
  or (
    public.is_repartidor()
    and location_id = public.current_sede()
    and mode = 'delivery'
    and (
      driver_id::text = public.current_driver_id()
      or status in ('listo', 'horno')
    )
  )

  -- 4. Cliente propietario
  or (customer_id is not null and customer_id = (select auth.uid()))
);

-- INSERT:
-- - Administrador: En cualquier sede
-- - Cajero: Solo pedidos para su sede_id
-- - Repartidor: DENEGADO (no puede crear pedidos)
create policy "orders_rbac_insert"
on public.orders
for insert
to authenticated
with check (
  public.is_admin()
  or (public.is_cajero() and location_id = public.current_sede())
);

-- UPDATE:
-- - Administrador: Actualiza en cualquier sede
-- - Cajero: Actualiza en su sede_id (estados de cocina, notas, clientes, pagos)
-- - Repartidor: Solo puede actualizar el estado a 'entregado' en pedidos de su sede asignados a él
create policy "orders_rbac_update"
on public.orders
for update
to authenticated
using (
  public.is_admin()
  or (public.is_cajero() and location_id = public.current_sede())
  or (
    public.is_repartidor()
    and location_id = public.current_sede()
    and mode = 'delivery'
    and (driver_id::text = public.current_driver_id() or driver_id is null)
    and status != 'cancelado'
  )
)
with check (
  public.is_admin()
  or (public.is_cajero() and location_id = public.current_sede())
  or (
    public.is_repartidor()
    and location_id = public.current_sede()
    and status = 'entregado'
  )
);

-- ═══════════════════════════════════════════════════════════════
-- 4. POLÍTICAS RBAC PARA 'cash_closings' (FACTURACIÓN Y CAJA)
-- REPARTIDOR TOTALMENTE BLOQUEADO
-- ═══════════════════════════════════════════════════════════════
drop policy if exists "cash_closings_tenant_isolation" on public.cash_closings;
drop policy if exists "cash_closings_rbac_all" on public.cash_closings;

create policy "cash_closings_rbac_all"
on public.cash_closings
for all
to authenticated
using (
  public.is_admin()
  or (public.is_cajero() and location_id = public.current_sede())
)
with check (
  public.is_admin()
  or (public.is_cajero() and location_id = public.current_sede())
);

-- ═══════════════════════════════════════════════════════════════
-- 5. POLÍTICAS RBAC PARA 'drivers' (GESTIÓN DE REPARTIDORES)
-- ═══════════════════════════════════════════════════════════════
drop policy if exists "drivers_tenant_isolation" on public.drivers;
drop policy if exists "drivers_rbac_all" on public.drivers;

create policy "drivers_rbac_all"
on public.drivers
for all
to authenticated
using (
  public.is_admin()
  or (public.is_cajero() and location_id = public.current_sede())
  or (public.is_repartidor() and id::text = public.current_driver_id() and location_id = public.current_sede())
)
with check (
  public.is_admin()
  or (public.is_cajero() and location_id = public.current_sede())
);

-- ═══════════════════════════════════════════════════════════════
-- 6. POLÍTICAS RBAC PARA 'stock_items' Y 'stock_counts' (INVENTARIO)
-- ═══════════════════════════════════════════════════════════════
drop policy if exists "stock_items_tenant_isolation" on public.stock_items;
drop policy if exists "stock_counts_tenant_isolation" on public.stock_counts;
drop policy if exists "stock_items_rbac_all" on public.stock_items;
drop policy if exists "stock_counts_rbac_all" on public.stock_counts;

create policy "stock_items_rbac_all"
on public.stock_items
for all
to authenticated
using (
  public.is_admin()
  or (public.is_cajero() and location_id = public.current_sede())
)
with check (
  public.is_admin()
  or (public.is_cajero() and location_id = public.current_sede())
);

create policy "stock_counts_rbac_all"
on public.stock_counts
for all
to authenticated
using (
  public.is_admin()
  or (public.is_cajero() and location_id = public.current_sede())
)
with check (
  public.is_admin()
  or (public.is_cajero() and location_id = public.current_sede())
);

-- ═══════════════════════════════════════════════════════════════
-- 7. POLÍTICAS RBAC PARA 'print_jobs' (COLAS DE IMPRESIÓN)
-- ═══════════════════════════════════════════════════════════════
drop policy if exists "print_jobs_tenant_isolation" on public.print_jobs;
drop policy if exists "print_jobs_rbac_all" on public.print_jobs;

create policy "print_jobs_rbac_all"
on public.print_jobs
for all
to authenticated
using (
  public.is_admin()
  or (public.is_cajero() and location_id = public.current_sede())
)
with check (
  public.is_admin()
  or (public.is_cajero() and location_id = public.current_sede())
);

-- ═══════════════════════════════════════════════════════════════
-- 8. TRIGGER DE SEGURIDAD ESTRICTA PARA REPARTIDOR (ANTI-LEAK / ANTI-TAMPER)
-- Si un repartidor intenta alterar precios, items o campos de facturación en 'orders',
-- el trigger aborta la transacción inmediatamente.
-- ═══════════════════════════════════════════════════════════════
create or replace function public.validate_order_update_rbac()
returns trigger
language plpgsql
security definer
as $$
begin
  -- Si el rol que ejecuta es Repartidor:
  if public.is_repartidor() then
    -- Bloquear modificación de importes o ítems del pedido
    if NEW.total != OLD.total or NEW.subtotal != OLD.subtotal or NEW.items != OLD.items or NEW.discount != OLD.discount then
      raise exception 'Permiso denegado: Un repartidor no tiene autorización para modificar los importes o productos del pedido.';
    end if;

    -- Bloquear modificación de sede
    if NEW.location_id != OLD.location_id then
      raise exception 'Permiso denegado: No se puede cambiar la sede asignada.';
    end if;

    -- Solo puede transicionar estado hacia entregado
    if NEW.status != 'entregado' and NEW.status != OLD.status then
      raise exception 'Permiso denegado: El repartidor solo puede marcar el pedido como entregado.';
    end if;
  end if;

  -- Prevenir cualquier cambio de sede una vez creado el registro
  if OLD.location_id is not null and NEW.location_id is distinct from OLD.location_id then
    raise exception 'No está permitido cambiar la sede de un registro una vez creado (sede original: %, sede nueva: %)',
      OLD.location_id, NEW.location_id;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_validate_order_update_rbac on public.orders;
create trigger trg_validate_order_update_rbac
before update on public.orders
for each row
execute function public.validate_order_update_rbac();

-- ═══════════════════════════════════════════════════════════════
-- FIN DEL ESQUEMA RBAC Y AISLAMIENTO MULTI-SEDE
-- ═══════════════════════════════════════════════════════════════
