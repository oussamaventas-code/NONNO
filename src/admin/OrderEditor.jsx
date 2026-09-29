import { useEffect, useRef, useState } from 'react'
import { X, Minus, Plus, Trash2, SlidersHorizontal, Check, Clock, Store, Phone, Printer, Beef, Salad, Milk, Droplets, Fish, Egg } from 'lucide-react'
import { CATEGORIES, productsByCategory, getProduct, getExtra, priceOf, isSoldOut } from '../data/menu'
import { getLocation } from '../data/locations'
import { buildLine, lineTotal } from '../lib/pricing'
import { orderTotals } from '../lib/orderTotals'
import { ovenUnits, hourOf } from '../lib/kitchenSlots'
import { price } from '../lib/format'
import { deliveryTiers, deliveryProblem } from '../lib/delivery'
import DeliveryPicker from '../components/DeliveryPicker'
import ProductImage from '../components/ProductImage'
import { createOrder, editOrder, fetchSlots, fetchCustomer } from './api'
import { phoneKey } from '../lib/customerLookup'
import { enqueue, isConnectionError, newClientKey } from './offlineQueue'
import { printTicket } from './printTicket'

/* ═══════════════════════════════════════════════════════════════
   EDITOR DE PEDIDOS DEL MOSTRADOR
   Crear un pedido desde cero (en el mostrador o por teléfono) o
   cambiar uno existente. Tocar un producto lo añade tal cual; cada
   línea se ajusta después (ración, quitar ingredientes, toppings,
   nota). Precios, ofertas, envío y franja los calcula el servidor
   con las mismas reglas que la web.
   ═══════════════════════════════════════════════════════════════ */

const EMPTY_CUSTOMER = { name: '', phone: '', address: '', coords: null, tier: null, notes: '' }

const selectionOf = (l) => ({
  productId: l.productId, portionId: l.portionId, extraIds: l.extraIds,
  removed: l.removed, note: l.note, qty: l.qty,
})

/** Añade una línea juntándola con otra idéntica si ya existe. */
function mergeLine(lines, line) {
  const same = lines.find((l) => l.id === line.id)
  return same
    ? lines.map((l) => (l.id === line.id ? { ...l, qty: l.qty + line.qty } : l))
    : [...lines, line]
}

function linesFromOrder(order) {
  return (order.items || [])
    .map((i) => buildLine({
      productId: i.id,
      portionId: i.portionId || undefined,
      extraIds: i.extraIds || [],
      removed: i.removed || [],
      note: i.note || '',
      qty: i.qty,
    }))
    .filter(Boolean)
}

function customerFromOrder(order) {
  const verified = order.delivery_verified && order.delivery_lat != null
  /* Pedidos nuevos ya guardan el tramo elegido a mano tal cual. Los
     anteriores a este cambio no tienen esa columna: para esos se
     reconstruye comparando con la tarifa guardada (plan B del plan B). */
  const tier = order.mode === 'delivery' && !verified
    ? (Number.isInteger(order.delivery_tier)
      ? order.delivery_tier
      : deliveryTiers(order.location_id).findIndex((t) => t.fee === Number(order.delivery_fee)))
    : -1
  return {
    name: order.customer_name || '',
    phone: order.customer_phone || '',
    address: order.address || '',
    coords: verified ? { lat: order.delivery_lat, lng: order.delivery_lng } : null,
    tier: tier >= 0 ? tier : null,
    notes: order.notes || '',
  }
}

export default function OrderEditor({ order, locationIds, defaultLocationId, defaultChannel = 'mostrador', onClose, onSaved }) {
  const editing = Boolean(order)
  const [locId, setLocId] = useState(order?.location_id || defaultLocationId)
  const location = getLocation(locId)

  const [lines, setLines] = useState(() => (editing ? linesFromOrder(order) : []))
  const [mode, setMode] = useState(order?.mode || 'pickup')
  const [customer, setCustomer] = useState(() => (editing ? customerFromOrder(order) : EMPTY_CUSTOMER))
  const [channel, setChannel] = useState(order?.channel || defaultChannel)
  const [paidNow, setPaidNow] = useState(false)
  const [method, setMethod] = useState('efectivo')

  const [cat, setCat] = useState(CATEGORIES[0].id)
  const [openLine, setOpenLine] = useState(null)
  const [eta, setEta] = useState(null)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [offline, setOffline] = useState(false)
  /* Una clave por pedido: si se reintenta, el servidor no lo duplica. */
  const clientKey = useRef(newClientKey())

  const pizzas = ovenUnits(lines)
  const totals = orderTotals({
    lines, mode, locationId: locId, where: { coords: customer.coords, tier: customer.tier },
    /* Los puntos que el cliente ya canjeó se mantienen al editar */
    pointsRedeemed: Number(order?.points_redeemed) || 0,
  })
  const trip = mode === 'delivery' && totals.delivery?.ok ? totals.delivery : null
  const canDeliver = Boolean(location?.services.delivery)

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(() => {
      fetchSlots(locId, pizzas)
        .then((d) => { if (!cancelled) setEta(d) })
        .catch(() => { if (!cancelled) setEta(null) })
    }, 300)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [locId, pizzas])

  const patchCustomer = (patch) => { setCustomer((c) => ({ ...c, ...patch })); setError(null) }

  /* Cliente conocido: al escribir su teléfono aparece su ficha y se puede
     repetir su último pedido. Si falla la búsqueda o no hay conexión, el
     pedido se toma igual: esto solo ahorra tecleo. */
  const [known, setKnown] = useState(null)
  const [dropped, setDropped] = useState(0)
  useEffect(() => {
    if (editing) return undefined
    if (phoneKey(customer.phone).length < 9) { setKnown(null); return undefined }
    let cancelled = false
    const timer = setTimeout(() => {
      fetchCustomer(customer.phone)
        .then((d) => {
          if (cancelled) return
          setKnown(d.customer)
          if (d.customer?.name) setCustomer((c) => (c.name.trim() ? c : { ...c, name: d.customer.name }))
        })
        .catch(() => { if (!cancelled) setKnown(null) })
    }, 450)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [customer.phone, editing])

  const repeatOrder = (past) => {
    const rebuilt = linesFromOrder(past)
    setDropped((past.items || []).length - rebuilt.length)
    setLines((prev) => rebuilt.reduce((acc, l) => mergeLine(acc, l), prev))
    setError(null)
  }

  /* Su dirección de la última entrega. El tramo de precio solo se
     reutiliza si fue en esta misma sede: las tarifas son por sede. */
  const useKnownAddress = () => {
    const past = known.orders.find((o) => o.mode === 'delivery' && o.address)
    if (!past) return
    const saved = customerFromOrder({ ...past, notes: '' })
    setMode('delivery')
    patchCustomer({
      address: saved.address,
      coords: saved.coords,
      tier: past.location_id === locId ? saved.tier : null,
    })
  }

  const addProduct = (productId) => {
    const line = buildLine({ productId, qty: 1 })
    if (line) setLines((prev) => mergeLine(prev, line))
    setError(null)
  }

  const setQty = (id, qty) =>
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, qty } : l)).filter((l) => l.qty > 0))

  /* Cambiar ración/toppings/ingredientes cambia la identidad de la
     línea: se reconstruye y, si coincide con otra, se juntan. */
  const updateLine = (id, patch) => {
    const idx = lines.findIndex((l) => l.id === id)
    if (idx < 0) return
    const rebuilt = buildLine({ ...selectionOf(lines[idx]), ...patch })
    if (!rebuilt) return
    const rest = lines.filter((l) => l.id !== id)
    if (rest.some((l) => l.id === rebuilt.id)) {
      setLines(rest.map((l) => (l.id === rebuilt.id ? { ...l, qty: l.qty + rebuilt.qty } : l)))
    } else {
      rest.splice(idx, 0, rebuilt)
      setLines(rest)
    }
    setOpenLine(rebuilt.id)
  }

  const problem = () => {
    if (!lines.length) return 'Añade al menos un producto.'
    if (!customer.name.trim()) return 'Falta el nombre del cliente.'
    if (channel === 'telefono' && !customer.phone.trim()) return 'En pedidos por teléfono hace falta el teléfono.'
    if (mode === 'delivery') {
      if (!customer.address.trim()) return 'Falta la dirección de entrega.'
      if (!trip) return deliveryProblem(totals.delivery)
      if (!customer.phone.trim()) return 'Para una entrega hace falta el teléfono.'
    }
    return null
  }

  const buildPayload = () => ({
    location: { id: locId },
    mode,
    channel,
    customer: mode === 'delivery' ? customer : { ...customer, coords: null, tier: null },
    items: lines.map((l) => ({
      id: l.productId, portionId: l.portionId, extraIds: l.extraIds,
      removed: l.removed, note: l.note, qty: l.qty,
    })),
    paymentStatus: paidNow ? 'pagado' : 'pendiente',
    paymentMethod: method,
    clientKey: clientKey.current,
  })

  const save = async () => {
    const p = problem()
    if (p) { setError(p); return }
    setSaving(true)
    setError(null)
    setOffline(false)
    const payload = buildPayload()
    try {
      const res = editing
        ? await editOrder(order.id, { items: payload.items, mode, customer: payload.customer })
        : await createOrder(payload)
      onSaved(res.order, { isNew: !editing })
    } catch (err) {
      /* Sin conexión con el servidor: en un pedido nuevo se ofrece el plan B. */
      if (!editing && isConnectionError(err)) setOffline(true)
      setError(isConnectionError(err) ? 'No hay conexión con el servidor.' : err.message)
      setSaving(false)
    }
  }

  /* PLAN B: la comanda sale ya en papel y el pedido espera en este
     equipo hasta que vuelva la conexión (ver offlineQueue.js). */
  const saveOffline = () => {
    const now = new Date()
    const ref = `SC-${now.toTimeString().slice(0, 8).replace(/:/g, '')}`
    const payload = { ...buildPayload(), ref, offlineAt: now.toISOString() }
    const local = {
      id: `offline:${payload.clientKey}`,
      offline: true,
      ref,
      created_at: payload.offlineAt,
      status: 'nuevo',
      channel,
      mode,
      location_id: locId,
      location_name: location.name,
      customer_name: customer.name.trim(),
      customer_phone: customer.phone.trim(),
      address: mode === 'delivery' ? customer.address.trim() : null,
      notes: customer.notes.trim() || null,
      delivery_zone: trip?.label || null,
      items: lines.map((l) => ({
        id: l.productId, name: l.name, category: l.category, size: l.sizeLabel,
        extras: l.extraLabels, removed: l.removed, note: l.note || null,
        qty: l.qty, unitPrice: l.unitPrice, total: lineTotal(l),
      })),
      subtotal: totals.subtotal,
      discount: totals.discount,
      deals: totals.deals,
      delivery_fee: totals.deliveryFee,
      total: totals.total,
      payment_status: paidNow ? 'pagado' : 'pendiente',
      payment_method: paidNow ? method : null,
    }
    enqueue({ payload, order: local })
    printTicket(local)
    onSaved(local, { isNew: true })
  }

  return (
    <div className="fixed inset-0 z-50 bg-masa flex flex-col" role="dialog" aria-modal="true" aria-labelledby="editor-title">
      {/* Cabecera */}
      <div className="flex items-center justify-between gap-3 border-b border-tomate bg-masa px-4 sm:px-6 py-3">
        <div>
          <h2 id="editor-title" className="font-sans font-extrabold uppercase text-lg text-tomate">
            {editing ? `Editar ${order.ref}` : 'Nuevo pedido'}
          </h2>
          <p className="mono normal-case text-carbon/50">{location?.name}</p>
        </div>
        <button onClick={onClose} className="w-11 h-11 rounded-md border border-tomate/50 flex items-center justify-center text-tomate hover:bg-tomate/10" aria-label="Cerrar sin guardar">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 min-h-0 grid lg:grid-cols-[1fr_26rem]">
        {/* ── Carta ─────────────────────────────────────────────── */}
        <section className="min-h-0 overflow-y-auto p-4 sm:p-6">
          <div className="hide-scrollbar flex gap-2 overflow-x-auto pb-3">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                onClick={() => setCat(c.id)}
                className={[
                  'ptab',
                  cat === c.id ? 'is-on' : '',
                ].join(' ')}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            {productsByCategory(cat).map((p) => {
              const agotado = isSoldOut(p.id, locId)
              return (
              <button
                key={p.id}
                onClick={() => addProduct(p.id)}
                disabled={agotado}
                className={[
                  'pcard overflow-hidden text-left flex flex-col transition-transform',
                  agotado ? 'opacity-45 grayscale cursor-not-allowed' : 'active:translate-x-px active:translate-y-px hover:-translate-y-0.5',
                ].join(' ')}
              >
                <span className="relative block aspect-[4/3] border-b border-tomate">
                  <ProductImage
                    image={p.image}
                    category={p.category}
                    alt=""
                    width={400}
                    className="absolute inset-0 w-full h-full !bg-queso/50"
                    iconClassName="w-10 h-10"
                  />
                  <span className="absolute bottom-1.5 right-1.5 rounded-md bg-tomate px-2 py-1 font-mono text-xs font-bold leading-none text-masa">
                    {agotado ? 'AGOTADO' : price(priceOf(p))}
                  </span>
                </span>
                <span className="block p-2.5">
                  <span className="block font-sans font-extrabold uppercase text-sm text-tomate leading-tight">{p.name}</span>
                  <span className="mt-1 block text-xs leading-snug text-carbon/70 line-clamp-2">
                    {p.ingredients?.length ? p.ingredients.join(' · ') : p.description}
                  </span>
                </span>
              </button>
              )
            })}
          </div>
        </section>

        {/* ── Ticket ────────────────────────────────────────────── */}
        <aside className="min-h-0 overflow-y-auto border-t lg:border-t-0 lg:border-l border-tomate/25 bg-crema p-4 sm:p-5 flex flex-col gap-5">
          {!editing && locationIds.length > 1 && (
            <div className="flex gap-2">
              {locationIds.map((id) => (
                <button
                  key={id}
                  onClick={() => { setLocId(id); if (!getLocation(id).services.delivery) setMode('pickup') }}
                  className={[
                    'flex-1 rounded-md border px-3 py-2 text-sm font-semibold',
                    locId === id ? 'border-tomate bg-tomate/5 text-carbon' : 'border-tomate/50 text-carbon/60',
                  ].join(' ')}
                >
                  {getLocation(id).name}
                </button>
              ))}
            </div>
          )}

          {!editing && (
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'mostrador', label: 'Mostrador', Icon: Store },
                { id: 'telefono', label: 'Teléfono', Icon: Phone },
              ].map(({ id, label, Icon }) => (
                <button
                  key={id}
                  onClick={() => setChannel(id)}
                  className={[
                    'flex items-center justify-center gap-2 rounded-md border px-3 py-2.5 text-sm font-semibold',
                    channel === id ? 'border-tomate bg-tomate text-masa' : 'border-tomate/50 text-tomate',
                  ].join(' ')}
                >
                  <Icon className="w-4 h-4" /> {label}
                </button>
              ))}
            </div>
          )}

          {/* Líneas */}
          <div>
            <p className="mono text-tomate mb-2">PEDIDO</p>
            {lines.length === 0 ? (
              <p className="rounded-md border border-dashed border-tomate/50 px-4 py-6 text-center text-sm text-carbon/45">
                Toca productos de la carta para añadirlos.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {lines.map((l) => (
                  <li key={l.id} className="rounded-md border border-tomate/25 bg-masa">
                    <div className="flex items-start gap-2.5 p-3">
                      <ProductImage
                        image={getProduct(l.productId)?.image}
                        category={getProduct(l.productId)?.category}
                        alt=""
                        width={120}
                        className="w-12 h-12 flex-shrink-0 rounded-md border border-tomate/40 !bg-queso/50"
                        iconClassName="w-5 h-5"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-sans font-bold text-sm text-carbon">{l.name}</p>
                        {l.sizeLabel && getProduct(l.productId)?.portions && (
                          <p className="mono normal-case text-carbon/50">{l.sizeLabel}</p>
                        )}
                        {l.removed.length > 0 && <p className="text-xs font-bold text-tomate">SIN {l.removed.join(' · SIN ').toUpperCase()}</p>}
                        {l.extraLabels.length > 0 && <p className="text-xs text-albahaca">+ {l.extraLabels.join(', ')}</p>}
                        {l.note && <p className="text-xs italic text-carbon/60">"{l.note}"</p>}
                      </div>
                      <span className="mono text-carbon/70 whitespace-nowrap">{price(lineTotal(l))}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 border-t border-tomate/25 px-2 py-1.5">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setQty(l.id, l.qty - 1)} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-tomate/10" aria-label="Quitar una">
                          {l.qty === 1 ? <Trash2 className="w-4 h-4 text-tomate" /> : <Minus className="w-4 h-4" />}
                        </button>
                        <span className="w-6 text-center font-bold text-carbon">{l.qty}</span>
                        <button onClick={() => setQty(l.id, l.qty + 1)} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-tomate/10" aria-label="Añadir una">
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      <button
                        onClick={() => setOpenLine(openLine === l.id ? null : l.id)}
                        className="mono normal-case flex items-center gap-1.5 rounded-md px-3 py-1.5 text-carbon/70 hover:bg-tomate/10"
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" /> {openLine === l.id ? 'Cerrar' : 'Ajustar'}
                      </button>
                    </div>
                    {openLine === l.id && <LineOptions line={l} onChange={(patch) => updateLine(l.id, patch)} />}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Cliente */}
          <div className="flex flex-col gap-3">
            <p className="mono text-tomate">CLIENTE</p>
            <Input label="Nombre" value={customer.name} onChange={(v) => patchCustomer({ name: v })} />
            <Input
              label={channel === 'mostrador' && mode === 'pickup' ? 'Teléfono (opcional)' : 'Teléfono'}
              type="tel"
              value={customer.phone}
              onChange={(v) => patchCustomer({ phone: v })}
            />

            {known && !editing && (
              <KnownCustomer
                known={known}
                canUseAddress={canDeliver && known.orders.some((o) => o.mode === 'delivery' && o.address)}
                dropped={dropped}
                onRepeat={repeatOrder}
                onAddress={useKnownAddress}
              />
            )}

            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'pickup', label: 'Recoge' },
                ...(canDeliver ? [{ id: 'delivery', label: 'Entrega' }] : []),
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={[
                    'rounded-md border px-3 py-2.5 text-sm font-semibold',
                    mode === m.id ? 'border-tomate bg-tomate/5 text-carbon' : 'border-tomate/50 text-carbon/60',
                  ].join(' ')}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {mode === 'delivery' && (
              <DeliveryPicker locationId={locId} value={customer} onChange={patchCustomer} compact />
            )}
            <Input label="Notas (opcional)" value={customer.notes} onChange={(v) => patchCustomer({ notes: v })} />
          </div>

          {/* Totales y hora */}
          <div className="rounded-md bg-carbon/5 p-4 flex flex-col gap-1.5 text-sm">
            {(totals.discount > 0 || totals.deliveryFee > 0 || totals.pointsDiscount > 0) && (
              <Row label="Subtotal" value={price(totals.subtotal)} />
            )}
            {totals.deals.map((d) => (
              <p key={d.label} className="text-albahaca text-xs">Oferta {d.count > 1 ? `${d.count}× ` : ''}{d.label} por {price(d.price)}</p>
            ))}
            {totals.discount > 0 && <Row label="Descuento recogida" value={`−${price(totals.discount)}`} tone="text-albahaca font-semibold" />}
            {totals.pointsDiscount > 0 && <Row label={`Puntos Club Nonno (${totals.pointsRedeemed})`} value={`−${price(totals.pointsDiscount)}`} tone="text-albahaca font-semibold" />}
            {trip && <Row label={`Envío · ${trip.label}`} value={`+${price(trip.fee)}`} />}
            <div className="flex items-center justify-between pt-1">
              <span className="mono text-carbon/60">TOTAL</span>
              <span className="font-serif italic font-semibold text-3xl text-carbon">{price(totals.total)}</span>
            </div>
            {eta && (
              <p className={['mt-1 flex items-center gap-1.5 font-semibold', eta.ok ? 'text-carbon' : 'text-tomate'].join(' ')}>
                <Clock className="w-4 h-4" />
                {eta.ok
                  ? `${trip
                    ? `Llega hacia las ${hourOf(Date.parse(eta.readyAt) + trip.minutes * 60000)}`
                    : `Listo a las ${hourOf(eta.readyAt)}`}${editing ? ' (aprox.)' : ''} · ${pizzas} al horno`
                  : eta.message}
              </p>
            )}
          </div>

          {!editing && (
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-carbon">
                <input type="checkbox" checked={paidNow} onChange={(e) => setPaidNow(e.target.checked)} className="w-5 h-5 accent-albahaca" />
                Ya está pagado
              </label>
              {paidNow && (
                <div className="grid grid-cols-2 gap-2">
                  {['efectivo', 'tarjeta'].map((m) => (
                    <button
                      key={m}
                      onClick={() => setMethod(m)}
                      className={[
                        'rounded-md border px-3 py-2 text-sm font-semibold capitalize',
                        method === m ? 'border-tomate bg-tomate text-masa' : 'border-tomate/50 text-tomate',
                      ].join(' ')}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {error && (
            <p className="rounded-md border border-tomate/30 bg-tomate/5 px-4 py-3 text-sm text-tomate">{error}</p>
          )}

          {offline && (
            <div className="rounded-md border-2 border-horno bg-horno/10 p-4">
              <p className="text-sm font-semibold text-carbon">Plan B: trabajar sin conexión</p>
              <p className="mt-1 text-sm text-carbon/70">
                Se imprime la comanda para cocina y el pedido se guarda en este equipo. Se enviará solo al sistema en cuanto vuelva la conexión.
              </p>
              <button onClick={saveOffline} className="btn mt-3 w-full bg-horno text-crema">
                <span className="btn-layer bg-carbon" />
                <span className="btn-label"><Printer className="w-4 h-4" /> IMPRIMIR COMANDA Y GUARDAR</span>
              </button>
            </div>
          )}

          <button
            onClick={save}
            disabled={saving || eta?.ok === false}
            className="btn w-full bg-tomate text-crema disabled:opacity-50"
          >
            <span className="btn-layer bg-horno" />
            <span className="btn-label">
              <Check className="w-4 h-4" />
              {saving ? 'GUARDANDO…' : editing ? 'GUARDAR CAMBIOS' : `CREAR PEDIDO · ${price(totals.total)}`}
            </span>
          </button>
        </aside>
      </div>
    </div>
  )
}

/* Grupos de toppings, en el orden en que se piden en el mostrador */
const TOPPING_GROUPS = [
  { id: 'Carnes', label: 'Carnes', Icon: Beef },
  { id: 'Verduras', label: 'Verduras', Icon: Salad },
  { id: 'Quesos', label: 'Quesos', Icon: Milk },
  { id: 'Salsas y toques', label: 'Salsas', Icon: Droplets },
  { id: 'Del mar', label: 'Del mar', Icon: Fish },
  { id: 'Otros', label: 'Otros', Icon: Egg },
]

/* Opciones de una línea: ración, quitar ingredientes, toppings, nota */
function LineOptions({ line, onChange }) {
  const product = getProduct(line.productId)
  const toggle = (list, value) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value])

  const extras = (product.extras || []).map(getExtra).filter(Boolean)
  const groups = TOPPING_GROUPS
    .map((g) => ({ ...g, items: extras.filter((e) => e.group === g.id) }))
    .filter((g) => g.items.length)
  const [groupId, setGroupId] = useState(groups[0]?.id)
  const group = groups.find((g) => g.id === groupId) || groups[0]
  /* Si todos cuestan lo mismo se dice una vez arriba y no en cada botón. */
  const prices = new Set(extras.map((e) => e.price))
  const uniform = prices.size === 1 ? [...prices][0] : null

  return (
    <div className="border-t border-tomate/25 p-3 flex flex-col gap-4">
      {product.portions?.length > 1 && (
        <div className="flex gap-2">
          {product.portions.map((p) => (
            <button
              key={p.id}
              onClick={() => onChange({ portionId: p.id })}
              className={['ptab soft flex-1', line.portionId === p.id ? 'is-on' : ''].join(' ')}
            >
              {p.label} · {price(p.price)}
            </button>
          ))}
        </div>
      )}

      {product.ingredients?.length > 0 && (
        <div>
          <p className="mono text-tomate mb-2">QUITAR</p>
          <div className="flex flex-wrap gap-1.5">
            {product.ingredients.map((ing) => {
              const off = line.removed.includes(ing)
              return (
                <button
                  key={ing}
                  onClick={() => onChange({ removed: toggle(line.removed, ing) })}
                  className={[
                    'rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors',
                    off ? 'border-tomate bg-tomate/10 text-tomate line-through' : 'border-tomate/40 text-carbon/75',
                  ].join(' ')}
                >
                  {ing}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {groups.length > 0 && (
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <p className="mono text-tomate">TOPPINGS</p>
            {uniform != null && <p className="mono normal-case text-carbon/50">+{price(uniform)} cada uno</p>}
          </div>

          {/* Un botón por tipo, con cuántos lleva ya marcados */}
          <div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-3 xl:grid-cols-6 gap-1.5" role="tablist">
            {groups.map((g) => {
              const n = g.items.filter((e) => line.extraIds.includes(e.id)).length
              const active = g.id === group.id
              return (
                <button
                  key={g.id}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setGroupId(g.id)}
                  className={[
                    'relative flex flex-col items-center gap-1 rounded-md border px-1 py-2 text-[0.65rem] font-semibold uppercase tracking-wide transition-colors',
                    active ? 'border-tomate bg-tomate text-masa' : 'border-tomate/40 text-tomate hover:bg-tomate/10',
                  ].join(' ')}
                >
                  <g.Icon className="w-5 h-5" strokeWidth={1.75} />
                  {g.label}
                  {n > 0 && (
                    <span className={[
                      'absolute -top-1.5 -right-1.5 min-w-[1.15rem] h-[1.15rem] px-1 rounded-full text-[0.65rem] leading-[1.15rem] text-center font-bold',
                      active ? 'bg-masa text-tomate' : 'bg-tomate text-masa',
                    ].join(' ')}>{n}</span>
                  )}
                </button>
              )
            })}
          </div>

          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {group.items.map((extra) => {
              const on = line.extraIds.includes(extra.id)
              return (
                <button
                  key={extra.id}
                  onClick={() => onChange({ extraIds: toggle(line.extraIds, extra.id) })}
                  aria-pressed={on}
                  className={[
                    'inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors',
                    on ? 'border-tomate bg-tomate text-masa' : 'border-tomate/40 bg-masa text-carbon hover:border-tomate',
                  ].join(' ')}
                >
                  {on && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
                  {extra.label}
                  {uniform == null && <span className="opacity-70">+{price(extra.price)}</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <NoteInput value={line.note} onCommit={(note) => onChange({ note })} />
    </div>
  )
}

/* La nota forma parte de la identidad de la línea: se aplica al
   salir del campo, no en cada tecla, para no rehacer la línea a mitad. */
function NoteInput({ value, onCommit }) {
  const [draft, setDraft] = useState(value)
  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { if (draft.trim() !== value) onCommit(draft) }}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
      placeholder='Nota para cocina: "bien hecha", "cortada"…'
      maxLength={140}
      className="pfield !py-2 text-sm"
    />
  )
}

const shortDate = (iso) => new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
const itemsText = (o) => (o.items || []).map((i) => `${i.qty}× ${i.name}`).join(', ')

/** Ficha del cliente que ya ha pedido: repetir un pedido de un toque. */
function KnownCustomer({ known, canUseAddress, dropped, onRepeat, onAddress }) {
  const [last, ...older] = known.orders
  return (
    <div className="rounded-md border border-tomate bg-queso/50 p-3 text-sm">
      <p className="font-bold text-carbon">
        {known.name || 'Cliente conocido'}
        <span className="mono normal-case text-carbon/55 font-normal"> · {known.count} pedido{known.count === 1 ? '' : 's'}</span>
      </p>
      <p className="text-xs text-carbon/60 mt-0.5">
        Último ({shortDate(last.created_at)}, {price(last.total)}): {itemsText(last)}
      </p>
      <div className="flex flex-wrap gap-2 mt-2">
        <button type="button" onClick={() => onRepeat(last)} className="rounded-md bg-tomate px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-masa">
          Repetir último pedido
        </button>
        {canUseAddress && (
          <button type="button" onClick={onAddress} className="rounded-md border border-tomate/60 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-tomate">
            Usar su dirección
          </button>
        )}
      </div>
      {older.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-carbon/55">Pedidos anteriores</summary>
          <ul className="mt-1 flex flex-col gap-1">
            {older.map((o) => (
              <li key={o.ref} className="flex items-center gap-2 text-xs text-carbon/70">
                <span className="flex-1">{shortDate(o.created_at)} · {price(o.total)} · {itemsText(o)}</span>
                <button type="button" onClick={() => onRepeat(o)} className="rounded-md border border-tomate/60 px-2.5 py-1 font-semibold text-tomate">Repetir</button>
              </li>
            ))}
          </ul>
        </details>
      )}
      {dropped > 0 && (
        <p className="mt-2 text-xs text-tomate">
          {dropped === 1 ? '1 producto ya no está' : `${dropped} productos ya no están`} en la carta y no se ha añadido.
        </p>
      )}
    </div>
  )
}

function Input({ label, value, onChange, type = 'text' }) {
  return (
    <label className="block">
      <span className="mono normal-case text-carbon/50 text-xs">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 pfield !py-2 text-sm"
      />
    </label>
  )
}

function Row({ label, value, tone = 'text-carbon/70' }) {
  return (
    <div className={`flex items-center justify-between ${tone}`}>
      <span>{label}</span><span className="mono">{value}</span>
    </div>
  )
}
