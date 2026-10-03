import { useEffect, useRef, useState } from 'react'
import { Plus, Phone, Printer, Pencil, Euro, Truck, Package, Store, Clock, PackageCheck, CalendarClock, Search, X, Globe, ChevronDown, Undo2 } from 'lucide-react'
import { price } from '../lib/format'
import { hourOf } from '../lib/kitchenSlots'
import { updateOrder } from './api'
import { printReceipt } from './printTicket'
import { useOrderAlert } from './useOrderAlert'
import OrderEditor from './OrderEditor'
import ChargeDialog from './ChargeDialog'

/* ═══════════════════════════════════════════════════════════════
   TPV DEL MOSTRADOR
   Los pedidos de la sede agrupados por lo que hay que HACER con ellos:
     LISTOS PARA ENTREGAR → arriba, en verde; suena al salir de cocina
     EN COCINA            → con lo que les falta
     ENTREGADOS SIN COBRAR → para que no se escape ninguno
   Lo ya cerrado (cobrado y entregado, cancelado) queda plegado abajo.
   Cobrar un pedido LISTO de recogida lo da también por entregado: si
   se cobra en el mostrador es que el cliente se lo lleva.
   ═══════════════════════════════════════════════════════════════ */

const CHANNEL = {
  web: { label: 'Web', Icon: Globe },
  mostrador: { label: 'Mostrador', Icon: Store },
  telefono: { label: 'Teléfono', Icon: Phone },
}

const UNDO_MS = 10000

const isActive = (o) => !['entregado', 'cancelado'].includes(o.status)
const isToday = (o) => new Date(o.created_at).toDateString() === new Date().toDateString()
const isPaid = (o) => o.payment_status === 'pagado'
const inKitchen = (o) => ['nuevo', 'horno'].includes(o.status)

/** "en 5 min", "ya", "hace 8 min" respecto a `now` */
function minutesText(iso, now) {
  const min = Math.round((Date.parse(iso) - now) / 60000)
  if (min > 0) return { future: true, text: `en ${min} min` }
  if (min === 0) return { future: true, text: 'ya' }
  return { future: false, text: `hace ${-min} min` }
}

/** El cliente dice "el 12", "Juan" o su teléfono: todo vale */
function matches(o, q) {
  const text = q.trim().toLowerCase()
  if (!text) return true
  const digits = text.replace(/\D/g, '')
  return String(o.ref || '').toLowerCase().includes(text)
    || (digits.length >= 1 && String(o.ref || '').replace(/\D/g, '').endsWith(digits) && digits.length <= 4)
    || String(o.customer_name || '').toLowerCase().includes(text)
    || (digits.length >= 3 && String(o.customer_phone || '').replace(/\D/g, '').includes(digits))
}

export default function Counter({ orders, locationIds, defaultLocationId, onSaved, onError }) {
  const [search, setSearch] = useState('')
  const [showDone, setShowDone] = useState(false)
  const [editor, setEditor] = useState(null) // { order?, channel }
  const [charging, setCharging] = useState(null) // { order, deliver }
  const [busyId, setBusyId] = useState(null)
  const [undo, setUndo] = useState(null) // { order, from, wasPaid }
  const [flash, setFlash] = useState(() => new Set())
  const [now, setNow] = useState(Date.now)
  const { ding } = useOrderAlert()

  /* Los minutos avanzan solos */
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 20000)
    return () => clearInterval(t)
  }, [])

  /* Cocina marca LISTO → suena aquí y la tarjeta parpadea unos segundos */
  const lastStatus = useRef(null)
  useEffect(() => {
    const prev = lastStatus.current
    lastStatus.current = new Map(orders.map((o) => [o.id, o.status]))
    if (!prev) return
    const ready = orders.filter((o) => o.status === 'listo' && ['nuevo', 'horno'].includes(prev.get(o.id)))
    if (!ready.length) return
    ding()
    setFlash((f) => new Set([...f, ...ready.map((o) => o.id)]))
    const t = setTimeout(() => setFlash((f) => {
      const next = new Set(f)
      ready.forEach((o) => next.delete(o.id))
      return next
    }), 12000)
    return () => clearTimeout(t)
  }, [orders, ding])

  /* Deshacer se va solo a los 10 s */
  useEffect(() => {
    if (!undo) return
    const t = setTimeout(() => setUndo(null), UNDO_MS)
    return () => clearTimeout(t)
  }, [undo])

  const today = orders.filter((o) => isToday(o) || isActive(o)).filter((o) => matches(o, search))
  const byTime = (a, b) => Date.parse(a.ready_at || a.created_at) - Date.parse(b.ready_at || b.created_at)
  const listos = today.filter((o) => o.status === 'listo').sort(byTime)
  const cocina = today.filter(inKitchen).sort(byTime)
  const sinCobrar = today.filter((o) => o.status === 'entregado' && !isPaid(o)).sort(byTime)
  const hechos = today
    .filter((o) => o.status === 'cancelado' || (o.status === 'entregado' && isPaid(o)))
    .sort((a, b) => byTime(b, a))

  const porCobrar = orders
    .filter((o) => isToday(o) && o.status !== 'cancelado' && !isPaid(o))
    .reduce((sum, o) => sum + Number(o.total || 0), 0)
  const cobradoHoy = orders
    .filter((o) => isToday(o) && isPaid(o) && o.status !== 'cancelado')
    .reduce((acc, o) => {
      acc[o.payment_method === 'tarjeta' ? 'tarjeta' : 'efectivo'] += Number(o.total || 0)
      return acc
    }, { efectivo: 0, tarjeta: 0 })

  const patch = async (order, body) => {
    setBusyId(order.id)
    try {
      const { order: updated } = await updateOrder(order.id, body)
      onSaved(updated)
      return updated
    } catch (err) {
      onError(err.message)
      return null
    } finally {
      setBusyId(null)
    }
  }

  const deliver = async (order) => {
    const updated = await patch(order, { status: 'entregado' })
    if (updated) setUndo({ order: updated, from: order.status, wasPaid: isPaid(order) })
  }

  const confirmCharge = async (method, printIt) => {
    const { order, deliver: alsoDeliver } = charging
    const body = { paymentStatus: 'pagado', paymentMethod: method, ...(alsoDeliver ? { status: 'entregado' } : {}) }
    const updated = await patch(order, body)
    if (!updated) return
    setCharging(null)
    if (printIt) printReceipt(updated)
    if (alsoDeliver) setUndo({ order: updated, from: order.status, wasPaid: isPaid(order) })
  }

  const undoLast = async () => {
    if (!undo) return
    const { order, from, wasPaid } = undo
    setUndo(null)
    await patch(order, { status: from, ...(wasPaid ? {} : { paymentStatus: 'pendiente' }) })
  }

  const empty = !listos.length && !cocina.length && !sinCobrar.length
  const card = (o, tone) => (
    <OrderRow
      key={o.id}
      o={o}
      tone={tone}
      now={now}
      flash={flash.has(o.id)}
      busy={busyId === o.id}
      onCharge={(alsoDeliver) => setCharging({ order: o, deliver: alsoDeliver })}
      onDeliver={() => deliver(o)}
      onEdit={() => setEditor({ order: o })}
      onUnpay={() => patch(o, { paymentStatus: 'pendiente' })}
    />
  )

  return (
    <div className="pb-20">
      {/* Móvil: los dos botones grandes, uno debajo de otro, a todo el ancho */}
      <div className="grid gap-3 md:flex md:flex-wrap">
        <button onClick={() => setEditor({ channel: 'mostrador' })} className="btn bg-tomate text-crema px-6 min-h-[56px] md:min-h-[48px]">
          <span className="btn-layer bg-horno" />
          <span className="btn-label"><Plus className="w-4 h-4" strokeWidth={2.5} /> NUEVO PEDIDO</span>
        </button>
        <button onClick={() => setEditor({ channel: 'telefono' })} className="btn bg-carbon text-crema px-6 min-h-[56px] md:min-h-[48px]">
          <span className="btn-layer bg-tomate" />
          <span className="btn-label"><Phone className="w-4 h-4" /> PEDIDO POR TELÉFONO</span>
        </button>
      </div>

      {/* Buscador: "el 12", "Juan", "611…" */}
      <div className="relative mt-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-carbon/40" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Nº, nombre o teléfono"
          aria-label="Buscar pedido"
          className="pfield !pl-11 !pr-11 !text-base"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-carbon/50" aria-label="Borrar búsqueda">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1">
        <span className="mono normal-case text-carbon/60">
          Por cobrar: <strong className="text-tomate">{price(porCobrar)}</strong>
        </span>
        <span className="mono normal-case text-carbon/60">
          Cobrado hoy: <strong className="text-carbon">{price(cobradoHoy.efectivo)}</strong> efectivo ·{' '}
          <strong className="text-carbon">{price(cobradoHoy.tarjeta)}</strong> tarjeta
        </span>
      </div>

      {empty && (
        <p className="py-14 text-center font-serif italic font-semibold text-lg text-tomate">
          {search ? 'Ningún pedido con esa búsqueda.' : 'No hay pedidos pendientes.'}
        </p>
      )}

      <Group title="Listos para entregar" tone="listo" count={listos.length}>{listos.map((o) => card(o, 'listo'))}</Group>
      <Group title="En cocina" tone="cocina" count={cocina.length}>{cocina.map((o) => card(o, 'cocina'))}</Group>
      <Group title="Entregados sin cobrar" tone="cobrar" count={sinCobrar.length}>{sinCobrar.map((o) => card(o, 'cobrar'))}</Group>

      {hechos.length > 0 && (
        <div className="mt-8">
          <button onClick={() => setShowDone((v) => !v)} className="ptab soft">
            <ChevronDown className={['w-4 h-4 transition-transform', showDone ? 'rotate-180' : ''].join(' ')} />
            {showDone ? 'Ocultar' : 'Ver'} cerrados hoy ({hechos.length})
          </button>
          {showDone && <ul className="mt-3 flex flex-col gap-3">{hechos.map((o) => card(o, 'hecho'))}</ul>}
        </div>
      )}

      {/* Deshacer el último "entregado" (un toque de más en hora punta) */}
      {undo && (
        <div className="fixed inset-x-3 bottom-20 md:bottom-6 z-40 mx-auto max-w-md flex items-center justify-between gap-3 rounded-md bg-forno px-4 py-3 text-masa shadow-float">
          <span className="text-sm font-semibold">{undo.order.ref} {undo.wasPaid ? 'entregado' : 'cobrado y entregado'}</span>
          <button onClick={undoLast} className="flex items-center gap-1.5 rounded-md border border-masa/40 px-3 py-1.5 text-sm font-bold uppercase">
            <Undo2 className="w-4 h-4" /> Deshacer
          </button>
        </div>
      )}

      {editor && (
        <OrderEditor
          order={editor.order}
          orders={orders}
          defaultChannel={editor.channel}
          locationIds={locationIds}
          defaultLocationId={defaultLocationId}
          onClose={() => setEditor(null)}
          onSaved={(order, { isNew }) => {
            onSaved(order, { isNew })
            setEditor(null)
          }}
        />
      )}

      {charging && (
        <ChargeDialog
          order={charging.order}
          deliver={charging.deliver}
          busy={busyId === charging.order.id}
          onClose={() => setCharging(null)}
          onConfirm={confirmCharge}
        />
      )}
    </div>
  )
}

const GROUP_TONE = {
  listo: 'text-albahaca',
  cocina: 'text-horno',
  cobrar: 'text-tomate',
}

function Group({ title, tone, count, children }) {
  if (!count) return null
  return (
    <section className="mt-7">
      <h3 className={['flex items-center gap-2 font-sans font-extrabold uppercase tracking-wide text-sm', GROUP_TONE[tone]].join(' ')}>
        <span className="inline-block w-2.5 h-2.5 rounded-full bg-current" /> {title}
        <span className="rounded-full border border-current px-2 text-xs leading-5">{count}</span>
      </h3>
      <ul className="mt-3 flex flex-col gap-3">{children}</ul>
    </section>
  )
}

/* El marco de la tarjeta toma el color de su grupo */
const STRIPE = {
  listo: 'border-l-[8px] !border-albahaca',
  cocina: 'border-l-[8px] !border-horno',
  cobrar: 'border-l-[8px] !border-tomate',
  hecho: 'opacity-70',
}

function OrderRow({ o, tone, now, flash, busy, onCharge, onDeliver, onEdit, onUnpay }) {
  const ch = CHANNEL[o.channel] || CHANNEL.web
  const paid = isPaid(o)
  const delivery = o.mode === 'delivery'
  /* Pedido tomado sin conexión, aún en la cola de este equipo:
     solo se puede reimprimir hasta que llegue al sistema. */
  const local = Boolean(o.offline)
  const active = isActive(o)
  const editable = !local && active && (o.items || []).every((i) => i.id)
  const time = o.ready_at && active ? minutesText(o.ready_at, now) : null

  /* Qué es lo más probable que haya que hacer con este pedido.
     Listo y de recogida: cobrar = entregar (un solo botón). */
  const canCharge = !local && !paid && o.status !== 'cancelado'
  const canDeliver = !local && active
  const handOver = !local && active && o.status === 'listo' && !delivery
  const primary = handOver ? (paid ? 'entregar' : 'cobrar-entregar') : canCharge ? 'cobrar' : null

  return (
    <li className={['pcard p-4 sm:p-5', STRIPE[tone] || '', flash ? 'animate-pulse ring-4 ring-albahaca' : ''].join(' ')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-baseline gap-3">
            <span className="font-mono font-bold text-2xl text-carbon">{o.ref}</span>
            <span className="truncate font-sans font-bold text-lg text-carbon">{o.customer_name}</span>
          </div>
          {/* Lo secundario en una sola línea pequeña, con iconos */}
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-carbon/60">
            <span className="flex items-center gap-1">
              {delivery ? <><Truck className="w-3.5 h-3.5" /> {o.delivery_zone || 'Reparto'}</> : <><Package className="w-3.5 h-3.5" /> Recoge</>}
            </span>
            <span className="flex items-center gap-1"><ch.Icon className="w-3.5 h-3.5" /> {ch.label}</span>
            {o.customer_phone && <span>{o.customer_phone}</span>}
            {o.scheduled_for && <span className="flex items-center gap-1 text-horno"><CalendarClock className="w-3.5 h-3.5" /> Programado</span>}
            {o.edited_at && <span className="text-horno font-semibold">Modificado</span>}
            {o.status === 'cancelado' && <span className="text-tomate font-semibold">Cancelado</span>}
            {local && <span className="rounded bg-forno px-1.5 text-masa font-semibold">SIN ENVIAR · en papel</span>}
          </p>
          <p className="mt-1.5 text-sm text-carbon/70 line-clamp-2">
            {(o.items || []).map((i) => `${i.qty}× ${i.name}`).join(', ')}
          </p>
          {time && (
            <p className={['mt-1.5 flex items-center gap-1.5 text-sm font-bold', o.status === 'listo' && !time.future ? 'text-tomate' : 'text-carbon'].join(' ')}>
              <Clock className="w-4 h-4" />
              {o.status === 'listo'
                ? (time.future ? `Listo · para las ${hourOf(o.ready_at)}` : `Esperando ${time.text}`)
                : `Listo ${time.text} (${hourOf(o.ready_at)})`}
            </p>
          )}
        </div>

        <div className="text-right flex-shrink-0">
          <p className="font-serif italic font-semibold text-3xl text-tomate">{price(o.total)}</p>
          <p className={['mono normal-case mt-1', paid ? 'text-albahaca' : 'text-tomate'].join(' ')}>
            {paid ? `Pagado · ${o.payment_method || 'efectivo'}` : 'Sin cobrar'}
          </p>
        </div>
      </div>

      {/* Acción principal, grande */}
      {primary && (
        <button
          onClick={() => (primary === 'entregar' ? onDeliver() : onCharge(primary === 'cobrar-entregar'))}
          disabled={busy}
          className="btn mt-4 w-full min-h-[56px] bg-albahaca text-crema disabled:opacity-50"
        >
          <span className="btn-layer bg-carbon" />
          <span className="btn-label text-base">
            {primary === 'entregar' && <><PackageCheck className="w-5 h-5" /> ENTREGAR</>}
            {primary === 'cobrar-entregar' && <><Euro className="w-5 h-5" /> COBRAR</>}
            {primary === 'cobrar' && <><Euro className="w-5 h-5" /> COBRAR</>}
          </span>
        </button>
      )}

      {/* El resto, pequeño */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {canDeliver && primary !== 'entregar' && primary !== 'cobrar-entregar' && (
          <button onClick={onDeliver} disabled={busy} className="ptab soft"><PackageCheck className="w-4 h-4" /> Entregado</button>
        )}
        {editable && <button onClick={onEdit} disabled={busy} className="ptab soft"><Pencil className="w-4 h-4" /> Editar</button>}
        <button onClick={() => printReceipt(o)} className="ptab soft"><Printer className="w-4 h-4" /> Ticket</button>
        {!local && paid && (
          <button onClick={onUnpay} disabled={busy} className="mono normal-case px-2 text-carbon/40 hover:text-tomate transition-colors">
            Deshacer cobro
          </button>
        )}
      </div>
    </li>
  )
}
