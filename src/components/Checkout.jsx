import { useRef, useState } from 'react'
import { X, ChevronLeft, MapPin, Package, Truck, Check, Pizza } from 'lucide-react'
import { LOCATIONS } from '../data/locations'
import { useStore, useActions, useCart, useSelectedLocation } from '../store/StoreContext'
import { useLockBodyScroll } from '../hooks/useLockBodyScroll'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { submitOrder } from '../lib/orderGateway'
import { price } from '../lib/format'
import { lineTotal } from '../lib/pricing'
import { gsap, useGSAP, EASE } from '../lib/motion'

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
  const { lines, subtotal, isEmpty } = useCart()
  const { locationId, location, modes } = useSelectedLocation()

  const open = ui.checkoutOpen
  const step = ui.checkoutStep
  const [fieldErrors, setFieldErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  const panelRef = useRef(null)
  const dialogRef = useRef(null)
  const bodyRef = useRef(null)

  useLockBodyScroll(open)
  useFocusTrap(dialogRef, open, closeCheckout)

  useGSAP(() => {
    if (!open) return
    gsap.from(panelRef.current, { opacity: 0, duration: 0.3, ease: EASE.in })
    gsap.from(dialogRef.current, { y: 30, opacity: 0, duration: 0.45, ease: EASE.in })
  }, { dependencies: [open], scope: panelRef })

  useGSAP(() => {
    if (!open || !bodyRef.current) return
    gsap.from(bodyRef.current, { x: 16, opacity: 0, duration: 0.4, ease: 'power2.out' })
  }, { dependencies: [step], scope: panelRef })

  if (!open || isEmpty) return null

  const goTo = (n) => setCheckoutStep(Math.min(4, Math.max(1, n)))

  const canNext = () => {
    if (step === 1) return Boolean(locationId)
    if (step === 2) return Boolean(order.mode)
    if (step === 3) {
      const errs = {}
      if (!customer.name.trim()) errs.name = true
      if (!customer.phone.trim()) errs.phone = true
      if (order.mode === 'delivery' && !customer.address.trim()) errs.address = true
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
    setSubmitting(true)
    const result = await submitOrder({ lines, locationId, mode: order.mode, customer })
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
          {order.status === 'success' && (
            <OrderSuccess result={order.result} onClose={handleClose} />
          )}

          {order.status === 'error' && (
            <OrderError message={order.result?.message} onRetry={() => setOrderStatus('idle')} />
          )}

          {order.status === 'idle' && step === 1 && (
            <StepLocation locationId={locationId} onPick={setLocation} />
          )}

          {order.status === 'idle' && step === 2 && (
            <StepMode modes={modes} value={order.mode} onPick={setMode} location={location} />
          )}

          {order.status === 'idle' && step === 3 && (
            <StepCustomer
              customer={customer}
              mode={order.mode}
              errors={fieldErrors}
              onChange={(patch) => { setCustomer(patch); setFieldErrors({}) }}
            />
          )}

          {order.status === 'idle' && step === 4 && (
            <StepSummary lines={lines} subtotal={subtotal} location={location} mode={order.mode} customer={customer} />
          )}
        </div>

        {order.status === 'idle' && (
          <div className="sticky bottom-0 bg-crema/95 backdrop-blur-md px-6 sm:px-8 py-5 border-t border-carbon/8 pb-safe">
            {step < 4 ? (
              <button onClick={handleNext} className="btn w-full bg-tomate text-crema">
                <span className="btn-layer bg-horno" />
                <span className="btn-label">CONTINUAR →</span>
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={submitting} className="btn w-full bg-tomate text-crema disabled:opacity-60">
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
              <span className={['w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0', active ? 'bg-tomate text-crema' : 'bg-carbon/8 text-carbon/50'].join(' ')}>
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
function StepMode({ modes, value, onPick, location }) {
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
function StepCustomer({ customer, mode, errors, onChange }) {
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
        {field('phone', 'TELÉFONO', '600 000 000', 'tel')}
        {mode === 'delivery' && field('address', 'DIRECCIÓN DE ENTREGA', 'Calle, número, piso')}
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
function StepSummary({ lines, subtotal, location, mode, customer }) {
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
        <div className="p-4 flex items-center justify-between">
          <span className="mono text-carbon/45">CONTACTO</span>
          <span className="text-sm font-semibold text-carbon text-right">{customer.name} · {customer.phone}</span>
        </div>
        {customer.address && (
          <div className="p-4 flex items-center justify-between gap-4">
            <span className="mono text-carbon/45 flex-shrink-0">DIRECCIÓN</span>
            <span className="text-sm font-semibold text-carbon text-right">{customer.address}</span>
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-col gap-3">
        {lines.map((l) => (
          <div key={l.id} className="flex items-center justify-between text-sm">
            <span className="text-carbon/70">{l.qty}× {l.name}{l.sizeLabel ? ` (${l.sizeLabel})` : ''}</span>
            <span className="mono text-carbon/60">{price(lineTotal(l))}</span>
          </div>
        ))}
      </div>

      <div className="mt-5 pt-5 border-t border-carbon/10 flex items-center justify-between">
        <span className="mono text-carbon/50">TOTAL</span>
        <span className="font-serif italic font-semibold text-2xl text-carbon">{price(subtotal)}</span>
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
      {result?.payload?.ref && (
        <p className="mono mt-4 text-carbon/40">REF. {result.payload.ref}</p>
      )}
      <p className="mt-3 text-xs text-carbon/40 max-w-xs mx-auto">
        Recuerda: el pago se realiza en el local o al recibir el pedido.
      </p>
      <button onClick={onClose} className="btn mt-6 bg-carbon text-crema px-8">
        <span className="btn-layer bg-tomate" />
        <span className="btn-label">CERRAR</span>
      </button>
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
      <button onClick={onRetry} className="btn mt-6 bg-tomate text-crema px-8">
        <span className="btn-layer bg-horno" />
        <span className="btn-label">REVISAR DE NUEVO</span>
      </button>
    </div>
  )
}
