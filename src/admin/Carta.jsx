import { useEffect, useState } from 'react'
import { Search, Eye, EyeOff, PackageX, Package } from 'lucide-react'
import { CATEGORIES, allProducts, getMenuOverrides, isHidden, isSoldOut, setMenuOverrides } from '../data/menu'
import { getLocation } from '../data/locations'
import { menuAction } from './api'
import { price } from '../lib/format'

/* ═══════════════════════════════════════════════════════════════
   CARTA
   Cambiar precios, quitar un producto de la web y marcar lo que se
   ha agotado hoy en cada sede. Lo ve la web en menos de un minuto y
   el servidor lo aplica al momento a cada pedido.

   Precios y ocultar: solo dirección (afectan a todas las sedes).
   Agotado: cada local marca el suyo.
   ═══════════════════════════════════════════════════════════════ */

const asInput = (n) => (n == null ? '' : Number(n).toFixed(2).replace('.', ','))

export default function Carta({ locationIds, esDireccion, onError, onChanged }) {
  const [locId, setLocId] = useState(locationIds[0])
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(null)

  useEffect(() => {
    if (!locationIds.includes(locId)) setLocId(locationIds[0])
  }, [locationIds, locId])

  const products = allProducts()
  const q = query.trim().toLowerCase()

  /* La respuesta del servidor trae todas las correcciones ya guardadas */
  const run = async (key, action, data) => {
    setBusy(key)
    try {
      const next = await menuAction(action, data)
      setMenuOverrides(next)
      onChanged()
      onError(null)
    } catch (err) {
      onError(err.message)
    } finally {
      setBusy(null)
    }
  }

  const soldOutHere = getMenuOverrides().soldOut[locId] || []
  const sections = CATEGORIES.map((c) => ({
    ...c,
    items: products.filter((p) => p.category === c.id && (!q || p.name.toLowerCase().includes(q))),
  })).filter((c) => c.items.length)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mono text-tomate">CARTA</p>
          <h2 className="font-sans font-extrabold uppercase text-xl text-carbon mt-1">Precios y disponibilidad</h2>
          <p className="mono normal-case text-carbon/55 mt-1">
            {soldOutHere.length ? `${soldOutHere.length} agotado${soldOutHere.length > 1 ? 's' : ''} en ${getLocation(locId).name}` : `Todo disponible en ${getLocation(locId).name}`}
            {!esDireccion && ' · los precios los cambia la dirección'}
          </p>
        </div>
        <label className="flex items-center gap-2 rounded-full border border-carbon/15 px-4 py-2 focus-within:border-carbon/50">
          <Search className="w-4 h-4 text-carbon/50" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar producto"
            aria-label="Buscar producto"
            className="bg-transparent outline-none text-sm w-44"
          />
        </label>
      </div>

      {locationIds.length > 1 && (
        <div className="flex gap-2">
          {locationIds.map((id) => (
            <button
              key={id}
              onClick={() => setLocId(id)}
              className={[
                'rounded-full border px-4 py-2 text-sm font-semibold',
                locId === id ? 'border-carbon bg-carbon text-crema' : 'border-carbon/15 text-carbon/60',
              ].join(' ')}
            >
              {getLocation(id).name}
            </button>
          ))}
        </div>
      )}

      {sections.length === 0 && (
        <p className="rounded-card border border-dashed border-carbon/15 p-6 text-center text-carbon/55">No hay ningún producto con ese nombre.</p>
      )}

      {sections.map((section) => (
        <section key={section.id}>
          <h3 className="mono text-carbon/60 mb-2">{section.label}</h3>
          <ul className="flex flex-col gap-2">
            {section.items.map((p) => {
              const soldOut = isSoldOut(p.id, locId)
              const hidden = isHidden(p.id)
              return (
                <li
                  key={p.id}
                  className={[
                    'rounded-card border bg-crema p-4 flex flex-wrap items-center gap-3',
                    hidden ? 'border-carbon/10 opacity-60' : soldOut ? 'border-tomate/40' : 'border-carbon/10',
                  ].join(' ')}
                >
                  <div className="flex-1 min-w-[9rem]">
                    <p className="font-sans font-bold text-carbon">{p.name}</p>
                    <p className="mono normal-case text-carbon/50">
                      {hidden ? 'Oculto en la web' : soldOut ? 'Agotado hoy' : 'Disponible'}
                    </p>
                  </div>

                  <PriceFields product={p} editable={esDireccion} busy={busy === `price:${p.id}`}
                    onSave={(data) => run(`price:${p.id}`, 'price', { productId: p.id, ...data })} />

                  <button
                    onClick={() => run(`sold:${p.id}`, 'soldOut', { productId: p.id, location: locId, soldOut: !soldOut })}
                    disabled={busy === `sold:${p.id}`}
                    aria-pressed={soldOut}
                    className={[
                      'mono normal-case flex items-center gap-1.5 rounded-full border px-3 py-2 transition-colors disabled:opacity-50',
                      soldOut ? 'bg-tomate text-crema border-tomate' : 'border-carbon/15 text-carbon/70 hover:border-carbon/40',
                    ].join(' ')}
                  >
                    {soldOut ? <PackageX className="w-3.5 h-3.5" /> : <Package className="w-3.5 h-3.5" />}
                    {soldOut ? 'Agotado' : 'Marcar agotado'}
                  </button>

                  {esDireccion && (
                    <button
                      onClick={() => run(`hide:${p.id}`, 'hidden', { productId: p.id, hidden: !hidden })}
                      disabled={busy === `hide:${p.id}`}
                      aria-pressed={hidden}
                      title={hidden ? 'Volver a mostrarlo en la web' : 'Quitarlo de la web en todas las sedes'}
                      className="mono normal-case flex items-center gap-1.5 rounded-full border border-carbon/15 px-3 py-2 text-carbon/70 hover:border-carbon/40 disabled:opacity-50"
                    >
                      {hidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      {hidden ? 'Mostrar' : 'Ocultar'}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}

/** Precio (o precios por ración). Se guarda al salir del campo o con Intro. */
function PriceFields({ product, editable, busy, onSave }) {
  const portions = product.portions
  const fields = portions
    ? portions.map((p) => ({ id: p.id, label: p.label, value: p.price }))
    : [{ id: null, label: null, value: product.price }]

  const commit = (field, raw, current) => {
    const text = raw.trim()
    if (text === asInput(current)) return
    if (portions) {
      const next = Object.fromEntries(portions.map((p) => [p.id, p.id === field.id ? text : asInput(p.price)]))
      onSave({ portionPrices: next })
    } else {
      onSave({ price: text })
    }
  }

  return (
    <div className="flex items-center gap-3">
      {fields.map((f) => (
        editable ? (
          <label key={f.id || 'unico'} className="flex items-center gap-1.5">
            {f.label && <span className="mono normal-case text-carbon/55">{f.label}</span>}
            <input
              key={`${f.id}:${f.value}`}
              defaultValue={asInput(f.value)}
              disabled={busy}
              inputMode="decimal"
              aria-label={`Precio de ${product.name}${f.label ? ` (${f.label})` : ''}`}
              onBlur={(e) => commit(f, e.target.value, f.value)}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              className="w-20 rounded-xl border border-carbon/15 bg-white/60 px-3 py-2 text-right font-bold text-carbon outline-none focus:border-carbon/50 disabled:opacity-50"
            />
            <span className="text-carbon/50">€</span>
          </label>
        ) : (
          <span key={f.id || 'unico'} className="font-bold text-carbon whitespace-nowrap">
            {f.label && <span className="mono normal-case text-carbon/55 mr-1">{f.label}</span>}
            {price(f.value)}
          </span>
        )
      ))}
    </div>
  )
}
