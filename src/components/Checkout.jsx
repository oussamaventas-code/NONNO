import { useEffect, useRef, useState } from 'react'
import { X, ChevronLeft, MapPin, Package, Check, Pizza, Phone, MessageCircle, Star, Minus, Plus, Download } from 'lucide-react'
import LineIngredients from './LineIngredients'
import ScooterIcon from './ScooterIcon'
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
import { useAccount } from '../store/AccountContext'
import { LOYALTY, pointsFor, maxRedeemable } from '../data/loyalty'
import { rememberLastOrder } from '../lib/lastOrder'
import { trackPath } from '../lib/tracking'
import { navigate } from '../lib/router'
import { saveTicket } from '../lib/ticketImage'
import InstallApp from './InstallApp'
import { mobileNumber } from '../lib/customerLookup'

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
  /* Club Nonno: puntos que el cliente quiere canjear en este pedido */
  const account = useAccount()
  const [redeem, setRedeem] = useState(0)
  /* Tras pedir, el ticket hay que guardarlo antes de poder cerrar */
  const [ticketPending, setTicketPending] = useState(false)
  const handleCloseRef = useRef(() => {})

  const panelRef = useRef(null)
  const dialogRef = useRef(null)
  const bodyRef = useRef(null)
  const clientKey = useRef(null)

  useLockBodyScroll(open)
  useFocusTrap(dialogRef, open, () => handleCloseRef.current())

  useGSAP(() => {
    if (!open) return
    revealFrom(panelRef.current, { opacity: 0, duration: 0.3, ease: EASE.in })
    revealFrom(dialogRef.current, { y: 30, opacity: 0, duration: 0.45, ease: EASE.in })
  }, { dependencies: [open], scope: panelRef })

  useGSAP(() => {
    if (!open || !bodyRef.current) return
    revealFrom(bodyRef.current, { x: 16, opacity: 0, duration: 0.4, ease: 'power2.out' })
  }, { dependencies: [step], scope: panelRef })

  /* Con la sesión abierta, sus datos van ya rellenos */
  useEffect(() => {
    if (!open || account.status !== 'member') return
    const patch = {}
    if (!customer.name.trim() && account.customer.name) patch.name = account.customer.name
    if (!customer.phone.trim() && account.customer.phone) patch.phone = account.customer.phone.replace(/^\+34/, '')
    if (!customer.email?.trim() && account.customer.email) patch.email = account.customer.email
    if (Object.keys(patch).length) setCustomer(patch)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, account.status])

  /* Con la sede ya elegida (paso previo de la web) se salta el paso "sede" */
  useEffect(() => {
    if (open && step === 1 && locationId) setCheckoutStep(2)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step, locationId])

  if (!open || isEmpty) return null

  const first = locationId ? 2 : 1
  const stepLabel = { 1: 'SEDE', 2: 'MODO', 3: 'DATOS', 4: 'RESUMEN' }[step]

  const baseTotals = orderTotals({
    lines, mode: order.mode, locationId, where: { coords: customer.coords, tier: customer.tier },
  })
  const redeemMax = account.status === 'member' ? maxRedeemable(account.points, baseTotals.subtotal - baseTotals.discount) : 0
  const totals = redeem > 0
    ? orderTotals({
      lines, mode: order.mode, locationId, where: { coords: customer.coords, tier: customer.tier },
      pointsRedeemed: Math.min(redeem, redeemMax),
    })
    : baseTotals
  const pickupSaving = pickupDeals(lines).discount
  const tiers = deliveryTiers(locationId)
  const readyAt = eta?.ok ? Date.parse(eta.readyAt) : null

  const goTo = (n) => setCheckoutStep(Math.min(4, Math.max(first, n)))

  const canNext = () => {
    if (blocked) return false
    if (step === 1) return Boolean(locationId)
    if (step === 2) return Boolean(order.mode)
    if (step === 3) {
      const errs = {}
      if (!customer.name.trim()) errs.name = 'Escribe tu nombre.'
      if (!customer.phone.trim()) errs.phone = 'Escribe tu móvil.'
      else if (!mobileNumber(customer.phone)) errs.phone = 'Escribe un móvil español (empieza por 6 o 7).'
      if (customer.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(customer.email.trim())) errs.email = 'Revisa el correo.'
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
      redeemPoints: totals.pointsRedeemed,
    })
    if (result.status !== 'error') {
      clientKey.current = null
      setRedeem(0)
      if (account.status === 'member') account.refresh()
    }
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
    if (ticketPending && order.status === 'success') return
    closeCheckout()
    if (order.status === 'success') resetOrder()
  }

  handleCloseRef.current = handleClose

  return (
    <div ref={panelRef} className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
      <button className="absolute inset-0 bg-forno/70 backdrop-blur-sm" onClick={handleClose} aria-label="Cerrar" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkout-title"
        className="relative w-full sm:max-w-xl max-h-[94dvh] sm:max-h-[88vh] overflow-y-auto overflow-x-hidden bg-crema rounded-t-block sm:rounded-block shadow-float"
      >
        <div className="sticky top-0 bg-crema/95 backdrop-blur-md z-10 px-6 sm:px-8 pt-6 pb-4 border-b border-carbon/8">
          <div className="flex items-center justify-between">
            {step > first && order.status === 'idle' ? (
              <button onClick={() => goTo(step - 1)} className="w-9 h-9 rounded-full flex items-center justify-center text-carbon/60 hover:bg-carbon/5" aria-label="Paso anterior">
                <ChevronLeft className="w-5 h-5" />
              </button>
            ) : <span />}
            <h2 id="checkout-title" className="font-sans font-extrabold uppercase text-sm text-carbon/70">TU PEDIDO</h2>
            {ticketPending && order.status === 'success' ? <span className="w-9" /> : (
              <button onClick={handleClose} className="w-9 h-9 rounded-full flex items-center justify-center text-carbon/60 hover:bg-carbon/5" aria-label="Cerrar">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {order.status === 'idle' && (
            <div className="mt-4 flex items-center gap-1.5">
              {STEPS.filter((s) => s.id >= first).map((s) => (
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
            <OrderSuccess result={order.result} onClose={() => { setTicketPending(false); closeCheckout(); resetOrder() }} onTicketPending={setTicketPending} />
          )}

          {order.status === 'error' && (
            order.result?.fallback
              ? <OrderFallback result={order.result} locationId={locationId} onRetry={handleSubmit} retrying={submitting} onDone={resetOrder} />
              : <OrderError message={order.result?.message} onRetry={() => setOrderStatus('idle')} />
          )}

          {order.status === 'idle' && (
            <p className="mono text-tomate mb-2">{String(step - first + 1).padStart(2, '0')} / {stepLabel}</p>
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
              onSwitchSede={setLocation}
            />
          )}

          {order.status === 'idle' && step === 4 && (
            <>
              <ClubBox account={account} totals={totals} redeem={Math.min(redeem, redeemMax)} redeemMax={redeemMax} onRedeem={setRedeem} />
              <StepSummary lines={lines} totals={totals} location={location} mode={order.mode} customer={customer} readyAt={readyAt} />
            </>
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
                active ? 'sel-on' : 'border-carbon/12 hover:border-carbon/30',
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
      <h3 className="font-sans font-extrabold uppercase text-xl text-carbon mb-6">¿Cómo quieres tu pizza?</h3>
      <div className="grid grid-cols-2 gap-3">
        {modes.map((m) => {
          const Icon = m.id === 'pickup' ? Package : ScooterIcon
          const active = value === m.id
          return (
            <button
              key={m.id}
              onClick={() => onPick(m.id)}
              className={[
                'flex flex-col items-center gap-2 rounded-2xl border p-6 text-center transition-all',
                active ? 'sel-on' : 'border-carbon/12 hover:border-carbon/30',
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
function StepCustomer({ customer, mode, locationId, errors, onChange, onSwitchSede }) {
  const field = (key, label, placeholder, type = 'text', autoComplete) => (
    <div>
      <label htmlFor={`f-${key}`} className="mono text-carbon/50 mb-2 block">{label}</label>
      <input
        id={`f-${key}`}
        type={type}
        autoComplete={autoComplete}
        inputMode={type === 'tel' ? 'tel' : undefined}
        value={customer[key]}
        onChange={(e) => onChange({ [key]: e.target.value })}
        placeholder={placeholder}
        className={[
          'w-full rounded-2xl border bg-white/60 px-4 py-3 text-sm text-carbon placeholder:text-carbon/35 outline-none transition-colors',
          errors[key] ? 'border-tomate' : 'border-carbon/12 focus:border-tomate',
        ].join(' ')}
      />
      {errors[key] && <p className="mt-1 text-xs text-tomate">{errors[key] === true ? 'Este campo es necesario.' : errors[key]}</p>}
    </div>
  )

  return (
    <div>
      <h3 className="font-sans font-extrabold uppercase text-xl text-carbon mb-6">¿A nombre de quién?</h3>
      <div className="flex flex-col gap-5">
        {field('name', 'NOMBRE', 'Tu nombre', 'text', 'given-name')}
        <div>
          {field('phone', 'TELÉFONO MÓVIL', '600 000 000', 'tel', 'tel')}
          <p className="mt-1.5 text-xs text-carbon/45">Por si la tienda necesita llamarte.</p>
        </div>
        <div>
          {field('email', 'CORREO (OPCIONAL)', 'tucorreo@gmail.com', 'email', 'email')}
          <p className="mt-1.5 text-xs text-carbon/45">Te mandamos el ticket del pedido a tu correo.</p>
          {customer.email?.trim() && (
            <label className="mt-3 flex items-start gap-3 text-xs text-carbon/70">
              <input type="checkbox" checked={Boolean(customer.marketing)} onChange={(e) => onChange({ marketing: e.target.checked })} className="mt-0.5 h-5 w-5 accent-tomate flex-shrink-0" />
              Quiero recibir ofertas y novedades de La Pizza de Nonno por correo.
            </label>
          )}
        </div>
        {mode === 'delivery' && (
          <DeliveryPicker
            locationId={locationId}
            value={customer}
            onChange={onChange}
            invalid={errors.delivery}
            onSwitchSede={onSwitchSede}
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

/* ── Club Nonno en el resumen ─────────────────────────────────── */
function ClubBox({ account, totals, redeem, redeemMax, onRedeem }) {
  const earn = pointsFor(totals.total)
  if (account.status === 'off' || account.status === 'loading') return null

  if (account.status === 'guest') {
    return (
      <button
        onClick={account.openAccount}
        className="mb-6 w-full text-left rounded-md border border-dashed border-tomate bg-tomate/5 px-4 py-3 text-sm text-tomate"
      >
        <span className="font-semibold">Con este pedido ganarías {earn} puntos del {LOYALTY.name}.</span>{' '}
        <span className="underline underline-offset-4">Entra con tu móvil</span>
      </button>
    )
  }

  const step = LOYALTY.redeemStep
  return (
    <div className="mb-6 rounded-md border border-tomate bg-tomate/5 px-4 py-3">
      <p className="flex items-center gap-2 text-sm font-semibold text-tomate">
        <Star className="w-4 h-4 fill-tomate" strokeWidth={0} />
        Tienes {account.points} puntos · con este pedido ganas {earn}
      </p>
      {redeemMax > 0 ? (
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-sm text-carbon">
            {redeem > 0 ? `Usas ${redeem} puntos: −${price(totals.pointsDiscount)}` : `Puedes usar hasta ${redeemMax} puntos`}
          </span>
          <span className="flex items-center gap-2">
            <button onClick={() => onRedeem(Math.max(0, redeem - step))} disabled={redeem <= 0} className="w-8 h-8 rounded-full border border-tomate text-tomate flex items-center justify-center disabled:opacity-30" aria-label="Usar menos puntos">
              <Minus className="w-4 h-4" />
            </button>
            <button onClick={() => onRedeem(Math.min(redeemMax, redeem + step))} disabled={redeem >= redeemMax} className="w-8 h-8 rounded-full bg-tomate text-masa flex items-center justify-center disabled:opacity-30" aria-label="Usar más puntos">
              <Plus className="w-4 h-4" />
            </button>
          </span>
        </div>
      ) : (
        <p className="mt-1 text-xs text-carbon/60">A partir de {step} puntos puedes usarlos como descuento ({price(LOYALTY.stepValue)} cada {step}).</p>
      )}
    </div>
  )
}

/* ── Paso 4: resumen ──────────────────────────────────────────── */
function StepSummary({ lines, totals, location, mode, customer, readyAt }) {
  const trip = mode === 'delivery' && totals.delivery?.ok ? totals.delivery : null
  const arrival = readyAt && (trip ? readyAt + trip.minutes * 60000 : readyAt)
  return (
    <div>
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
              <LineIngredients removed={l.removed} extras={l.extraLabels} className="font-semibold" />
            </span>
            <span className="mono text-carbon/60 whitespace-nowrap">{price(lineTotal(l))}</span>
          </div>
        ))}
      </div>

      <div className="mt-5 pt-5 border-t border-carbon/10 flex flex-col gap-2 text-sm">
        {(totals.discount > 0 || totals.deliveryFee > 0 || totals.pointsDiscount > 0) && (
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
        {totals.pointsDiscount > 0 && (
          <div className="flex items-center justify-between font-semibold text-albahaca">
            <span>Puntos {LOYALTY.name} ({totals.pointsRedeemed})</span>
            <span className="mono">−{price(totals.pointsDiscount)}</span>
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
function OrderSuccess({ result, onClose, onTicketPending }) {
  /* Paso 1: guardar el ticket (obligatorio) · paso 2: instalar la app ·
     paso 3: seguir el pedido */
  const [stage, setStage] = useState('ticket')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const order = result?.payload
  const delivery = order?.mode === 'delivery'

  /* El pedido queda apuntado en este navegador para poder seguirlo */
  useEffect(() => {
    if (result?.track) rememberLastOrder(result.track, result.payload?.ref)
  }, [result?.track, result?.payload?.ref])

  /* No se puede cerrar hasta guardar el ticket */
  useEffect(() => {
    onTicketPending?.(!saved)
    return () => onTicketPending?.(false)
  }, [saved, onTicketPending])

  const save = async () => {
    setSaving(true)
    try {
      await saveTicket(order, result?.arrivalAt)
    } catch (err) {
      console.warn('No se pudo guardar el ticket', err)
    }
    setSaving(false)
    setSaved(true)
  }

  const follow = () => {
    onClose()
    if (result?.track) navigate(trackPath(result.track))
  }

  if (stage === 'app') return <InstallApp big onDone={() => setStage('fin')} />

  if (stage === 'fin') {
    return (
      <div className="text-center py-10">
        <p className="font-sans font-extrabold uppercase text-xl text-carbon">¡Todo listo!</p>
        <p className="mt-2 text-carbon/60">Ya puedes ver cómo va tu pedido.</p>
        <button onClick={follow} className="btn-retro mt-6"><span>Sigue tu pedido</span></button>
      </div>
    )
  }

  return (
    <div className="text-center py-6">
      <span className="inline-flex w-16 h-16 rounded-full bg-albahaca/10 text-albahaca items-center justify-center mb-5">
        <Check className="w-8 h-8" strokeWidth={2.5} />
      </span>
      <h3 className="font-sans font-extrabold uppercase text-xl text-carbon">¡Pedido recibido!</h3>
      {order?.ref && <p className="mt-2 font-display font-bold text-5xl text-queso">{order.ref}</p>}
      {result?.arrivalAt && (
        <p className="mt-3 font-sans font-extrabold uppercase text-lg text-tomate">
          {delivery ? 'Llega hacia las ' : 'Lista para recoger a las '}
          {hourOf(result.arrivalAt)}
        </p>
      )}
      {order?.customer?.email && (
        <p className="mt-3 text-sm text-carbon/60">Te hemos mandado el ticket a <strong>{order.customer.email}</strong>.</p>
      )}
      <p className="mt-2 text-xs text-carbon/45 max-w-xs mx-auto">El pago se realiza en el local o al recibir el pedido.</p>

      <div className="mt-6 rounded-md border border-tomate bg-tomate/5 px-4 py-4">
        <p className="font-semibold text-carbon">Guarda tu ticket en el móvil</p>
        <p className="mt-1 text-xs text-carbon/60">Enséñalo al recoger o al recibir el pedido.</p>
        <button onClick={save} disabled={saving} className="btn-retro mt-4">
          <span className="flex items-center justify-center gap-2">
            <Download className="w-5 h-5" /> {saving ? 'GUARDANDO…' : saved ? 'GUARDAR OTRA VEZ' : 'GUARDAR MI TICKET'}
          </span>
        </button>
      </div>

      {saved && (
        <button onClick={() => setStage(result?.track ? 'app' : 'fin')} className="btn mt-5 w-full bg-tomate text-masa">
          <span className="btn-layer bg-forno" />
          <span className="btn-label">CONTINUAR →</span>
        </button>
      )}
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
