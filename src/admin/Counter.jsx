import { useEffect, useState } from 'react'
import { Plus, Phone, Printer, Pencil, Search, X, Globe, Store, ChevronDown, Undo2, ShoppingBag, Truck, Wallet, BellRing, Ban, CalendarClock, MonitorCheck } from 'lucide-react'
import { price } from '../lib/format'
import { hourOf } from '../lib/kitchenSlots'
import { updateOrder } from './api'
import { printReceipt, printTicket } from './printTicket'
import { isThisServiceDay } from '../lib/orderNumber'
import OrderEditor from './OrderEditor'
import ChargeDialog from './ChargeDialog'
import CancelReasons from './CancelReasons'
import Routes, { ColumnTitle } from './Routes'

/* ═══════════════════════════════════════════════════════════════
   MOSTRADOR — la pantalla del local, todo en una
   La cocina trabaja con la comanda en papel y no toca el panel, así
   que aquí no se espera a ningún "listo": cada pedido tiene UNA cosa
   que hacer y un botón grande para hacerla.

     PARA RECOGER        → Cobrar y entregar (o Entregar si ya pagó)
     A DOMICILIO         → elegir quién lo lleva y "Sale"
     EN LA CALLE + CAJA  → qué lleva cada repartidor y cerrar la caja

   El dinero entra solo por dos sitios: este mostrador y el repartidor.
   En el móvil las tres columnas son tres pestañas.
   ═══════════════════════════════════════════════════════════════ */

const CHANNEL = {
  web: { label: 'Web', Icon: Globe },
  mostrador: { label: 'Mostrador', Icon: Store },
  telefono: { label: 'Teléfono', Icon: Phone },
}

const UNDO_MS = 10000
/* Programado para dentro de más de esto: se ve, pero aún no apremia */
const FAR_MIN = 45

const isActive = (o) => !['entregado', 'cancelado'].includes(o.status)
const isPaid = (o) => o.payment_status === 'pagado'
const isDelivery = (o) => o.mode === 'delivery'
const byTime = (a, b) => Date.parse(a.ready_at || a.created_at) - Date.parse(b.ready_at || b.created_at)

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

/** Ya sale en la pantalla del local: lo marcó el mostrador o llegó su hora. */
const onScreen = (o, now) => !isDelivery(o) && isActive(o)
  && (o.status === 'listo' || (o.ready_at && Date.parse(o.ready_at) <= now))

/** Semáforo de la hora: rojo si va tarde, amarillo si queda poco. Un
    pedido de recoger ya en la pantalla espera al cliente: verde y, si
    pasan más de 15 min sin venir, rojo. */
function timing(o, now) {
  if (!isActive(o)) return null
  if (onScreen(o, now)) {
    const waiting = o.ready_at ? Math.max(0, Math.round((now - Date.parse(o.ready_at)) / 60000)) : 0
    return waiting > 15 ? { tone: 'late', text: `EN PANTALLA · ${waiting} MIN` } : { tone: 'screen', text: 'EN PANTALLA' }
  }
  if (!o.ready_at) return null
  const min = Math.round((Date.parse(o.ready_at) - now) / 60000)
  if (o.scheduled_for && min > FAR_MIN) return { tone: 'far', text: `PROGRAMADO ${hourOf(o.ready_at)}` }
  if (min < 0) return { tone: 'late', text: `TARDE ${-min} MIN` }
  if (min === 0) return { tone: 'soon', text: 'YA' }
  if (min <= 5) return { tone: 'soon', text: `EN ${min} MIN` }
  return { tone: 'ok', text: `EN ${min} MIN` }
}
const PILL = {
  late: 'bg-tomate text-papel',
  soon: 'bg-queso text-[rgb(29_43_79)]',
  ok: 'bg-albahaca/15 text-albahaca',
  far: 'bg-carbon/10 text-carbon',
  screen: 'bg-albahaca text-papel',
}

export default function Counter({ orders, locationIds, defaultLocationId, doughLeft = null, onSaved, onError, onCloseCash }) {
  const [search, setSearch] = useState('')
  const [showDone, setShowDone] = useState(false)
  const [editor, setEditor] = useState(null) // { order?, channel }
  const [charging, setCharging] = useState(null) // { order, deliver }
  const [cancelling, setCancelling] = useState(null) // id
  const [busyId, setBusyId] = useState(null)
  const [undo, setUndo] = useState(null) // { order, from, wasPaid }
  const [col, setCol] = useState('recoger') // móvil: qué columna se ve
  const [now, setNow] = useState(Date.now)

  /* Los minutos avanzan solos */
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 20000)
    return () => clearInterval(t)
  }, [])

  /* Deshacer se va solo a los 10 s */
  useEffect(() => {
    if (!undo) return undefined
    const t = setTimeout(() => setUndo(null), UNDO_MS)
    return () => clearTimeout(t)
  }, [undo])

  const tonight = orders.filter((o) => isThisServiceDay(o) || isActive(o))
  const shown = tonight.filter((o) => matches(o, search))

  const recoger = shown.filter((o) => isActive(o) && !isDelivery(o)).sort(byTime)
  const sinCobrar = shown.filter((o) => o.status === 'entregado' && !isPaid(o)).sort(byTime)
  const porSalir = shown.filter((o) => isActive(o) && isDelivery(o) && !o.dispatched_at)
  const enCalle = shown.filter((o) => isActive(o) && isDelivery(o) && o.dispatched_at)
  const hechos = shown
    .filter((o) => o.status === 'cancelado' || (o.status === 'entregado' && isPaid(o)))
    .sort((a, b) => byTime(b, a))

  /* Pedidos de la web que nadie ha mirado todavía (suenan hasta marcarlos) */
  const nuevosWeb = tonight.filter((o) => o.channel === 'web' && o.status === 'nuevo' && !o.seen_at && !o.offline)

  /* La noche en números (franja azul) */
  const counted = tonight.filter((o) => isThisServiceDay(o) && o.status !== 'cancelado')
  const cobrado = counted.filter(isPaid).reduce((acc, o) => {
    acc[o.payment_method === 'tarjeta' ? 'tarjeta' : 'efectivo'] += Number(o.total || 0)
    return acc
  }, { efectivo: 0, tarjeta: 0 })
  const porCobrar = counted.filter((o) => !isPaid(o)).reduce((n, o) => n + Number(o.total || 0), 0)
  const enLaCalle = tonight.filter((o) => isActive(o) && isDelivery(o) && o.dispatched_at && !isPaid(o))
    .reduce((n, o) => n + Number(o.total || 0), 0)

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
    const updated = await patch(order, { status: 'entregado', seen: true })
    if (updated) setUndo({ order: updated, from: order.status, wasPaid: isPaid(order) })
  }

  const confirmCharge = async (method, printIt) => {
    const { order, deliver: alsoDeliver } = charging
    const body = { paymentStatus: 'pagado', paymentMethod: method, seen: true, ...(alsoDeliver ? { status: 'entregado' } : {}) }
    const updated = await patch(order, body)
    if (!updated) return
    setCharging(null)
    if (printIt) printReceipt(updated)
    if (alsoDeliver) setUndo({ order: updated, from: order.status, wasPaid: isPaid(order) })
  }

  const cancel = async (order, reason) => {
    setCancelling(null)
    await patch(order, { status: 'cancelado', cancelReason: reason, seen: true })
  }

  const undoLast = async () => {
    if (!undo) return
    const { order, from, wasPaid } = undo
    setUndo(null)
    await patch(order, { status: from, ...(wasPaid ? {} : { paymentStatus: 'pendiente' }) })
  }

  const markSeen = () => nuevosWeb.forEach((o) => updateOrder(o.id, { seen: true }).then(({ order }) => onSaved(order)).catch(() => {}))

  const card = (o, kind) => (
    <OrderCard
      key={o.id}
      o={o}
      kind={kind}
      now={now}
      busy={busyId === o.id}
      cancelling={cancelling === o.id}
      onCharge={(alsoDeliver) => setCharging({ order: o, deliver: alsoDeliver })}
      onDeliver={() => deliver(o)}
      onEdit={() => setEditor({ order: o })}
      onUnpay={() => patch(o, { paymentStatus: 'pendiente' })}
      onToScreen={() => patch(o, { status: 'listo', seen: true })}
      onCancelAsk={() => setCancelling(o.id)}
      onCancelBack={() => setCancelling(null)}
      onCancel={(reason) => cancel(o, reason)}
    />
  )

  const MOBILE_COLS = [
    { id: 'recoger', label: 'Recoger', n: recoger.length + sinCobrar.length },
    { id: 'domicilio', label: 'Domicilio', n: porSalir.length },
    { id: 'calle', label: 'Calle y caja', n: new Set(enCalle.map((o) => o.route_id)).size },
  ]
  const colClass = (id) => (col === id ? '' : 'hidden lg:flex')

  return (
    <div className="pb-24">
      {/* Arriba: lo que más se hace. Nuevo pedido y buscar. */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="grid grid-cols-2 gap-3 lg:flex">
          <button onClick={() => setEditor({ channel: 'mostrador' })} className="pbig bg-tomate sm:text-lg lg:px-6">
            <Plus className="w-6 h-6" strokeWidth={3} /> Nuevo pedido
          </button>
          <button onClick={() => setEditor({ channel: 'telefono' })} className="pbig bg-carbon lg:px-6">
            <Phone className="w-5 h-5" /> Por teléfono
          </button>
        </div>
        <label className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-carbon/50" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar: número, nombre o teléfono"
            aria-label="Buscar pedido"
            className="pfield !min-h-[52px] !pl-11 !pr-11 !text-base !border-2 !border-carbon/70"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-carbon/60" aria-label="Borrar búsqueda">
              <X className="w-5 h-5" />
            </button>
          )}
        </label>
      </div>

      {/* La noche en números */}
      <div className="mt-4 flex flex-wrap items-center gap-x-7 gap-y-1 rounded-lg bg-carbon px-4 py-2.5 text-[0.95rem] text-masa">
        <span><strong className="text-lg">{counted.length}</strong> pedidos esta noche</span>
        <span>Cobrado <strong className="text-lg">{price(cobrado.efectivo + cobrado.tarjeta)}</strong> <span className="opacity-80">(efectivo {price(cobrado.efectivo)} · tarjeta {price(cobrado.tarjeta)})</span></span>
        <span>Por cobrar <strong className="text-lg text-queso">{price(porCobrar)}</strong></span>
        {doughLeft != null && (
          <span className="lg:ml-auto">{doughLeft === 0 ? <strong className="text-queso">SIN MASAS</strong> : <>Quedan <strong className="text-lg">{doughLeft}</strong> masas</>}</span>
        )}
      </div>

      {/* Pedidos de la web sin mirar: suenan hasta que alguien los ve */}
      {nuevosWeb.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border-2 border-carbon bg-queso px-4 py-3 text-[rgb(29_43_79)] animate-pulse" role="alert">
          <BellRing className="w-6 h-6 flex-shrink-0" />
          <p className="flex-1 font-sans font-extrabold uppercase tracking-wide">
            {nuevosWeb.length === 1 ? 'Pedido nuevo de la web' : `${nuevosWeb.length} pedidos nuevos de la web`}: {nuevosWeb.map((o) => `${o.ref} (${o.mode === 'delivery' ? 'domicilio' : 'recoger'})`).join(', ')}
          </p>
          <button onClick={markSeen} className="pbig bg-carbon !min-h-[44px]">Visto</button>
        </div>
      )}

      {/* Móvil: tres pestañas grandes con su cuenta */}
      <div className="lg:hidden mt-4 grid grid-cols-3 gap-2" role="tablist" aria-label="Columnas del mostrador">
        {MOBILE_COLS.map((c) => (
          <button key={c.id} role="tab" aria-selected={col === c.id} onClick={() => setCol(c.id)} className="ptab !min-h-[3.5rem] flex-col !gap-0 !px-1 leading-tight">
            <span className="font-mono font-extrabold text-xl leading-none">{c.n}</span>
            {c.label}
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-3 items-start">
        {/* PARA RECOGER */}
        <section className={['flex-col gap-4 min-w-0', col === 'recoger' ? 'flex' : 'hidden lg:flex'].join(' ')}>
          <ColumnTitle Icon={ShoppingBag} count={recoger.length} tone="tomate">Para recoger</ColumnTitle>
          {recoger.length === 0 && (
            <p className="rounded-md border border-dashed border-carbon/30 py-6 text-center text-carbon/60">
              {search ? 'Ninguno con esa búsqueda.' : 'Nadie esperando para recoger.'}
            </p>
          )}
          {recoger.map((o) => card(o, 'recoger'))}
          {sinCobrar.length > 0 && (
            <>
              <p className="mt-2 font-sans font-extrabold uppercase tracking-wide text-tomate">Entregados sin cobrar ({sinCobrar.length})</p>
              {sinCobrar.map((o) => card(o, 'cobrar'))}
            </>
          )}
        </section>

        {/* A DOMICILIO · POR SALIR */}
        <div className={['flex-col min-w-0', colClass('domicilio')].join(' ')}>
          <Routes part="salir" orders={shown} locationIds={locationIds} onSaved={onSaved} onError={onError} />
        </div>

        {/* EN LA CALLE + CAJA */}
        <div className={['flex-col min-w-0', colClass('calle')].join(' ')}>
          <Routes
            part="calle"
            orders={shown}
            locationIds={locationIds}
            onSaved={onSaved}
            onError={onError}
            footer={(
              <div className="mt-2 flex flex-col gap-3 rounded-lg border-2 border-carbon bg-queso p-4 text-[rgb(29_43_79)]">
                <p className="flex items-center gap-2 font-sans font-extrabold uppercase tracking-wide"><Wallet className="w-5 h-5" /> Caja de esta noche</p>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <span>Efectivo<br /><strong className="text-lg">{price(cobrado.efectivo)}</strong></span>
                  <span>Tarjeta<br /><strong className="text-lg">{price(cobrado.tarjeta)}</strong></span>
                  <span>En la calle<br /><strong className="text-lg">{price(enLaCalle)}</strong></span>
                </div>
                {onCloseCash && (
                  <button onClick={onCloseCash} className="pbig bg-[rgb(29_43_79)] !text-[rgb(255_250_233)] !border-[rgb(29_43_79)]">Cerrar caja</button>
                )}
              </div>
            )}
          />
        </div>
      </div>

      {hechos.length > 0 && (
        <div className="mt-10">
          <button onClick={() => setShowDone((v) => !v)} className="psec">
            <ChevronDown className={['w-4 h-4 transition-transform', showDone ? 'rotate-180' : ''].join(' ')} />
            {showDone ? 'Ocultar' : 'Ver'} terminados esta noche ({hechos.length})
          </button>
          {showDone && <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{hechos.map((o) => card(o, 'hecho'))}</div>}
        </div>
      )}

      {/* Deshacer el último "entregado" (un toque de más en hora punta) */}
      {undo && (
        <div className="fixed inset-x-3 bottom-24 md:bottom-6 z-40 mx-auto max-w-md flex items-center justify-between gap-3 rounded-lg bg-[rgb(29_43_79)] px-4 py-3 text-[rgb(255_250_233)] shadow-float" role="status">
          <span className="font-semibold">{undo.order.ref} {undo.wasPaid ? 'entregado' : 'cobrado y entregado'}</span>
          <button onClick={undoLast} className="flex items-center gap-1.5 rounded-md border border-[rgb(255_250_233)]/50 px-3 py-2 text-sm font-bold uppercase">
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

/**
 * Tarjeta de un pedido del mostrador. `kind`:
 *   recoger → Cobrar y entregar / Entregar
 *   cobrar  → se entregó sin cobrar: Cobrar
 *   hecho   → ya cerrado: solo reimprimir
 */
function OrderCard({ o, kind, now, busy, cancelling, onCharge, onDeliver, onEdit, onUnpay, onToScreen, onCancelAsk, onCancelBack, onCancel }) {
  const ch = CHANNEL[o.channel] || CHANNEL.web
  const paid = isPaid(o)
  /* Pedido tomado sin conexión, aún en la cola de este equipo:
     solo se puede reimprimir hasta que llegue al sistema. */
  const local = Boolean(o.offline)
  const active = isActive(o)
  const editable = !local && active && (o.items || []).every((i) => i.id)
  const time = timing(o, now)
  const isNew = o.channel === 'web' && o.status === 'nuevo' && !o.seen_at

  const primary = local || kind === 'hecho' ? null
    : kind === 'cobrar' ? { label: 'Cobrar', run: () => onCharge(false) }
      : paid ? { label: 'Entregar', run: onDeliver }
        : { label: 'Cobrar y entregar', run: () => onCharge(true) }

  const frame = kind === 'hecho' ? 'opacity-75' : time?.tone === 'late' ? 'pc-late' : isNew ? 'pc-new' : 'pc-navy'

  return (
    <article className={['pcard p-4 flex flex-col gap-2.5', frame].join(' ')}>
      <div className="flex items-center gap-3">
        <span className="font-mono font-bold text-2xl text-carbon">{o.ref}</span>
        <span className="flex-1 min-w-0 truncate font-sans font-bold text-lg text-carbon">{o.customer_name}</span>
        {time && <span className={['flex-shrink-0 rounded-full px-2.5 py-1 font-mono text-[0.8rem] font-bold', PILL[time.tone]].join(' ')}>{time.text}</span>}
        {o.status === 'cancelado' && <span className="flex-shrink-0 rounded-full bg-tomate/15 px-2.5 py-1 font-mono text-[0.8rem] font-bold text-tomate">CANCELADO</span>}
      </div>

      <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-[0.78rem] text-carbon/70">
        <span className="flex items-center gap-1"><ch.Icon className="w-3.5 h-3.5" /> {ch.label.toUpperCase()}{isNew ? ' · NUEVO' : ''}</span>
        {o.ready_at && <span>· para las {hourOf(o.ready_at)}</span>}
        {isDelivery(o) && <span className="flex items-center gap-1">· <Truck className="w-3.5 h-3.5" /> domicilio</span>}
        {o.customer_phone && <span>· {o.customer_phone}</span>}
        {o.scheduled_for && <span className="flex items-center gap-1 text-horno">· <CalendarClock className="w-3.5 h-3.5" /> programado</span>}
        {o.edited_at && <span className="font-semibold text-horno">· modificado</span>}
        {local && <span className="rounded bg-carbon px-1.5 text-masa font-semibold">SIN ENVIAR · en papel</span>}
      </p>

      <p className="text-[0.95rem] leading-snug text-carbon line-clamp-3">
        {(o.items || []).map((i) => `${i.qty} ${i.name}`).join(' · ')}
      </p>
      {o.notes && <p className="text-sm font-semibold text-carbon">Nota: {o.notes}</p>}

      <div className="flex items-center justify-between gap-3">
        <strong className="font-sans text-2xl text-carbon">{price(o.total)}</strong>
        <span className={['text-sm font-bold uppercase', paid ? 'text-albahaca' : 'text-tomate'].join(' ')}>
          {paid ? `Pagado · ${o.payment_method || 'efectivo'}` : 'Sin cobrar'}
        </span>
      </div>

      {cancelling ? (
        <CancelReasons onPick={onCancel} onBack={onCancelBack} disabled={busy} />
      ) : (
        <>
          {primary && (
            <button onClick={primary.run} disabled={busy} className="pbig w-full bg-albahaca">
              {busy ? 'Guardando…' : primary.label}
            </button>
          )}
          {kind === 'recoger' && !local && !onScreen(o, now) && (
            <button onClick={onToScreen} disabled={busy} className="psec w-full !border-albahaca !text-albahaca">
              <MonitorCheck className="w-5 h-5" /> Ya está · a la pantalla
            </button>
          )}
          <div className="flex flex-wrap gap-2">
            {!local && active && (
              <button onClick={() => printTicket(o)} className="psec" title="Vuelve a sacar la comanda en la impresora de cocina">
                <Printer className="w-4 h-4" /> Comanda
              </button>
            )}
            <button onClick={() => printReceipt(o)} className="psec" title="Vuelve a sacar el ticket del cliente">
              <Printer className="w-4 h-4" /> Ticket
            </button>
            {editable && <button onClick={onEdit} disabled={busy} className="psec"><Pencil className="w-4 h-4" /> Cambiar</button>}
            {!local && active && <button onClick={onCancelAsk} disabled={busy} className="psec"><Ban className="w-4 h-4" /> Cancelar</button>}
            {!local && paid && kind !== 'hecho' && (
              <button onClick={onUnpay} disabled={busy} className="ml-auto px-2 text-sm text-carbon/50 underline-offset-2 hover:underline">
                Deshacer cobro
              </button>
            )}
          </div>
        </>
      )}
    </article>
  )
}
