import { useState } from 'react'
import { Map as MapIcon, Printer, Send, Phone, AlertTriangle, Undo2, Banknote, CreditCard, Check, Truck } from 'lucide-react'
import { getLocation } from '../data/locations'
import { planTrips, bestOrder, tripTimes, mapsRouteUrl } from '../lib/routes'
import { hourOf } from '../lib/kitchenSlots'
import { price } from '../lib/format'
import { routeAction, updateOrder } from './api'
import { printDocument, esc } from './printTicket'

/* ═══════════════════════════════════════════════════════════════
   REPARTO
   "Por salir": el sistema agrupa los pedidos a domicilio en salidas
   y ordena las paradas. "Sale el reparto" las fija, avisa por SMS y
   pasan a "En reparto", donde se marcan entregadas (y cobradas).
   ═══════════════════════════════════════════════════════════════ */

const isOpen = (o) => !['entregado', 'cancelado'].includes(o.status)
const km1 = (n) => `${Number(n).toLocaleString('es-ES', { maximumFractionDigits: 1 })} km`

export default function Routes({ orders, locationIds, onSaved, onError }) {
  const locId = locationIds.find((id) => getLocation(id)?.services.delivery)
  const [busy, setBusy] = useState(null)

  if (!locId) {
    return <p className="py-16 text-center font-serif italic font-semibold text-lg text-tomate">Esta sede no hace reparto a domicilio.</p>
  }

  const { origin, routing: cfg } = getLocation(locId).delivery
  const delivery = orders.filter((o) => o.location_id === locId && o.mode === 'delivery' && isOpen(o))
  const trips = planTrips(delivery.filter((o) => !o.dispatched_at), origin, cfg)

  /* Salidas ya en la calle, agrupadas por route_id. */
  const onRoad = Object.values(delivery.filter((o) => o.dispatched_at).reduce((acc, o) => {
    (acc[o.route_id] ||= []).push(o)
    return acc
  }, {})).map((stops) => {
    const located = stops.filter((s) => s.delivery_lat != null)
    const ordered = [...bestOrder(origin, located).order, ...stops.filter((s) => s.delivery_lat == null)]
    const departAt = Date.parse(stops[0].dispatched_at)
    return { routeId: stops[0].route_id, stops: ordered, ...tripTimes(origin, ordered, cfg, departAt) }
  }).sort((a, b) => a.departAt - b.departAt)

  const run = async (key, fn) => {
    setBusy(key)
    try { await fn() } catch (err) { onError(err.message) } finally { setBusy(null) }
  }

  const dispatch = (trip) => run(trip.id, async () => {
    const { orders: updated } = await routeAction(locId, 'dispatch', { ids: trip.stops.map((s) => s.id) })
    updated.forEach(onSaved)
  })

  const undo = (route) => run(route.routeId, async () => {
    const { orders: updated } = await routeAction(locId, 'undo', { routeId: route.routeId })
    updated.forEach(onSaved)
  })

  const deliver = (order, method) => run(order.id, async () => {
    const body = { status: 'entregado' }
    if (method) Object.assign(body, { paymentStatus: 'pagado', paymentMethod: method })
    const { order: updated } = await updateOrder(order.id, body)
    onSaved(updated)
  })

  const printSheet = (trip) => {
    const rows = trip.stops.map((s, i) => `
      <div class="rule"></div>
      <div class="big">${i + 1}. ${esc(s.ref)}</div>
      <div class="field"><strong>${esc(s.customer_name)}</strong> · Tel: ${esc(s.customer_phone || '-')}</div>
      <div class="field">${esc(s.address || '')}</div>
      ${s.delivery_verified === false ? '<div class="field"><strong>DIRECCIÓN SIN VERIFICAR · LLAMAR</strong></div>' : ''}
      ${trip.etas[i] ? `<div class="field">Llega hacia las ${esc(hourOf(trip.etas[i]))}</div>` : ''}
      ${s.notes ? `<div class="field">Notas: ${esc(s.notes)}</div>` : ''}
      <div class="payment">${s.payment_status === 'pagado' ? 'YA PAGADO' : `COBRAR ${esc(price(s.total))}`}</div>`).join('')
    const toCollect = trip.stops.filter((s) => s.payment_status !== 'pagado').reduce((n, s) => n + Number(s.total), 0)
    printDocument('Hoja de ruta', `
      <div class="center"><h1>HOJA DE RUTA</h1><div>Sale hacia las ${esc(hourOf(trip.departAt))} · ${trip.stops.length} parada(s)</div></div>
      ${rows}
      <div class="rule"></div>
      <div class="total"><span>A COBRAR</span><span>${esc(price(toCollect))}</span></div>`)
  }

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="font-sans font-extrabold uppercase text-xl text-tomate">Por salir</h2>
        <p className="mono normal-case text-carbon/55 mt-1">
          Agrupados por hora y cercanía, máximo {cfg.maxStops} paradas por salida. El orden de paradas es el más corto.
        </p>
        {trips.length === 0 ? (
          <p className="mt-6 font-serif italic font-semibold text-lg text-tomate">No hay repartos pendientes.</p>
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {trips.map((trip, n) => {
              const notReady = trip.stops.filter((s) => s.status !== 'listo')
              return (
                <TripCard
                  key={trip.id}
                  title={`Salida ${n + 1}`}
                  trip={trip}
                  origin={origin}
                  header={trip.verified
                    ? `Sale hacia las ${hourOf(trip.departAt)} · ${trip.stops.length} parada(s) · ${km1(trip.km)} · ~${trip.minutes} min`
                    : `Sale hacia las ${hourOf(trip.departAt)} · dirección sin ubicar`}
                >
                  <div className="flex flex-wrap gap-2">
                    <a href={mapsRouteUrl(origin, trip.stops)} target="_blank" rel="noopener noreferrer" className="btn border border-tomate bg-transparent text-tomate px-4">
                      <span className="btn-layer bg-tomate/10" />
                      <span className="btn-label"><MapIcon className="w-4 h-4" /> GOOGLE MAPS</span>
                    </a>
                    <button onClick={() => printSheet(trip)} className="btn border border-tomate bg-transparent text-tomate px-4">
                      <span className="btn-layer bg-tomate/10" />
                      <span className="btn-label"><Printer className="w-4 h-4" /> HOJA DE RUTA</span>
                    </button>
                    <button
                      onClick={() => dispatch(trip)}
                      disabled={busy === trip.id || notReady.length > 0}
                      title={notReady.length ? `Espera a que cocina marque listo: ${notReady.map((s) => s.ref).join(', ')}` : undefined}
                      className="btn flex-1 min-w-[11rem] bg-tomate text-crema disabled:opacity-50"
                    >
                      <span className="btn-layer bg-horno" />
                      <span className="btn-label">
                        <Send className="w-4 h-4" />
                        {busy === trip.id ? 'GUARDANDO…' : notReady.length ? 'FALTA POR HORNEAR' : 'SALE EL REPARTO'}
                      </span>
                    </button>
                  </div>
                </TripCard>
              )
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-sans font-extrabold uppercase text-xl text-tomate flex items-center gap-2">
          <Truck className="w-5 h-5 text-horno" /> En reparto
        </h2>
        {onRoad.length === 0 ? (
          <p className="mt-3 font-serif italic font-semibold text-lg text-tomate">Nadie en la calle ahora mismo.</p>
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {onRoad.map((route) => (
              <TripCard
                key={route.routeId}
                title="En la calle"
                trip={route}
                origin={origin}
                header={`Salió a las ${hourOf(route.departAt)} · quedan ${route.stops.length} parada(s)`}
                stopActions={(s) => (
                  s.payment_status === 'pagado' ? (
                    <SmallButton onClick={() => deliver(s)} disabled={busy === s.id} icon={Check}>Entregado</SmallButton>
                  ) : (
                    <>
                      <SmallButton onClick={() => deliver(s, 'efectivo')} disabled={busy === s.id} icon={Banknote}>Entregado · efectivo</SmallButton>
                      <SmallButton onClick={() => deliver(s, 'tarjeta')} disabled={busy === s.id} icon={CreditCard}>Entregado · tarjeta</SmallButton>
                    </>
                  )
                )}
              >
                <div className="flex flex-wrap gap-2">
                  <a href={mapsRouteUrl(origin, route.stops)} target="_blank" rel="noopener noreferrer" className="btn border border-tomate bg-transparent text-tomate px-4">
                    <span className="btn-layer bg-tomate/10" />
                    <span className="btn-label"><MapIcon className="w-4 h-4" /> GOOGLE MAPS</span>
                  </a>
                  <button onClick={() => undo(route)} disabled={busy === route.routeId} className="mono normal-case flex items-center gap-1.5 px-3 text-carbon/45 hover:text-tomate">
                    <Undo2 className="w-3.5 h-3.5" /> Deshacer salida
                  </button>
                </div>
              </TripCard>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function TripCard({ title, trip, header, stopActions, children }) {
  return (
    <article className="pcard p-5">
      <p className="mono text-tomate">{title.toUpperCase()}</p>
      <p className="mt-1 font-sans font-bold text-carbon">{header}</p>
      <ol className="mt-4 flex flex-col gap-3">
        {trip.stops.map((s, i) => (
          <li key={s.id} className="flex gap-3">
            <span className="w-7 h-7 flex-shrink-0 rounded-full bg-tomate text-masa flex items-center justify-center text-sm font-bold">{i + 1}</span>
            <div className="flex-1 min-w-0 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-mono font-bold text-carbon">{s.ref} · <span className="font-sans">{s.customer_name}</span></span>
                <span className={['font-semibold', s.payment_status === 'pagado' ? 'text-albahaca' : 'text-tomate'].join(' ')}>
                  {s.payment_status === 'pagado' ? 'Pagado' : `Cobrar ${price(s.total)}`}
                </span>
              </div>
              <p className="text-carbon/70">{s.address}</p>
              <p className="mono normal-case text-carbon/50 flex flex-wrap gap-x-3">
                {trip.etas[i] && <span>llega ~{hourOf(trip.etas[i])}</span>}
                {s.delivery_zone && <span>{s.delivery_zone}</span>}
                {s.customer_phone && (
                  <a href={`tel:${s.customer_phone}`} className="flex items-center gap-1 text-carbon/70 hover:text-tomate"><Phone className="w-3 h-3" />{s.customer_phone}</a>
                )}
              </p>
              {s.delivery_verified === false && (
                <p className="mt-1 flex items-center gap-1.5 text-horno font-semibold"><AlertTriangle className="w-3.5 h-3.5" /> Dirección sin verificar: llama antes de salir</p>
              )}
              {s.status !== 'listo' && !s.dispatched_at && (
                <p className="mt-1 text-horno">Aún {s.status === 'horno' ? 'en el horno' : 'sin empezar'}</p>
              )}
              {stopActions && <div className="mt-2 flex flex-wrap gap-2">{stopActions(s)}</div>}
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-5">{children}</div>
    </article>
  )
}

function SmallButton({ onClick, disabled, icon: Icon, children }) {
  return (
    <button onClick={onClick} disabled={disabled} className="flex items-center gap-1.5 rounded-md bg-forno text-masa px-3 py-1.5 text-xs font-semibold uppercase tracking-wide disabled:opacity-50">
      <Icon className="w-3.5 h-3.5" /> {children}
    </button>
  )
}
