-- Estado idempotente de los SMS y WhatsApp transaccionales por pedido.
-- Requiere que supabase/schema.sql haya creado orders.sms.
alter table public.orders add column if not exists sms jsonb not null default '{}'::jsonb;

create or replace function public.claim_order_sms(p_order_id uuid, p_event text)
returns boolean
language plpgsql
as $$
declare
  claimed boolean;
begin
  if p_event is null or p_event not in ('recibido', 'listo', 'reparto', 'cancelado') then
    raise exception 'evento_sms_no_valido';
  end if;

  update public.orders
     set sms = jsonb_set(
       coalesce(sms, '{}'::jsonb),
       array[p_event],
       coalesce(sms -> p_event, '{}'::jsonb) || jsonb_build_object(
         'status', 'enviando',
         'attempts', coalesce(nullif(sms -> p_event ->> 'attempts', '')::integer, 0) + 1,
         'updated_at', now()
       ),
       true
     )
   where id = p_order_id
     and coalesce(sms -> p_event ->> 'status', '') not in ('enviando', 'enviado')
  returning true into claimed;

  return coalesce(claimed, false);
end
$$;

create or replace function public.record_order_sms(
  p_order_id uuid,
  p_event text,
  p_status text,
  p_channel text default null,
  p_error text default null,
  p_external_id text default null
) returns void
language plpgsql
as $$
begin
  if p_event is null or p_event not in ('recibido', 'listo', 'reparto', 'cancelado') then
    raise exception 'evento_sms_no_valido';
  end if;
  if p_status is null or p_status not in ('enviado', 'fallido', 'sin_configurar') then
    raise exception 'estado_sms_no_valido';
  end if;

  update public.orders
     set sms = jsonb_set(
       coalesce(sms, '{}'::jsonb),
       array[p_event],
       coalesce(sms -> p_event, '{}'::jsonb) || jsonb_build_object(
         'status', p_status,
         'channel', p_channel,
         'error', p_error,
         'external_id', p_external_id,
         'updated_at', now(),
         'sent_at', case when p_status = 'enviado' then now() else null end
       ),
       true
     )
   where id = p_order_id;
end
$$;

revoke all on function public.claim_order_sms(uuid, text) from public, anon, authenticated;
revoke all on function public.record_order_sms(uuid, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.claim_order_sms(uuid, text) to service_role;
grant execute on function public.record_order_sms(uuid, text, text, text, text, text) to service_role;
