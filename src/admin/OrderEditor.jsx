import { useEffect, useState } from 'react'
import { X, Minus, Plus, Trash2, SlidersHorizontal, Check, Clock, Store, Phone } from 'lucide-react'
import { CATEGORIES, productsByCategory, getProduct, getExtra, priceOf } from '../data/menu'
import { getLocation } from '../data/locations'
import { buildLine, lineTotal } from '../lib/pricing'
import { orderTotals } from '../lib/orderTotals'
import { ovenUnits, hourOf } from '../lib/kitchenSlots'
import { price } from '../lib/format'
import { createOrder, editOrder, fetchSlots } from './api'

/* ═══════════════════════════════════════════════════════════════
   EDITOR DE PEDIDOS DEL MOSTRADOR
   Crear un pedido desde cero (en el mostrador o por teléfono) o
   cambiar uno existente. Tocar un producto lo añade tal cual; cada
   línea se ajusta después (ración, quitar ingredientes, toppings,
   nota). Precios, ofertas, envío y franja los calcula el servidor
   con las mismas reglas que la web.
   ═══════════════════════════════════════════════════════════════ */

const EMPTY_CUSTOMER = { name: '', phone: '', address: '', zone: '', notes: '' }

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
  const zone = getLocation(order.location_id)?.deliveryZones?.find((z) => z.name === order.delivery_zone)
  return {
    name: order.customer_name || '',
    phone: order.customer_phone || '',
    address: order.address || '',
    zone: zone?.id || '',
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

  const pizzas = ovenUnits(lines)
  const totals = orderTotals({ lines, mode, locationId: locId, zoneId: customer.zone })
  const zones = location?.deliveryZones || []
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
      if (!zones.some((z) => z.id === customer.zone)) return 'Elige la zona de entrega.'
      if (!customer.address.trim()) return 'Falta la dirección de entrega.'
      if (!customer.phone.trim()) return 'Para una entrega hace falta el teléfono.'
    }
    return null
  }

  const save = async () => {
    const p = problem()
    if (p) { setError(p); return }
    setSaving(true)
    setError(null)
    const items = lines.map((l) => ({
      id: l.productId, portionId: l.portionId, extraIds: l.extraIds,
      removed: l.removed, note: l.note, qty: l.qty,
    }))
    const cust = { ...customer, zone: mode === 'delivery' ? customer.zone : '' }
    try {
      const res = editing
        ? await editOrder(order.id, { items, mode, customer: cust })
        : await createOrder({
          location: { id: locId },
          mode,
          channel,
          customer: cust,
          items,
          paymentStatus: paidNow ? 'pagado' : 'pendiente',
          paymentMethod: method,
        })
      onSaved(res.order, { isNew: !editing })
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-masa flex flex-col" role="dialog" aria-modal="true" aria-labelledby="editor-title">
      {/* Cabecera */}
      <div className="flex items-center justify-between gap-3 border-b border-carbon/10 bg-crema px-4 sm:px-6 py-3">
        <div>
          <h2 id="editor-title" className="font-sans font-extrabold uppercase text-lg text-carbon">
            {editing ? `Editar ${order.ref}` : 'Nuevo pedido'}
          </h2>
          <p className="mono normal-case text-carbon/50">{location?.name}</p>
        </div>
        <button onClick={onClose} className="w-11 h-11 rounded-full flex items-center justify-center text-carbon/60 hover:bg-carbon/5" aria-label="Cerrar sin guardar">
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
                  'flex-shrink-0 rounded-full px-4 py-2 min-h-[44px] font-sans font-bold uppercase text-[0.72rem] border transition-colors',
                  cat === c.id ? 'bg-carbon text-crema border-carbon' : 'text-carbon/60 border-carbon/15 hover:border-carbon/40',
                ].join(' ')}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
            {productsByCategory(cat).map((p) => (
              <button
                key={p.id}
                onClick={() => addProduct(p.id)}
                className="rounded-2xl border border-carbon/12 bg-crema p-3 text-left min-h-[4.5rem] hover:border-tomate active:scale-[0.98] transition-all"
              >
                <span className="block font-sans font-bold text-sm text-carbon leading-tight">{p.name}</span>
                <span className="block mono normal-case text-carbon/55 mt-1">{price(priceOf(p))}</span>
              </button>
            ))}
          </div>
        </section>

        {/* ── Ticket ────────────────────────────────────────────── */}
        <aside className="min-h-0 overflow-y-auto border-t lg:border-t-0 lg:border-l border-carbon/10 bg-crema p-4 sm:p-5 flex flex-col gap-5">
          {!editing && locationIds.length > 1 && (
            <div className="flex gap-2">
              {locationIds.map((id) => (
                <button
                  key={id}
                  onClick={() => { setLocId(id); if (!getLocation(id).services.delivery) setMode('pickup') }}
                  className={[
                    'flex-1 rounded-xl border px-3 py-2 text-sm font-semibold',
                    locId === id ? 'border-tomate bg-tomate/5 text-carbon' : 'border-carbon/12 text-carbon/60',
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
                    'flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold',
                    channel === id ? 'border-carbon bg-carbon text-crema' : 'border-carbon/12 text-carbon/60',
                  ].join(' ')}
                >
                  <Icon className="w-4 h-4" /> {label}
                </button>
              ))}
            </div>
          )}

          {/* Líneas */}
          <div>
            <p className="mono text-carbon/50 mb-2">PEDIDO</p>
            {lines.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-carbon/15 px-4 py-6 text-center text-sm text-carbon/45">
                Toca productos de la carta para añadirlos.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {lines.map((l) => (
                  <li key={l.id} className="rounded-2xl border border-carbon/10 bg-white/60">
                    <div className="flex items-start gap-2 p-3">
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
                    <div className="flex items-center justify-between gap-2 border-t border-carbon/8 px-2 py-1.5">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setQty(l.id, l.qty - 1)} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-carbon/5" aria-label="Quitar una">
                          {l.qty === 1 ? <Trash2 className="w-4 h-4 text-tomate" /> : <Minus className="w-4 h-4" />}
                        </button>
                        <span className="w-6 text-center font-bold text-carbon">{l.qty}</span>
                        <button onClick={() => setQty(l.id, l.qty + 1)} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-carbon/5" aria-label="Añadir una">
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      <button
                        onClick={() => setOpenLine(openLine === l.id ? null : l.id)}
                        className="mono normal-case flex items-center gap-1.5 rounded-full px-3 py-1.5 text-carbon/70 hover:bg-carbon/5"
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
            <p className="mono text-carbon/50">CLIENTE</p>
            <Input label="Nombre" value={customer.name} onChange={(v) => patchCustomer({ name: v })} />
            <Input
              label={channel === 'mostrador' && mode === 'pickup' ? 'Teléfono (opcional)' : 'Teléfono'}
              type="tel"
              value={customer.phone}
              onChange={(v) => patchCustomer({ phone: v })}
            />

            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'pickup', label: 'Recoge' },
                ...(canDeliver ? [{ id: 'delivery', label: 'Entrega' }] : []),
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={[
                    'rounded-xl border px-3 py-2.5 text-sm font-semibold',
                    mode === m.id ? 'border-tomate bg-tomate/5 text-carbon' : 'border-carbon/12 text-carbon/60',
                  ].join(' ')}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {mode === 'delivery' && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {zones.map((z) => (
                    <button
                      key={z.id}
                      onClick={() => patchCustomer({ zone: z.id })}
                      className={[
                        'flex justify-between gap-1 rounded-xl border px-3 py-2 text-left text-sm',
                        customer.zone === z.id ? 'border-tomate bg-tomate/5 font-semibold' : 'border-carbon/12 text-carbon/70',
                      ].join(' ')}
                    >
                      <span>{z.name}</span><span className="mono normal-case text-carbon/50">+{price(z.fee)}</span>
                    </button>
                  ))}
                </div>
                <Input label="Dirección" value={customer.address} onChange={(v) => patchCustomer({ address: v })} />
              </>
            )}
            <Input label="Notas (opcional)" value={customer.notes} onChange={(v) => patchCustomer({ notes: v })} />
          </div>

          {/* Totales y hora */}
          <div className="rounded-2xl bg-carbon/5 p-4 flex flex-col gap-1.5 text-sm">
            {(totals.discount > 0 || totals.deliveryFee > 0) && (
              <Row label="Subtotal" value={price(totals.subtotal)} />
            )}
            {totals.deals.map((d) => (
              <p key={d.label} className="text-albahaca text-xs">Oferta {d.count > 1 ? `${d.count}× ` : ''}{d.label} por {price(d.price)}</p>
            ))}
            {totals.discount > 0 && <Row label="Descuento recogida" value={`−${price(totals.discount)}`} tone="text-albahaca font-semibold" />}
            {totals.deliveryFee > 0 && <Row label={`Envío ${totals.zone.name}`} value={`+${price(totals.deliveryFee)}`} />}
            <div className="flex items-center justify-between pt-1">
              <span className="mono text-carbon/60">TOTAL</span>
              <span className="font-serif italic font-semibold text-3xl text-carbon">{price(totals.total)}</span>
            </div>
            {eta && (
              <p className={['mt-1 flex items-center gap-1.5 font-semibold', eta.ok ? 'text-carbon' : 'text-tomate'].join(' ')}>
                <Clock className="w-4 h-4" />
                {eta.ok
                  ? `${mode === 'delivery' && totals.zone
                    ? `Llega hacia las ${hourOf(Date.parse(eta.readyAt) + totals.zone.minutes * 60000)}`
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
                        'rounded-xl border px-3 py-2 text-sm font-semibold capitalize',
                        method === m ? 'border-carbon bg-carbon text-crema' : 'border-carbon/12 text-carbon/60',
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
            <p className="rounded-2xl border border-tomate/30 bg-tomate/5 px-4 py-3 text-sm text-tomate">{error}</p>
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

/* Opciones de una línea: ración, quitar ingredientes, toppings, nota */
function LineOptions({ line, onChange }) {
  const product = getProduct(line.productId)
  const toggle = (list, value) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value])
  const chip = (active, tone) => [
    'rounded-full border px-3 py-1.5 text-xs transition-colors',
    active ? tone : 'border-carbon/12 text-carbon/60',
  ].join(' ')

  return (
    <div className="border-t border-carbon/8 p-3 flex flex-col gap-3">
      {product.portions?.length > 1 && (
        <div className="flex gap-2">
          {product.portions.map((p) => (
            <button key={p.id} onClick={() => onChange({ portionId: p.id })} className={chip(line.portionId === p.id, 'border-tomate bg-tomate/10 text-carbon font-semibold')}>
              {p.label} · {price(p.price)}
            </button>
          ))}
        </div>
      )}

      {product.ingredients?.length > 0 && (
        <div>
          <p className="text-[0.7rem] font-bold uppercase text-carbon/45 mb-1.5">Quitar (toca para quitar)</p>
          <div className="flex flex-wrap gap-1.5">
            {product.ingredients.map((ing) => {
              const off = line.removed.includes(ing)
              return (
                <button key={ing} onClick={() => onChange({ removed: toggle(line.removed, ing) })} className={chip(off, 'border-tomate bg-tomate/10 text-tomate font-bold line-through')}>
                  {ing}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {product.extras?.length > 0 && (
        <div>
          <p className="text-[0.7rem] font-bold uppercase text-carbon/45 mb-1.5">Toppings</p>
          <div className="flex flex-wrap gap-1.5">
            {product.extras.map((id) => {
              const extra = getExtra(id)
              const on = line.extraIds.includes(id)
              return (
                <button key={id} onClick={() => onChange({ extraIds: toggle(line.extraIds, id) })} className={chip(on, 'border-albahaca bg-albahaca/10 text-albahaca font-semibold')}>
                  {extra.label} +{price(extra.price)}
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
      className="w-full rounded-xl border border-carbon/12 bg-white/70 px-3 py-2 text-sm outline-none focus:border-tomate"
    />
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
        className="mt-1 w-full rounded-xl border border-carbon/12 bg-white/70 px-3 py-2.5 text-sm text-carbon outline-none focus:border-tomate"
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
