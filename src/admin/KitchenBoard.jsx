import { useEffect, useState } from 'react'
import { Truck, Package, Phone, MapPin, ChevronDown, Printer, Eye, Flame, AlertTriangle, Euro, CalendarClock } from 'lucide-react'
import { price } from '../lib/format'
import { hourOf } from '../lib/kitchenSlots'
import { printTicket } from './printTicket'
import SmsStatus from './SmsStatus'
import OrderCard from './OrderCard'
import CancelReasons from './CancelReasons'

/* ═══════════════════════════════════════════════════════════════
   TABLERO DE COCINA
   Tres columnas, una por fase: NUEVOS → EN EL HORNO → LISTOS.
   Cada pedido avanza con UN botón grande. Lo urgente sube arriba y
   cambia de color: amarillo cuando quedan pocos minutos, rojo cuando
   ya se ha pasado su hora. Un pedido nuevo parpadea (y suena) hasta
   que alguien lo marca como visto.
   ═══════════════════════════════════════════════════════════════ */

const COLUMNS = [
  { id: 'nuevo', title: 'NUEVOS', empty: 'Ningún pedido nuevo', next: 'horno', action: 'AL HORNO', btn: 'bg-tomate', frame: '' },
  { id: 'horno', title: 'EN EL HORNO', empty: 'Horno libre', next: 'listo', action: 'MARCAR LISTO', btn: 'bg-albahaca', frame: 'pf-horno' },
  { id: 'listo', title: 'LISTOS', empty: 'Nada esperando', next: 'entregado', action: 'ENTREGADO', btn: 'bg-forno', frame: 'pf-verde' },
]

/** Minutos que faltan para la hora del pedido (negativo = retrasado). */
const minutesLeft = (order, now) => (order.ready_at ? Math.round((Date.parse(order.ready_at) - now) / 60000) : null)

const byUrgency = (a, b) => Date.parse(a.ready_at || a.created_at) - Date.parse(b.ready_at || b.created_at)

export default function KitchenBoard({ orders, busyId, onStatus, onUpdated }) {
  /* El reloj del tablero: sin él, el semáforo se quedaría congelado
     entre dos sondeos del servidor. */
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000)
    return () => clearInterval(timer)
  }, [])

  const active = orders.filter((o) => COLUMNS.some((c) => c.id === o.status))
  const finished = orders.filter((o) => ['entregado', 'cancelado'].includes(o.status))
  const todayStr = new Date().toDateString()
  const finishedToday = finished.filter((o) => new Date(o.created_at).toDateString() === todayStr)

  return (
    <div>
      <div className="grid gap-5 lg:grid-cols-3 items-start">
        {COLUMNS.map((col) => {
          const list = active.filter((o) => o.status === col.id).sort(byUrgency)
          return (
            <section key={col.id} aria-label={col.title}>
              <h2 className="flex items-center justify-between border-b-2 border-tomate pb-2 mb-4">
                <span className="font-sans font-extrabold uppercase text-lg tracking-wide text-tomate">{col.title}</span>
                <span className="font-mono font-bold text-lg text-masa bg-tomate rounded-md min-w-[2rem] text-center px-2 leading-8">{list.length}</span>
              </h2>
              {list.length === 0 ? (
                <p className="rounded-md border border-dashed border-tomate/40 py-8 text-center font-serif italic font-semibold text-tomate/70">{col.empty}</p>
              ) : (
                <div className="flex flex-col gap-5">
                  {list.map((order) => (
                    <KitchenCard
                      key={order.id}
                      order={order}
                      col={col}
                      now={now}
                      busy={busyId === order.id}
                      onStatus={onStatus}
                      onUpdated={onUpdated}
                    />
                  ))}
                </div>
              )}
            </section>
          )
        })}
      </div>

      {finishedToday.length > 0 && (
        <details className="mt-10 group">
          <summary className="ptab soft cursor-pointer list-none w-fit">
            <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
            Terminados hoy ({finishedToday.length})
          </summary>
          <div className="mt-4 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {finishedToday.map((order) => (
              <OrderCard key={order.id} order={order} busy={busyId === order.id} onStatus={onStatus} onUpdated={onUpdated} />
            ))}
          </div>
        </details>
      )}
    </div>
  )
}

function KitchenCard({ order, col, now, busy, onStatus, onUpdated }) {
  const [more, setMore] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  const left = col.id === 'listo' ? null : minutesLeft(order, now)
  const late = left !== null && left < 0
  const soon = left !== null && left >= 0 && left <= 5
  const unseen = col.id === 'nuevo' && !order.seen_at
  const delivery = order.mode === 'delivery'
  /* Pedido programado para dentro de mucho: aparece, pero sin urgencia ni alarma */
  const farOff = Boolean(order.scheduled_for) && col.id === 'nuevo' && left !== null && left > 45

  return (
    <article
      className={[
        'pframe',
        col.frame,
        late ? '!bg-tomate/10' : '',
        unseen ? 'ring-4 ring-tomate/60 ring-offset-2 ring-offset-masa animate-pulse' : '',
      ].join(' ')}
    >
      {farOff && (
        <p className="flex items-center justify-center gap-2 rounded-t-md bg-queso py-1.5 font-sans font-extrabold uppercase text-sm tracking-wide text-carbon border-b border-tomate">
          <CalendarClock className="w-4 h-4" /> Programado · en {left >= 90 ? `${Math.floor(left / 60)} h ${left % 60} min` : `${left} min`}
        </p>
      )}
      {!farOff && (late || soon) && (
        <p className={[
          'flex items-center justify-center gap-2 rounded-t-md py-1.5 font-sans font-extrabold uppercase text-sm tracking-wide',
          late ? 'bg-tomate text-masa' : 'bg-queso text-carbon border-b border-tomate',
        ].join(' ')}>
          <AlertTriangle className="w-4 h-4" />
          {late ? `Retrasado ${-left} min` : left === 0 ? 'Sale ahora' : `Sale en ${left} min`}
        </p>
      )}

      <div className="pframe-in p-4">
        {/* Qué es y para cuándo */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono font-extrabold text-2xl text-carbon leading-none">{order.ref}</p>
            {order.ready_at && (
              <p className="mt-2 flex items-center gap-1.5 font-sans font-extrabold uppercase text-xl text-tomate leading-none">
                <Flame className="w-5 h-5" /> Horno {hourOf(order.ready_at)}
              </p>
            )}
            {delivery && order.eta_at && (
              <p className="mt-1 mono normal-case text-carbon/60">llega hacia las {hourOf(order.eta_at)}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            <span className="pchip !border-tomate !text-tomate">
              {delivery ? <><Truck className="w-3.5 h-3.5" /> Entrega</> : <><Package className="w-3.5 h-3.5" /> Recogida</>}
            </span>
            {order.channel && order.channel !== 'web' && (
              <span className="pchip">{order.channel === 'telefono' ? 'Teléfono' : 'Mostrador'}</span>
            )}
            {order.scheduled_for && !farOff && <span className="pchip"><CalendarClock className="w-3.5 h-3.5" /> Programado</span>}
            {order.edited_at && (
              <span className="pchip !border-transparent bg-horno !text-crema">Modificado {hourOf(order.edited_at)}</span>
            )}
          </div>
        </div>

        {/* Lo que hay que hacer: lo más grande de la tarjeta */}
        <ul className="mt-4 flex flex-col gap-3 border-t border-tomate/30 pt-4">
          {(order.items || []).map((item, i) => (
            <li key={i} className="flex gap-3">
              <span className="font-mono font-extrabold text-3xl text-tomate leading-none w-11 flex-shrink-0">{item.qty}×</span>
              <span className="flex-1 min-w-0">
                <span className="block font-sans font-extrabold uppercase text-xl text-carbon leading-tight">{item.name}</span>
                {item.size && <span className="mono normal-case text-carbon/55">{item.size}</span>}
                {item.removed?.length > 0 && (
                  <span className="mt-1 flex flex-wrap gap-1">
                    {item.removed.map((r) => (
                      <span key={r} className="rounded-md bg-tomate px-2 py-0.5 text-sm font-extrabold uppercase text-masa">Sin {r}</span>
                    ))}
                  </span>
                )}
                {item.extras?.length > 0 && (
                  <span className="mt-1 flex flex-wrap gap-1">
                    {item.extras.map((x) => (
                      <span key={x} className="rounded-md border border-tomate px-2 py-0.5 text-sm font-bold text-tomate">+ {x}</span>
                    ))}
                  </span>
                )}
                {item.note && <span className="mt-1 block text-base font-bold text-tomate">“{item.note}”</span>}
              </span>
            </li>
          ))}
        </ul>

        {order.notes && (
          <p className="mt-3 rounded-md border border-tomate/40 bg-queso/60 px-3 py-2 text-sm font-semibold text-carbon">
            <span className="mono normal-case text-tomate">Nota: </span>{order.notes}
          </p>
        )}

        {/* Acción principal */}
        <div className="mt-4 flex flex-col gap-2">
          {unseen && (
            <button
              onClick={() => onStatus(order.id, null, { seen: true })}
              disabled={busy}
              className="btn w-full border border-tomate bg-queso text-carbon min-h-[52px] animate-pulse disabled:opacity-50"
            >
              <span className="btn-label"><Eye className="w-5 h-5" /> VISTO (PARA LA ALARMA)</span>
            </button>
          )}
          <button
            onClick={() => onStatus(order.id, col.next, order.seen_at ? {} : { seen: true })}
            disabled={busy}
            className={`btn w-full ${col.btn} text-crema min-h-[60px] text-base disabled:opacity-50`}
          >
            <span className="btn-layer bg-forno" />
            <span className="btn-label">{col.action}</span>
          </button>
        </div>

        {/* Lo demás, a un toque */}
        <button
          onClick={() => setMore((m) => !m)}
          aria-expanded={more}
          className="mt-3 flex w-full items-center justify-between rounded-md px-1 py-1 mono normal-case text-tomate"
        >
          <span>{order.customer_name} · {price(order.total)}
            {order.mode === 'pickup' && (order.payment_status === 'pagado' ? ' · pagado' : ' · por pagar')}
          </span>
          <ChevronDown className={['w-4 h-4 transition-transform', more ? 'rotate-180' : ''].join(' ')} />
        </button>

        {more && (
          <div className="mt-2 flex flex-col gap-2 border-t border-tomate/30 pt-3 text-sm">
            <a href={`tel:${order.customer_phone}`} className="flex items-center gap-1.5 font-semibold text-carbon hover:text-tomate">
              <Phone className="w-4 h-4" /> {order.customer_phone}
            </a>
            {order.address && (
              <span className="flex items-start gap-1.5 text-carbon/80">
                <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
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
            {delivery && order.delivery_verified === false && (
              <span className="rounded-md border border-horno bg-horno/10 px-3 py-2 font-semibold text-horno">
                Dirección sin verificar: confírmala por teléfono.
              </span>
            )}
            <p className="flex items-center gap-1.5 text-carbon/70">
              <Euro className="w-4 h-4" />
              {price(order.total)} · {order.payment_status === 'pagado' ? 'Pagado' : 'Falta por pagar'}
            </p>
            <SmsStatus order={order} onUpdated={onUpdated} />

            <div className="mt-1 flex flex-wrap items-center gap-2">
              <button
                onClick={() => { printTicket(order); onStatus(order.id, null, { printed: true }) }}
                className="ptab soft"
              >
                <Printer className="w-4 h-4" /> {order.printed_at ? 'Reimprimir comanda' : 'Imprimir comanda'}
              </button>
              {cancelling ? (
                <CancelReasons
                  disabled={busy}
                  onBack={() => setCancelling(false)}
                  onPick={(cancelReason) => { setCancelling(false); onStatus(order.id, 'cancelado', { cancelReason }) }}
                />
              ) : (
                <button onClick={() => setCancelling(true)} className="mono normal-case px-2 text-carbon/50 hover:text-tomate">
                  Cancelar pedido
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </article>
  )
}
