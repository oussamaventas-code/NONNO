import { useCallback, useEffect, useState } from 'react'
import { Map as MapIcon, Printer, Send, Phone, AlertTriangle, Undo2, Banknote, CreditCard, Check, Truck, UserPlus, Trash2, Smartphone } from 'lucide-react'
import { getLocation } from '../data/locations'
import { planTrips, bestOrder, tripTimes, mapsRouteUrl } from '../lib/routes'
import { hourOf } from '../lib/kitchenSlots'
import { price } from '../lib/format'
import { routeAction, updateOrder, fetchDrivers, saveDriver, removeDriver } from './api'
import { printDocument, esc } from './printTicket'

/* ═══════════════════════════════════════════════════════════════
   REPARTO  (vive dentro del mostrador; `part` dice qué trozo pintar)
     salir        → "A domicilio · por salir": el sistema agrupa los
                    pedidos en salidas y ordena las paradas. Se elige
                    quién lo lleva y sale. No espera a ningún "listo":
                    la cocina trabaja con la comanda en papel.
     calle        → repartidores en la calle y lo que tienen que cobrar
     repartidores → alta de repartidores y sus PIN (Encargado)
   Si la sede tiene repartidores dados de alta, al salir se elige quién
   la lleva: esas paradas le salen en su móvil (/repartidor) y él las
   marca entregadas y cobradas escaneando el QR del ticket.
   ═══════════════════════════════════════════════════════════════ */

const isOpen = (o) => !['entregado', 'cancelado'].includes(o.status)
const km1 = (n) => `${Number(n).toLocaleString('es-ES', { maximumFractionDigits: 1 })} km`

export default function Routes({ orders, locationIds, onSaved, onError, part = 'salir', footer = null }) {
  const locId = locationIds.find((id) => getLocation(id)?.services.delivery)
  const [busy, setBusy] = useState(null)
  const [drivers, setDrivers] = useState([])
  const [driversOff, setDriversOff] = useState(false)

  const loadDrivers = useCallback(async () => {
    if (!locId) return
    try {
      setDrivers((await fetchDrivers(locId)).drivers)
      setDriversOff(false)
    } catch (err) {
      /* Sin supabase/repartidores.sql: el reparto sigue como siempre */
      if (err.status === 503) setDriversOff(err.message)
    }
  }, [locId])
  useEffect(() => { loadDrivers() }, [loadDrivers])

  if (!locId) {
    return part === 'repartidores'
      ? <p className="py-16 text-center font-serif italic font-semibold text-lg text-tomate">Esta sede no hace reparto a domicilio.</p>
      : null
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

  const dispatch = (trip, driverId) => run(trip.id, async () => {
    const { orders: updated } = await routeAction(locId, 'dispatch', { ids: trip.stops.map((s) => s.id), ...(driverId ? { driverId } : {}) })
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

  if (part === 'repartidores') {
    return <Drivers locId={locId} drivers={drivers} off={driversOff} onChange={setDrivers} onError={onError} />
  }

  if (part === 'calle') {
    return (
      <section className="flex flex-col gap-4 min-w-0">
        <ColumnTitle Icon={Truck} count={onRoad.length} hint="Lo que lleva cada repartidor y lo que tiene que traer. Al final, la caja.">Repartidores en la calle</ColumnTitle>
        {onRoad.length === 0 && <p className="rounded-md border border-dashed border-carbon/30 py-6 text-center text-carbon/60">Nadie en la calle ahora mismo.</p>}
        {onRoad.map((route) => {
          const toCollect = route.stops.filter((s) => s.payment_status !== 'pagado').reduce((n, s) => n + Number(s.total || 0), 0)
          return (
            <TripCard
              key={route.routeId}
              trip={route}
              origin={origin}
              title={route.stops[0]?.driver_name || 'Reparto'}
              header={`Salió a las ${hourOf(route.departAt)} · quedan ${route.stops.length} · ${toCollect ? `a cobrar ${price(toCollect)}` : 'todo pagado'}`}
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
                <a href={mapsRouteUrl(origin, route.stops)} target="_blank" rel="noopener noreferrer" className="ptab soft"><MapIcon className="w-4 h-4" /> Mapa</a>
                <button onClick={() => undo(route)} disabled={busy === route.routeId} className="ptab soft"><Undo2 className="w-4 h-4" /> No ha salido</button>
              </div>
            </TripCard>
          )
        })}
        {footer}
      </section>
    )
  }

  /* part === 'salir' */
  return (
    <section className="flex flex-col gap-4 min-w-0">
      <ColumnTitle Icon={Truck} count={trips.reduce((n, t) => n + t.stops.length, 0)} tone="horno" hint="Cuando el repartidor se vaya, pulsa «Sale» con su nombre.">A domicilio · por salir</ColumnTitle>
      {trips.length === 0 && <p className="rounded-md border border-dashed border-carbon/30 py-6 text-center text-carbon/60">Ningún domicilio esperando.</p>}
      {trips.map((trip, n) => (
        <TripCard
          key={trip.id}
          title={trips.length > 1 ? `Salida ${n + 1}` : 'Salida'}
          trip={trip}
          origin={origin}
          header={trip.verified
            ? `Hacia las ${hourOf(trip.departAt)} · ${trip.stops.length} parada${trip.stops.length > 1 ? 's' : ''} · ${km1(trip.km)}`
            : `Hacia las ${hourOf(trip.departAt)} · dirección sin ubicar`}
        >
          {drivers.length > 0 ? (
            <>
              <p className="mono normal-case text-carbon/70 mb-1.5">¿Quién lo lleva?</p>
              <div className="flex flex-wrap gap-2">
                {drivers.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => dispatch(trip, d.id)}
                    disabled={busy === trip.id}
                    className="pbig flex-1 min-w-[8rem] bg-horno"
                  >
                    {busy === trip.id ? 'Guardando…' : `Sale ${d.name}`}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <button onClick={() => dispatch(trip)} disabled={busy === trip.id} className="pbig w-full bg-horno">
              <Send className="w-5 h-5" /> {busy === trip.id ? 'Guardando…' : 'Sale el reparto'}
            </button>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            <a href={mapsRouteUrl(origin, trip.stops)} target="_blank" rel="noopener noreferrer" className="ptab soft"><MapIcon className="w-4 h-4" /> Mapa</a>
            <button onClick={() => printSheet(trip)} className="ptab soft"><Printer className="w-4 h-4" /> Hoja de ruta</button>
          </div>
        </TripCard>
      ))}
    </section>
  )
}

/** Cabecera de columna del mostrador: título, icono y cuántos hay. */
const TONES = {
  tomate: ['border-tomate', 'bg-tomate'],
  horno: ['border-horno', 'bg-horno'],
  carbon: ['border-carbon', 'bg-carbon'],
}
/** Título de columna con su cuenta y, debajo, qué se hace en ella (para quien empieza). */
export function ColumnTitle({ Icon, count, tone = 'carbon', hint, children }) {
  const [border, bg] = TONES[tone]
  return (
    <div className={['border-b-[3px] pb-2', border].join(' ')}>
      <h2 className="flex items-center gap-2.5 font-sans font-extrabold uppercase tracking-wide text-lg text-carbon">
        {Icon && <Icon className="w-5 h-5" />}
        <span className="flex-1">{children}</span>
        <span className={['rounded-md px-2 font-mono text-base leading-7 text-papel', bg].join(' ')}>{count}</span>
      </h2>
      {hint && <p className="mt-0.5 text-sm text-carbon/60">{hint}</p>}
    </div>
  )
}

/* ── Repartidores de la sede: nombre + PIN de 4 cifras para su portal ── */
function Drivers({ locId, drivers, off, onChange, onError }) {
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [editing, setEditing] = useState(null) // id al que se le cambia el PIN
  const [busy, setBusy] = useState(false)

  const act = async (fn) => {
    setBusy(true)
    try { onChange((await fn()).drivers); return true } catch (err) { onError(err.message); return false } finally { setBusy(false) }
  }
  const add = async (e) => {
    e.preventDefault()
    if (await act(() => saveDriver(locId, { name, pin }))) { setName(''); setPin('') }
  }
  const digits = (v) => v.replace(/\D/g, '').slice(0, 4)

  return (
    <section className="pcard p-5">
      <h2 className="font-sans font-extrabold uppercase text-xl text-tomate flex items-center gap-2"><Smartphone className="w-5 h-5" /> Repartidores</h2>
      <p className="mono normal-case text-carbon/60 mt-1">
        Cada uno entra desde su móvil en <strong className="text-carbon">{window.location.host}/repartidor</strong> con su PIN. Al llegar escanea el QR del ticket y marca entregado y cobrado (efectivo o tarjeta).
      </p>
      {off ? (
        <p className="palert mt-3">{off}</p>
      ) : (
        <>
          <ul className="mt-4 flex flex-col gap-2">
            {drivers.length === 0 && <li className="text-carbon/60">Aún no hay repartidores. Da de alta al primero abajo.</li>}
            {drivers.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-tomate/30 px-3 py-2">
                <span className="font-bold text-carbon">{d.name}</span>
                {editing === d.id ? (
                  <form
                    onSubmit={async (e) => { e.preventDefault(); if (await act(() => saveDriver(locId, { id: d.id, name: d.name, pin: newPin }))) { setEditing(null); setNewPin('') } }}
                    className="flex gap-2"
                  >
                    <input value={newPin} onChange={(e) => setNewPin(digits(e.target.value))} inputMode="numeric" placeholder="PIN nuevo" aria-label="PIN nuevo" className="pfield !py-1.5 w-28 text-sm" autoFocus />
                    <button disabled={busy || newPin.length !== 4} className="ptab soft disabled:opacity-40">Guardar</button>
                    <button type="button" onClick={() => { setEditing(null); setNewPin('') }} className="ptab soft">No</button>
                  </form>
                ) : (
                  <span className="flex gap-2">
                    <button onClick={() => { setEditing(d.id); setNewPin('') }} className="ptab soft">Cambiar PIN</button>
                    <button
                      onClick={() => { if (window.confirm(`¿Dar de baja a ${d.name}? Ya no podrá entrar en el portal.`)) act(() => removeDriver(d.id)) }}
                      className="ptab soft" aria-label={`Dar de baja a ${d.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ul>
          <form onSubmit={add} className="mt-4 flex flex-wrap items-end gap-2">
            <label className="flex-1 min-w-[9rem]">
              <span className="mono normal-case text-xs text-carbon/60">Nombre</span>
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} className="mt-1 pfield !py-2 text-sm" />
            </label>
            <label className="w-28">
              <span className="mono normal-case text-xs text-carbon/60">PIN (4 cifras)</span>
              <input value={pin} onChange={(e) => setPin(digits(e.target.value))} inputMode="numeric" className="mt-1 pfield !py-2 text-sm" />
            </label>
            <button disabled={busy || !name.trim() || pin.length !== 4} className="ptab disabled:opacity-40"><UserPlus className="w-4 h-4" /> Dar de alta</button>
          </form>
        </>
      )}
    </section>
  )
}

function TripCard({ title, trip, header, stopActions, children }) {
  return (
    <article className="pcard pc-navy p-4">
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
    <button onClick={onClick} disabled={disabled} className="pbig !min-h-[44px] !text-sm bg-carbon !px-3">
      <Icon className="w-3.5 h-3.5" /> {children}
    </button>
  )
}
