import { useEffect, useState } from 'react'
import { ClipboardCheck, Flame, PackageCheck, Truck, Home, Phone, MapPin, XCircle, CalendarClock, RefreshCw } from 'lucide-react'
import { price } from '../lib/format'
import { hourOf } from '../lib/kitchenSlots'
import { navigate } from '../lib/router'
import { forgetLastOrder } from '../lib/lastOrder'

/* ═══════════════════════════════════════════════════════════════
   SEGUIMIENTO DEL PEDIDO  (/p/NN-4821-a1b2c3d4e5)
   Lo abre el cliente desde el SMS o al terminar de pedir. Se
   actualiza solo cada 15 s mientras el pedido está en marcha.
   ═══════════════════════════════════════════════════════════════ */

const POLL_MS = 15000

/** Pasos que ve el cliente, según recoja o se lo llevemos. */
function stepsFor(order) {
  const delivery = order.mode === 'delivery'
  return [
    { id: 'recibido', label: 'Recibido', Icon: ClipboardCheck },
    { id: 'horno', label: 'En el horno', Icon: Flame },
    delivery
      ? { id: 'camino', label: 'En camino', Icon: Truck }
      : { id: 'listo', label: 'Listo', Icon: PackageCheck },
    { id: 'entregado', label: delivery ? 'Entregado' : 'Recogido', Icon: Home },
  ]
}

/** Índice del paso actual (0..3) */
function currentStep(order) {
  if (order.status === 'entregado') return 3
  if (order.status === 'listo') return order.mode === 'delivery' && !order.dispatchedAt ? 1 : 2
  if (order.status === 'horno') return 1
  return 0
}

/** Titular grande del estado actual */
function headline(order) {
  const delivery = order.mode === 'delivery'
  switch (order.status) {
    case 'cancelado': return { title: 'Pedido cancelado', sub: 'Si no sabías nada, llámanos y lo vemos.' }
    case 'entregado': return { title: delivery ? '¡Entregado! Que aproveche' : '¡Recogido! Que aproveche', sub: 'Gracias por pedir en Nonno.' }
    case 'listo':
      if (!delivery) return { title: '¡Tu pedido está listo!', sub: `Ya puedes pasar a recogerlo${order.location ? ` en ${order.location.name}` : ''}.` }
      return order.dispatchedAt
        ? { title: '¡Va de camino!', sub: order.etaAt ? `Llega hacia las ${hourOf(order.etaAt)}.` : 'Llega en unos minutos.' }
        : { title: 'Listo, saliendo del horno', sub: 'El repartidor sale enseguida.' }
    case 'horno': return { title: 'Está en el horno', sub: delivery ? 'En cuanto salga, va para tu casa.' : 'Te avisamos por SMS cuando esté listo.' }
    default:
      return order.scheduledFor
        ? { title: 'Pedido programado', sub: 'Lo tenemos apuntado y empezamos a hacerlo a su hora.' }
        : { title: 'Pedido recibido', sub: 'La cocina ya lo tiene. En nada entra al horno.' }
  }
}

export default function OrderTracking({ token }) {
  const [order, setOrder] = useState(null)
  const [error, setError] = useState(null)
  const [refreshedAt, setRefreshedAt] = useState(null)

  useEffect(() => {
    let cancelled = false
    let timer = null
    const load = async () => {
      try {
        const res = await fetch(`/api/orders?track=${encodeURIComponent(token)}`)
        const data = await res.json().catch(() => ({}))
        if (cancelled) return
        if (!res.ok) { setError(data.error || 'No encontramos ese pedido.'); return }
        setError(null)
        setOrder(data.order)
        setRefreshedAt(Date.now())
        /* Terminado: deja de mirar y se quita el aviso de la cabecera */
        if (['entregado', 'cancelado'].includes(data.order.status)) {
          forgetLastOrder(token)
          return
        }
        timer = setTimeout(load, POLL_MS)
      } catch {
        if (!cancelled) timer = setTimeout(load, POLL_MS)
      }
    }
    load()
    return () => { cancelled = true; clearTimeout(timer) }
  }, [token])

  if (error && !order) {
    return (
      <section className="shell py-20 text-center">
        <h1 className="font-display italic font-bold text-4xl text-neon">{error}</h1>
        <p className="mt-3 text-carbon/70">Revisa el enlace del SMS o llama a tu Nonno.</p>
        <button onClick={() => navigate('/carta')} className="btn-retro mt-8"><span>Ver la carta</span></button>
      </section>
    )
  }

  if (!order) {
    return <p className="shell py-24 text-center mono text-carbon/50">CARGANDO TU PEDIDO…</p>
  }

  const steps = stepsFor(order)
  const step = currentStep(order)
  const cancelled = order.status === 'cancelado'
  const { title, sub } = headline(order)
  const delivery = order.mode === 'delivery'
  const hour = delivery ? order.etaAt : order.readyAt
  const finished = ['entregado', 'cancelado'].includes(order.status)

  return (
    <section className="shell py-10 sm:py-16">
      <div className="mx-auto max-w-2xl">
        <p className="mono text-neon text-center">PEDIDO {order.ref}{order.name ? ` · ${order.name.toUpperCase()}` : ''}</p>
        <h1 className="mt-2 text-center font-display italic font-bold text-4xl sm:text-5xl text-neon leading-none">{title}</h1>
        <p className="mt-3 text-center text-carbon/75">{sub}</p>

        {!finished && hour && (
          <div className="mt-6 mx-auto w-fit frame">
            <div className="frame-in px-6 py-3 text-center">
              <p className="mono text-carbon/60">{delivery ? 'LLEGA HACIA LAS' : 'LISTO A LAS'}</p>
              <p className="font-display italic font-bold text-5xl text-neon leading-tight">{hourOf(hour)}</p>
              {order.scheduledFor && <p className="mono normal-case text-carbon/60 flex items-center justify-center gap-1"><CalendarClock className="w-3.5 h-3.5" /> pedido programado</p>}
            </div>
          </div>
        )}

        {/* Línea de pasos */}
        {cancelled ? (
          <div className="mt-8 flex items-center justify-center gap-2 rounded-md border border-tomate bg-tomate/10 py-4 font-sans font-bold uppercase text-neon">
            <XCircle className="w-5 h-5" /> Cancelado
          </div>
        ) : (
          <ol className="mt-10 grid grid-cols-4 gap-1" aria-label="Estado del pedido">
            {steps.map((s, i) => {
              const done = i < step
              const now = i === step
              return (
                <li key={s.id} className="relative flex flex-col items-center text-center" aria-current={now ? 'step' : undefined}>
                  {i > 0 && (
                    <span className={['absolute top-6 right-1/2 w-full h-1 -z-0', i <= step ? 'bg-tomate' : 'bg-tomate/20'].join(' ')} aria-hidden="true" />
                  )}
                  <span className={[
                    'relative z-10 flex h-12 w-12 items-center justify-center rounded-full border-2',
                    now ? 'border-tomate bg-tomate text-masa animate-pulse' : done ? 'border-tomate bg-tomate text-masa' : 'border-tomate/30 bg-masa text-neon/40',
                  ].join(' ')}>
                    <s.Icon className="w-5 h-5" />
                  </span>
                  <span className={['mt-2 text-[0.7rem] sm:text-xs font-bold uppercase tracking-wide', now || done ? 'text-neon' : 'text-carbon/40'].join(' ')}>{s.label}</span>
                </li>
              )
            })}
          </ol>
        )}

        {/* Qué lleva */}
        <div className="mt-10 frame">
          <div className="frame-in p-5">
            <p className="mono text-neon mb-3">TU PEDIDO</p>
            <ul className="flex flex-col gap-2">
              {order.items.map((it, i) => (
                <li key={i} className="flex gap-3">
                  <span className="font-mono font-bold text-neon w-8">{it.qty}×</span>
                  <span className="flex-1">
                    <span className="font-semibold text-carbon">{it.name}</span>
                    {it.removed.length > 0 && <span className="block text-xs font-bold uppercase text-neon">Sin {it.removed.join(', sin ')}</span>}
                    {it.extras.length > 0 && <span className="block text-xs text-carbon/60">+ {it.extras.join(', ')}</span>}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex items-baseline justify-between border-t border-tomate/30 pt-3">
              <span className="text-sm text-carbon/70">{order.paid ? 'Pagado' : delivery ? 'Pagas al recibirlo' : 'Pagas al recogerlo'}</span>
              <span className="font-display italic font-bold text-3xl text-neon">{price(order.total)}</span>
            </div>
          </div>
        </div>

        {/* Dónde y contacto */}
        {order.location && (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {!delivery && order.location.address && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.location.address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-md border border-tomate bg-crema p-4 hover:bg-queso/50 transition-colors"
              >
                <MapPin className="w-6 h-6 text-neon flex-shrink-0" />
                <span className="text-sm">
                  <span className="block font-bold uppercase text-neon">Cómo llegar</span>
                  <span className="text-carbon/70">{order.location.address}</span>
                </span>
              </a>
            )}
            {order.location.phone && (
              <a
                href={`tel:${order.location.phone.replace(/\s/g, '')}`}
                className="flex items-center gap-3 rounded-md border border-tomate bg-crema p-4 hover:bg-queso/50 transition-colors"
              >
                <Phone className="w-6 h-6 text-neon flex-shrink-0" />
                <span className="text-sm">
                  <span className="block font-bold uppercase text-neon">Llamar a {order.location.name}</span>
                  <span className="text-carbon/70">{order.location.phone}</span>
                </span>
              </a>
            )}
          </div>
        )}

        {!finished && refreshedAt && (
          <p className="mt-6 flex items-center justify-center gap-1.5 mono normal-case text-carbon/45">
            <RefreshCw className="w-3.5 h-3.5" /> Se actualiza solo · última vez a las {hourOf(refreshedAt)}
          </p>
        )}
      </div>
    </section>
  )
}
