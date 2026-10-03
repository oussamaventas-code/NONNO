import { Printer, Truck, Package, Phone, MapPin, Clock, Euro, CircleDollarSign } from 'lucide-react'
import { price } from '../lib/format'
import { printTicket } from './printTicket'
import { hourOf } from '../lib/kitchenSlots'

const FLOW = [
  /* Un pedido entra ya en preparación ("horno" queda de pedidos antiguos) */
  { id: 'nuevo', label: 'EN PREPARACIÓN', next: 'listo', action: 'LISTO' },
  { id: 'horno', label: 'EN PREPARACIÓN', next: 'listo', action: 'LISTO' },
  { id: 'listo', label: 'LISTO', next: 'entregado', action: 'ENTREGADO' },
  { id: 'entregado', label: 'ENTREGADO', next: null, action: null },
  { id: 'cancelado', label: 'CANCELADO', next: null, action: null },
]

/* Color del marco según el estado del pedido */
const TONE = {
  nuevo: '',
  horno: '',
  listo: 'pf-verde',
  entregado: 'pf-muted',
  cancelado: 'pf-muted !opacity-40',
}

const BADGE = {
  nuevo: 'bg-tomate text-crema',
  horno: 'bg-tomate text-crema',
  listo: 'bg-albahaca text-crema',
  entregado: 'bg-forno/15 text-carbon/70',
  cancelado: 'bg-forno/10 text-carbon/60',
}

const minutesAgo = (iso) => Math.max(0, Math.round((Date.now() - new Date(iso)) / 60000))

export default function OrderCard({ order, onStatus, onUpdated, busy }) {
  const step = FLOW.find((s) => s.id === order.status) || FLOW[0]
  const waiting = minutesAgo(order.created_at)
  const isOpen = !['entregado', 'cancelado'].includes(order.status)

  return (
    <article className={`pframe ${TONE[order.status] ?? TONE.nuevo}`}>
      <div className="pframe-in p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-bold text-lg text-carbon">{order.ref}</span>
              <span className={`pchip !border-transparent ${BADGE[order.status]}`}>
                {step.label}
              </span>
              <span className="pchip">
                {order.mode === 'delivery'
                  ? <><Truck className="w-3.5 h-3.5" /> Entrega</>
                  : <><Package className="w-3.5 h-3.5" /> Recogida</>}
              </span>
              {order.channel && order.channel !== 'web' && (
                <span className="pchip">
                  {order.channel === 'telefono' ? 'Teléfono' : 'Mostrador'}
                </span>
              )}
              {order.edited_at && isOpen && (
                <span className="pchip !border-transparent bg-horno !text-crema">
                  MODIFICADO {hourOf(order.edited_at)}
                </span>
              )}
              {order.mode === 'pickup' && (
                <span className={[
                  'pchip',
                  order.payment_status === 'pagado' ? '!border-albahaca !text-albahaca bg-albahaca/10' : '!border-tomate !text-tomate bg-tomate/10',
                ].join(' ')}>
                  <Euro className="w-3.5 h-3.5" />
                  {order.payment_status === 'pagado' ? 'Pagado' : 'Falta por pagar'}
                </span>
              )}
            </div>
            {order.ready_at && isOpen && (
              <p className="mt-2 font-sans font-extrabold text-lg text-carbon">
                HORNO PARA LAS {hourOf(order.ready_at)}
                {order.mode === 'delivery' && order.eta_at && (
                  <span className="block mono normal-case font-normal text-sm text-carbon/60">
                    llega al cliente hacia las {hourOf(order.eta_at)} · {order.pizza_count} al horno
                  </span>
                )}
              </p>
            )}
            <p className="mono normal-case text-carbon/45 mt-2 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              hace {waiting} min · {order.location_name}
            </p>
          </div>
          <span className="font-serif italic font-semibold text-2xl text-tomate whitespace-nowrap">
            {price(order.total)}
          </span>
        </div>

        <ul className="mt-4 flex flex-col gap-2 border-t border-tomate/25 pt-4">
          {(order.items || []).map((item, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <span className="font-mono font-bold text-carbon">{item.qty}×</span>
              <span className="flex-1">
                <span className="font-semibold text-carbon">{item.name}</span>
                {item.size && <span className="block mono normal-case text-carbon/50">{item.size}</span>}
                {item.removed?.length > 0 && (
                  <span className="mt-1 inline-block rounded-lg border-2 border-tomate px-2 py-0.5 text-xs font-extrabold uppercase text-tomate">
                    Sin {item.removed.join(' · sin ')}
                  </span>
                )}
                {item.extras?.length > 0 && (
                  <span className="block mono normal-case text-albahaca">+ {item.extras.join(', ')}</span>
                )}
                {item.note && (
                  <span className="block text-xs font-bold text-tomate">“{item.note}”</span>
                )}
              </span>
              <span className="mono text-carbon/60">{price(item.total)}</span>
            </li>
          ))}
        </ul>

        {(Number(order.discount) > 0 || Number(order.delivery_fee) > 0 || Number(order.points_discount) > 0) && (
          <div className="mt-3 flex flex-col gap-1 text-sm">
            {(order.deals || []).map((d) => (
              <span key={d.label} className="mono normal-case text-albahaca">
                Oferta: {d.count > 1 ? `${d.count}× ` : ''}{d.label} por {price(d.price)}
              </span>
            ))}
            {Number(order.discount) > 0 && (
              <span className="flex justify-between text-albahaca font-semibold">
                <span>Descuento recogida</span><span className="mono">−{price(order.discount)}</span>
              </span>
            )}
            {Number(order.points_discount) > 0 && (
              <span className="flex justify-between text-albahaca font-semibold">
                <span>Puntos Club Nonno ({order.points_redeemed})</span><span className="mono">−{price(order.points_discount)}</span>
              </span>
            )}
            {Number(order.delivery_fee) > 0 && (
              <span className="flex justify-between text-carbon/70">
                <span>Envío {order.delivery_zone}</span><span className="mono">+{price(order.delivery_fee)}</span>
              </span>
            )}
          </div>
        )}

        <div className="mt-4 border-t border-tomate/25 pt-4 flex flex-col gap-1 text-sm">
          <span className="font-semibold text-carbon">{order.customer_name}</span>
          <a href={`tel:${order.customer_phone}`} className="flex items-center gap-1.5 text-carbon/70 hover:text-tomate transition-colors">
            <Phone className="w-3.5 h-3.5" /> {order.customer_phone}
          </a>
          {order.address && (
            <span className="flex items-start gap-1.5 text-carbon/70">
              <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <span>
                {order.address}{order.delivery_zone ? ` · ${order.delivery_zone}` : ''}
                {order.delivery_lat != null && (
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${order.delivery_lat},${order.delivery_lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 font-semibold text-tomate underline"
                  >
                    Ver en el mapa
                  </a>
                )}
              </span>
            </span>
          )}
          {order.mode === 'delivery' && order.delivery_verified === false && (
            <span className="rounded-md border border-horno bg-horno/10 px-3 py-2 text-sm font-semibold text-horno">
              Dirección sin verificar: el cliente eligió la distancia a mano. Confírmala por teléfono.
            </span>
          )}
          {order.notes && (
            <span className="mt-1 rounded-md border border-tomate/25 bg-queso/50 px-3 py-2 text-carbon/80">
              <strong>Notas:</strong> {order.notes}
            </span>
          )}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {order.mode === 'pickup' && (
            <button
              onClick={() => onStatus(order.id, null, { paymentStatus: order.payment_status === 'pagado' ? 'pendiente' : 'pagado' })}
              disabled={busy}
              className="btn border border-tomate bg-transparent text-tomate px-5 disabled:opacity-50"
              title="Cambiar estado de pago"
            >
              <span className="btn-layer bg-tomate/10" />
              <span className="btn-label">
                <CircleDollarSign className="w-4 h-4" />
                {order.payment_status === 'pagado' ? 'MARCAR PENDIENTE' : 'MARCAR PAGADO'}
              </span>
            </button>
          )}

          {step.next && (
            <button
              onClick={() => onStatus(order.id, step.next)}
              disabled={busy}
              className="btn flex-1 min-w-[10rem] bg-forno text-crema disabled:opacity-50"
            >
              <span className="btn-layer bg-tomate" />
              <span className="btn-label">{step.action}</span>
            </button>
          )}

          <button
            onClick={() => { printTicket(order); onStatus(order.id, null, { printed: true }) }}
            className="btn border border-tomate bg-transparent text-tomate px-5"
            title="Imprimir comanda de cocina"
          >
            <span className="btn-layer bg-tomate/10" />
            <span className="btn-label">
              <Printer className="w-4 h-4" />
              {order.printed_at ? 'REIMPRIMIR COMANDA' : 'IMPRIMIR COMANDA'}
            </span>
          </button>

          {isOpen && (
            <button
              onClick={() => onStatus(order.id, 'cancelado')}
              disabled={busy}
              className="mono normal-case px-3 text-carbon/40 hover:text-tomate transition-colors"
            >
              Cancelar
            </button>
          )}
        </div>
      </div>
    </article>
  )
}
