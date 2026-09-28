import { useRef, useState } from 'react'
import { X, ChevronLeft, MapPin, Package, Truck, Check, Pizza, Phone, MessageCircle } from 'lucide-react'
import { LOCATIONS } from '../data/locations'
import { useStore, useActions, useCart, useSelectedLocation } from '../store/StoreContext'
import { useLockBodyScroll } from '../hooks/useLockBodyScroll'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { useStoreStatus } from '../hooks/useStoreStatus'
import { submitOrder, fallbackContacts } from '../lib/orderGateway'
import { deliveryTiers } from '../lib/delivery'
import DeliveryPicker from './DeliveryPicker'
import { price, orderRef } from '../lib/format'
import { lineTotal } from '../lib/pricing'
import { orderTotals, pickupDeals } from '../lib/orderTotals'
import { hourOf, ovenUnits } from '../lib/kitchenSlots'
import { useKitchenEta } from '../hooks/useKitchenEta'
import { gsap, useGSAP, EASE, revealFrom, guard } from '../lib/motion'

const newClientKey = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`

const STEPS = [
  { id: 1, label: 'SEDE' },
  { id: 2, label: 'RECOGER O ENTREGA' },
  { id: 3, label: 'DATOS' },
  { id: 4, label: 'RESUMEN' },
]

/**
 * Checkout frontend completo, sin pasarela de pago: el pago se
 * resuelve en persona (local o entrega). submitOrder() solo compone
 * y valida el pedido — ver src/lib/orderGateway.js para el punto de
 * integración con un backend real.
 */
export default function Checkout() {
  const { ui, customer, order } = useStore()
  const {
    closeCheckout, setCheckoutStep, setLocation, setMode,
    setCustomer, setOrderStatus, resetOrder,
  } = useActions()
  const { lines, isEmpty } = useCart()
  const { locationId, location, modes } = useSelectedLocation()
  const { isOpen: storeIsOpen } = useStoreStatus()
  const locationClosed = Boolean(locationId) && !storeIsOpen(locationId)

  const open = ui.checkoutOpen
  const eta = useKitchenEta(open && !isEmpty && !locationClosed ? locationId : null, ovenUnits(lines))
  const slotFull = eta?.ok === false
  const blocked = locationClosed || slotFull
  const step = ui.checkoutStep
  const [fieldErrors, setFieldErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  const panelRef = useRef(null)
  const dialogRef = useRef(null)
  const bodyRef = useRef(null)
  const clientKey = useRef(null)

  useLockBodyScroll(open)
  useFocusTrap(dialogRef, open, closeCheckout)

  useGSAP(() => {
    if (!open) return
    revealFrom(panelRef.current, { opacity: 0, duration: 0.3, ease: EASE.in })
    revealFrom(dialogRef.current, { y: 30, opacity: 0, duration: 0.45, ease: EASE.in })
  }, { dependencies: [open], scope: panelRef })

  useGSAP(() => {
    if (!open || !bodyRef.current) return
    revealFrom(bodyRef.current, { x: 16, opacity: 0, duration: 0.4, ease: 'power2.out' })
  }, { dependencies: [step], scope: panelRef })

  if (!open || isEmpty) return null

  const totals = orderTotals({
    lines, mode: order.mode, locationId, where: { coords: customer.coords, tier: customer.tier },
  })
  const pickupSaving = pickupDeals(lines).discount
  const tiers = deliveryTiers(locationId)
  const readyAt = eta?.ok ? Date.parse(eta.readyAt) : null

  const goTo = (n) => setCheckoutStep(Math.min(4, Math.max(1, n)))

  const canNext = () => {
    if (blocked) return false
    if (step === 1) return Boolean(locationId)
    if (step === 2) return Boolean(order.mode)
    if (step === 3) {
      const errs = {}
      if (!customer.name.trim()) errs.name = true
      if (!customer.phone.trim()) errs.phone = true
      if (order.mode === 'delivery' && (!customer.address.trim() || !totals.delivery?.ok)) errs.delivery = true
      setFieldErrors(errs)
      return Object.keys(errs).length === 0
    }
    return true
  }

  const handleNext = () => {
    if (!canNext()) return
    goTo(step + 1)
  }

  const handleSubmit = async () => {
    if (blocked) return
    setSubmitting(true)
    /* La misma clave en cada reintento: si el primer envío sí llegó,
       el servidor no crea un segundo pedido. */
    clientKey.current ||= { key: newClientKey(), ref: orderRef() }
    const result = await submitOrder({
      lines, locationId, mode: order.mode, customer, clientKey: clientKey.current.key, ref: clientKey.current.ref,
    })
    if (result.status !== 'error') clientKey.current = null
    setSubmitting(false)
    setOrderStatus(result.status === 'error' ? 'error' : 'success', {
      result,
      errors: result.errors || {},
    })
    if (result.status === 'sent' && result.url) {
      window.open(result.url, '_blank', 'noopener')
    }
  }

  const handleClose = () => {
    closeCheckout()
    if (order.status === 'success') resetOrder()
  }

  return (
    <div ref={panelRef} className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
      <button className="absolute inset-0 bg-forno/70 backdrop-blur-sm" onClick={handleClose} aria-label="Cerrar" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkout-title"
        className="relative w-full sm:max-w-xl max-h-[94dvh] sm:max-h-[88vh] overflow-y-auto bg-crema rounded-t-block sm:rounded-block shadow-float"
      >
        <div className="sticky top-0 bg-crema/95 backdrop-blur-md z-10 px-6 sm:px-8 pt-6 pb-4 border-b border-carbon/8">
          <div className="flex items-center justify-between">
            {step > 1 && order.status === 'idle' ? (
              <button onClick={() => goTo(step - 1)} className="w-9 h-9 rounded-full flex items-center justify-center text-carbon/60 hover:bg-carbon/5" aria-label="Paso anterior">
                <ChevronLeft className="w-5 h-5" />
              </button>
            ) : <span />}
            <h2 id="checkout-title" className="font-sans font-extrabold uppercase text-sm text-carbon/70">TU PEDIDO</h2>
            <button onClick={handleClose} className="w-9 h-9 rounded-full flex items-center justify-center text-carbon/60 hover:bg-carbon/5" aria-label="Cerrar">
              <X className="w-5 h-5" />
            </button>
          </div>

          {order.status === 'idle' && (
            <div className="mt-4 flex items-center gap-1.5">
              {STEPS.map((s) => (
                <div key={s.id} className={['h-1 flex-1 rounded-full transition-colors', s.id <= step ? 'bg-tomate' : 'bg-carbon/10'].join(' ')} />
              ))}
            </div>
          )}
        </div>

        <div ref={bodyRef} className="px-6 sm:px-8 py-7">
          {order.status === 'idle' && locationClosed && (
            <p className="mb-6 rounded-2xl border border-tomate/30 bg-tomate/5 px-4 py-3 text-sm text-tomate">
              {location?.name} está cerrado ahora mismo. No se pueden hacer pedidos hasta que vuelva a abrir.
            </p>
          )}
          {order.status === 'idle' && !locationClosed && slotFull && (
            <p className="mb-6 rounded-2xl border border-tomate/30 bg-tomate/5 px-4 py-3 text-sm text-tomate">
              {eta.message}
            </p>
          )}

          {order.status === 'success' && (
            <OrderSuccess result={order.result} onClose={handleClose} />
          )}

          {order.status === 'error' && (
            order.result?.fallback
              ? <OrderFallback result={order.result} locationId={locationId} onRetry={handleSubmit} retrying={submitting} onDone={resetOrder} />
              : <OrderError message={order.result?.message} onRetry={() => setOrderStatus('idle')} />
          )}

          {order.status === 'idle' && step === 1 && (
            <StepLocation locationId={locationId} onPick={setLocation} />
          )}

          {order.status === 'idle' && step === 2 && (
            <StepMode modes={modes} value={order.mode} onPick={setMode} location={location} pickupSaving={pickupSaving} tiers={tiers} readyAt={readyAt} />
          )}

          {order.status === 'idle' && step === 3 && (
            <StepCustomer
              customer={customer}
              mode={order.mode}
              locationId={locationId}
              errors={fieldErrors}
              onChange={(patch) => { setCustomer(patch); setFieldErrors({}) }}
            />
          )}

          {order.status === 'idle' && step === 4 && (
            <StepSummary lines={lines} totals={totals} location={location} mode={order.mode} customer={customer} readyAt={readyAt} />
          )}
        </div>

        {order.status === 'idle' && (
          <div className="sticky bottom-0 bg-crema/95 backdrop-blur-md px-6 sm:px-8 py-5 border-t border-carbon/8 pb-safe">
            {step < 4 ? (
              <button onClick={handleNext} disabled={blocked} className="btn w-full bg-tomate text-forno disabled:opacity-60">
                <span className="btn-layer bg-horno" />
                <span className="btn-label">CONTINUAR →</span>
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={submitting || blocked} className="btn w-full bg-tomate text-forno disabled:opacity-60">
                <span className="btn-layer bg-horno" />
                <span className="btn-label">{submitting ? 'ENVIANDO…' : 'CONFIRMAR PEDIDO'}</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Paso 1: sede ─────────────────────────────────────────────── */
function StepLocation({ locationId, onPick }) {
  return (
    <div>
      <p className="mono text-tomate mb-2">01 / SEDE</p>
      <h3 className="font-sans font-extrabold uppercase text-xl text-carbon mb-6">¿Desde qué Nonno pedimos?</h3>
      <div className="flex flex-col gap-3">
        {LOCATIONS.map((loc) => {
          const active = locationId === loc.id
          return (
            <button
              key={loc.id}
              onClick={() => onPick(loc.id)}
              className={[
                'flex items-center gap-3 rounded-2xl border p-4 text-left transition-all',
                active ? 'border-tomate bg-tomate/5' : 'border-carbon/12 hover:border-carbon/30',
              ].join(' ')}
            >
              <span className={['w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0', active ? 'bg-tomate text-forno' : 'bg-carbon/8 text-carbon/50'].join(' ')}>
                <MapPin className="w-4 h-4" />
              </span>
              <span className="flex-1">
                <span className="block font-sans font-bold text-sm text-carbon">{loc.name}</span>
                <span className="block mono normal-case text-carbon/45 mt-0.5">{loc.tagline}</span>
              </span>
              {active && <Check className="w-5 h-5 text-tomate flex-shrink-0" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ── Paso 2: recoger o entrega ────────────────────────────────── */
function StepMode({ modes, value, onPick, location, pickupSaving, tiers, readyAt }) {
  const minFee = tiers.length ? tiers[0].fee : null
  const minTravel = tiers.length ? tiers[0].minutes : 0
  const when = readyAt && {
    pickup: `Lista a las ${hourOf(readyAt)}`,
    delivery: `Llega desde las ${hourOf(readyAt + minTravel * 60000)}`,
  }
  const extra = {
    pickup: pickupSaving > 0 ? `Oferta recogida: ahorras ${price(pickupSaving)}` : null,
    delivery: minFee !== null ? `Envío desde ${price(minFee)}` : null,
  }
  return (
    <div>
      <p className="mono text-tomate mb-2">02 / MODO</p>
      <h3 className="font-sans font-extrabold uppercase text-xl text-carbon mb-6">¿Cómo quieres tu pizza?</h3>
      <div className="grid grid-cols-2 gap-3">
        {modes.map((m) => {
          const Icon = m.id === 'pickup' ? Package : Truck
          const active = value === m.id
          return (
            <button
              key={m.id}
              onClick={() => onPick(m.id)}
              className={[
                'flex flex-col items-center gap-2 rounded-2xl border p-6 text-center transition-all',
                active ? 'border-tomate bg-tomate/5' : 'border-carbon/12 hover:border-carbon/30',
              ].join(' ')}
            >
              <Icon className={['w-6 h-6', active ? 'text-tomate' : 'text-carbon/50'].join(' ')} />
              <span className="font-sans font-bold text-sm text-carbon">{m.label}</span>
              <span className="text-xs text-carbon/45">{m.hint}</span>
              {when && (
                <span className="mt-1 font-sans font-bold text-sm text-carbon">{when[m.id]}</span>
              )}
              {extra[m.id] && (
                <span className={[
                  'mt-1 rounded-full px-2.5 py-1 text-[0.7rem] font-semibold',
                  m.id === 'pickup' ? 'bg-albahaca/15 text-albahaca' : 'bg-carbon/8 text-carbon/60',
                ].join(' ')}>
                  {extra[m.id]}
                </span>
              )}
            </button>
          )
        })}
      </div>
      {location?.deliveryNote && (
        <p className="mt-5 text-xs text-carbon/40 italic">{location.deliveryNote}</p>
      )}
    </div>
  )
}

/* ── Paso 3: datos ────────────────────────────────────────────── */
function StepCustomer({ customer, mode, locationId, errors, onChange }) {
  const field = (key, label, placeholder, type = 'text') => (
    <div>
      <label htmlFor={`f-${key}`} className="mono text-carbon/50 mb-2 block">{label}</label>
      <input
        id={`f-${key}`}
        type={type}
        value={customer[key]}
        onChange={(e) => onChange({ [key]: e.target.value })}
        placeholder={placeholder}
        className={[
          'w-full rounded-2xl border bg-white/60 px-4 py-3 text-sm text-carbon placeholder:text-carbon/35 outline-none transition-colors',
          errors[key] ? 'border-tomate' : 'border-carbon/12 focus:border-tomate',
        ].join(' ')}
      />
      {errors[key] && <p className="mt-1 text-xs text-tomate">Este campo es necesario.</p>}
    </div>
  )

  return (
    <div>
      <p className="mono text-tomate mb-2">03 / DATOS</p>
      <h3 className="font-sans font-extrabold uppercase text-xl text-carbon mb-6">¿A nombre de quién?</h3>
      <div className="flex flex-col gap-5">
        {field('name', 'NOMBRE', 'Tu nombre')}
        <div>
          {field('phone', 'TELÉFONO MÓVIL', '600 000 000', 'tel')}
          <p className="mt-1.5 text-xs text-carbon/45">Te mandamos un SMS con la confirmación y la hora, y otro cuando esté listo.</p>
        </div>
        {mode === 'delivery' && (
          <DeliveryPicker
            locationId={locationId}
            value={customer}
            onChange={onChange}
            invalid={errors.delivery}
          />
        )}
        <div>
          <label htmlFor="f-notes" className="mono text-carbon/50 mb-2 block">NOTAS (OPCIONAL)</label>
          <textarea
            id="f-notes"
            rows={2}
            value={customer.notes}
            onChange={(e) => onChange({ notes: e.target.value })}
            placeholder='"Sin cebolla", "el timbre no funciona"...'
            className="w-full rounded-2xl border border-carbon/12 bg-white/60 px-4 py-3 text-sm text-carbon placeholder:text-carbon/35 focus:border-tomate outline-none transition-colors resize-none"
          />
        </div>
      </div>
    </div>
  )
}

/* ── Paso 4: resumen ──────────────────────────────────────────── */
function StepSummary({ lines, totals, location, mode, customer, readyAt }) {
  const trip = mode === 'delivery' && totals.delivery?.ok ? totals.delivery : null
  const arrival = readyAt && (trip ? readyAt + trip.minutes * 60000 : readyAt)
  return (
    <div>
      <p className="mono text-tomate mb-2">04 / RESUMEN</p>
      <h3 className="font-sans font-extrabold uppercase text-xl text-carbon mb-6">Todo listo para confirmar</h3>

      <div className="rounded-2xl border border-carbon/10 divide-y divide-carbon/8">
        <div className="p-4 flex items-center justify-between">
          <span className="mono text-carbon/45">SEDE</span>
          <span className="text-sm font-semibold text-carbon">{location?.name}</span>
        </div>
        <div className="p-4 flex items-center justify-between">
          <span className="mono text-carbon/45">MODO</span>
          <span className="text-sm font-semibold text-carbon">{mode === 'delivery' ? 'Entrega' : 'Recogida'}</span>
        </div>
        {arrival && (
          <div className="p-4 flex items-center justify-between">
            <span className="mono text-carbon/45">{mode === 'delivery' ? 'LLEGA HACIA LAS' : 'LISTA A LAS'}</span>
            <span className="font-sans font-extrabold text-lg text-tomate">{hourOf(arrival)}</span>
          </div>
        )}
        <div className="p-4 flex items-center justify-between">
          <span className="mono text-carbon/45">CONTACTO</span>
          <span className="text-sm font-semibold text-carbon text-right">{customer.name} · {customer.phone}</span>
        </div>
          {mode === 'delivery' && customer.address && (
          <div className="p-4 flex items-center justify-between gap-4">
            <span className="mono text-carbon/45 flex-shrink-0">DIRECCIÓN</span>
            <span className="text-sm font-semibold text-carbon text-right">
              {customer.address}{trip ? ` · ${trip.label}` : ''}
            </span>
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-col gap-3">
        {lines.map((l) => (
          <div key={l.id} className="flex items-start justify-between gap-3 text-sm">
            <span className="text-carbon/70">
              {l.qty}× {l.name}
              {l.removed?.length > 0 && (
                <span className="block text-tomate font-semibold">
                  Sin {l.removed.join(', sin ')}
                </span>
              )}
              {l.extraLabels?.length > 0 && (
                <span className="block text-albahaca">+ {l.extraLabels.join(', ')}</span>
              )}
            </span>
            <span className="mono text-carbon/60 whitespace-nowrap">{price(lineTotal(l))}</span>
          </div>
        ))}
      </div>

      <div className="mt-5 pt-5 border-t border-carbon/10 flex flex-col gap-2 text-sm">
        {(totals.discount > 0 || totals.deliveryFee > 0) && (
          <div className="flex items-center justify-between text-carbon/60">
            <span>Subtotal</span>
            <span className="mono">{price(totals.subtotal)}</span>
          </div>
        )}
        {totals.deals.map((d) => (
          <div key={d.label} className="flex items-center justify-between text-albahaca">
            <span>Llévatelas por menos · {d.count > 1 ? `${d.count}× ` : ''}{d.label} por {price(d.price)}</span>
          </div>
        ))}
        {totals.discount > 0 && (
          <div className="flex items-center justify-between font-semibold text-albahaca">
            <span>Descuento por recoger</span>
            <span className="mono">−{price(totals.discount)}</span>
          </div>
        )}
        {totals.deliveryFee > 0 && (
          <div className="flex items-center justify-between text-carbon/60">
            <span>Envío · {trip.label}</span>
            <span className="mono">+{price(totals.deliveryFee)}</span>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="mono text-carbon/50">TOTAL</span>
        <span className="font-serif italic font-semibold text-2xl text-carbon">{price(totals.total)}</span>
      </div>

      <p className="mt-4 text-xs text-carbon/40 italic">
        El pago se realiza en el local o al recibir el pedido. Esta web no procesa pagos.
      </p>
    </div>
  )
}

/* ── Estado: éxito ────────────────────────────────────────────── */
function OrderSuccess({ result, onClose }) {
  return (
    <div className="text-center py-6">
      <span className="inline-flex w-16 h-16 rounded-full bg-albahaca/10 text-albahaca items-center justify-center mb-5">
        <Pizza className="w-7 h-7" strokeWidth={1.5} />
      </span>
      <h3 className="font-sans font-extrabold uppercase text-xl text-carbon">Perfecto. Ya está en tu pedido.</h3>
      <p className="mt-2 text-carbon/55">{result?.message}</p>
      {result?.arrivalAt && (
        <p className="mt-4 font-sans font-extrabold uppercase text-lg text-tomate">
          {result.payload?.mode === 'delivery' ? 'Llega hacia las ' : 'Lista para recoger a las '}
          {hourOf(result.arrivalAt)}
        </p>
      )}
      {result?.payload?.ref && (
        <p className="mono mt-4 text-carbon/40">REF. {result.payload.ref}</p>
      )}
      <p className="mt-3 text-xs text-carbon/40 max-w-xs mx-auto">
        Recuerda: el pago se realiza en el local o al recibir el pedido.
      </p>
      <button onClick={onClose} className="btn mt-6 bg-tomate text-forno px-8">
        <span className="btn-layer bg-horno" />
        <span className="btn-label">CERRAR</span>
      </button>
    </div>
  )
}

/* ── Estado: plan B ───────────────────────────────────────────────
   La web no ha podido dejar el pedido en cocina (sin conexión o
   servidor caído). El pedido no se pierde: sale ya escrito por
   WhatsApp, se puede llamar, o reintentar. */
function OrderFallback({ result, locationId, onRetry, retrying, onDone }) {
  const { whatsappUrl, phones } = fallbackContacts(locationId, result.text)
  return (
    <div className="text-center py-4">
      <span className="inline-flex w-16 h-16 rounded-full bg-horno/15 text-horno items-center justify-center mb-5">
        <Phone className="w-7 h-7" strokeWidth={1.5} />
      </span>
      <h3 className="font-sans font-extrabold uppercase text-xl text-carbon">No hemos podido enviarlo a cocina</h3>
      <p className="mt-2 text-sm text-carbon/60 max-w-sm mx-auto">
        Tu pedido no se ha perdido. {whatsappUrl ? 'Mándanoslo por WhatsApp (ya va escrito) o llámanos.' : 'Llámanos y te lo tomamos por teléfono.'}
      </p>

      <div className="mt-6 flex flex-col gap-3 max-w-xs mx-auto">
        {whatsappUrl && (
          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="btn w-full bg-albahaca text-forno">
            <span className="btn-layer bg-carbon" />
            <span className="btn-label"><MessageCircle className="w-4 h-4" /> ENVIAR POR WHATSAPP</span>
          </a>
        )}
        {phones.map((p) => (
          <a key={p} href={`tel:+34${p.replace(/\s/g, '')}`} className="btn w-full border border-carbon/20 bg-transparent text-carbon">
            <span className="btn-layer bg-carbon/5" />
            <span className="btn-label"><Phone className="w-4 h-4" /> LLAMAR AL {p}</span>
          </a>
        ))}
        <button onClick={onRetry} disabled={retrying} className="mono normal-case mt-1 text-carbon/60 hover:text-tomate disabled:opacity-50">
          {retrying ? 'Reintentando…' : 'Volver a intentarlo por la web'}
        </button>
        <button onClick={onDone} className="mono normal-case text-carbon/40 hover:text-carbon">
          Ya lo he enviado · vaciar el carrito
        </button>
      </div>
    </div>
  )
}

/* ── Estado: error ────────────────────────────────────────────── */
function OrderError({ message, onRetry }) {
  return (
    <div className="text-center py-6">
      <span className="inline-flex w-16 h-16 rounded-full bg-tomate/10 text-tomate items-center justify-center mb-5">
        <X className="w-7 h-7" strokeWidth={1.5} />
      </span>
      <h3 className="font-sans font-extrabold uppercase text-xl text-carbon">{message || 'No hemos podido actualizar tu pedido.'}</h3>
      <button onClick={onRetry} className="btn mt-6 bg-tomate text-forno px-8">
        <span className="btn-layer bg-horno" />
        <span className="btn-label">REVISAR DE NUEVO</span>
      </button>
    </div>
  )
}
