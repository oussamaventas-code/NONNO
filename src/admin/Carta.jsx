import { useEffect, useState } from 'react'
import { Search, Eye, EyeOff, PackageX, Package, Carrot } from 'lucide-react'
import {
  CATEGORIES, allProducts, getMenuOverrides, isHidden, isManuallySoldOut, missingIngredients,
  ingredientCatalog, ingredientsOut, productsUsing, setMenuOverrides,
} from '../data/menu'
import { getLocation } from '../data/locations'
import { menuAction } from './api'
import { price } from '../lib/format'

/* ═══════════════════════════════════════════════════════════════
   CARTA
   Cambiar precios, quitar un producto de la web y marcar lo que se
   ha agotado hoy en cada sede. Lo ve la web en menos de un minuto y
   el servidor lo aplica al momento a cada pedido.

   Precios y ocultar: solo dirección (afectan a todas las sedes).
   Agotado y sin ingrediente: cada local marca el suyo. Si un ingrediente
   se acaba, las pizzas que lo llevan se descartan solas en esa sede.
   ═══════════════════════════════════════════════════════════════ */

const asInput = (n) => (n == null ? '' : Number(n).toFixed(2).replace('.', ','))

export default function Carta({ locationIds, esDireccion, onError, onChanged }) {
  const [locId, setLocId] = useState(locationIds[0])
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(null)
  const [view, setView] = useState('productos')

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
  const outIngredients = ingredientsOut(locId)
  const discarded = products.filter((p) => missingIngredients(p.id, locId).length > 0)
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
            {soldOutHere.length || outIngredients.length
              ? `${soldOutHere.length} agotado${soldOutHere.length === 1 ? '' : 's'}${outIngredients.length ? ` · ${outIngredients.length} ingrediente${outIngredients.length === 1 ? '' : 's'} sin stock (${discarded.length} descartada${discarded.length === 1 ? '' : 's'})` : ''} en ${getLocation(locId).name}`
              : `Todo disponible en ${getLocation(locId).name}`}
            {!esDireccion && ' · los precios los cambia el super admin'}
          </p>
        </div>
        <label className="flex items-center gap-2 rounded-md border border-tomate/50 bg-masa px-4 py-2 focus-within:border-tomate">
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
                'ptab',
                locId === id ? 'is-on' : '',
              ].join(' ')}
            >
              {getLocation(id).name}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2" role="tablist">
        {[['productos', 'Productos', Package], ['ingredientes', 'Ingredientes', Carrot]].map(([id, label, Icon]) => (
          <button key={id} role="tab" aria-selected={view === id} onClick={() => setView(id)} className={['ptab', view === id ? 'is-on' : ''].join(' ')}>
            <Icon className="w-3.5 h-3.5" /> {label}
            {id === 'ingredientes' && outIngredients.length > 0 && <span className="ml-1 rounded-full bg-tomate text-masa px-1.5 text-[0.65rem]">{outIngredients.length}</span>}
          </button>
        ))}
      </div>

      {view === 'ingredientes' && (
        <Ingredientes locId={locId} query={q} busy={busy} onToggle={(key, soldOut) => run(`ing:${key}`, 'ingredientOut', { ingredient: key, location: locId, soldOut })} />
      )}

      {view === 'productos' && sections.length === 0 && (
        <p className="rounded-lg border border-dashed border-tomate/50 p-6 text-center text-carbon/55">No hay ningún producto con ese nombre.</p>
      )}

      {view === 'productos' && sections.map((section) => (
        <section key={section.id}>
          <h3 className="mono text-carbon/60 mb-2">{section.label}</h3>
          <ul className="flex flex-col gap-2">
            {section.items.map((p) => {
              const soldOut = isManuallySoldOut(p.id, locId)
              const missing = missingIngredients(p.id, locId)
              const hidden = isHidden(p.id)
              return (
                <li
                  key={p.id}
                  className={[
                    'pcard p-4 flex flex-wrap items-center gap-3',
                    hidden ? 'opacity-55' : soldOut || missing.length ? 'bg-tomate/5' : '',
                  ].join(' ')}
                >
                  <div className="flex-1 min-w-[9rem]">
                    <p className="font-sans font-bold text-carbon">{p.name}</p>
                    <p className="mono normal-case text-carbon/50">
                      {hidden ? 'Oculto en la web' : missing.length ? `Descartada: sin ${missing.join(', ')}` : soldOut ? 'Agotado hoy' : 'Disponible'}
                    </p>
                    {p.discount && (
                      <p className="mono normal-case text-horno">{p.discount.label} ({p.discount.name}): se vende a {price(p.price)}</p>
                    )}
                  </div>

                  <PriceFields product={p} editable={esDireccion} busy={busy === `price:${p.id}`}
                    onSave={(data) => run(`price:${p.id}`, 'price', { productId: p.id, ...data })} />

                  <button
                    onClick={() => run(`sold:${p.id}`, 'soldOut', { productId: p.id, location: locId, soldOut: !soldOut })}
                    disabled={busy === `sold:${p.id}`}
                    aria-pressed={soldOut}
                    className={[
                      'ptab disabled:opacity-50',
                      soldOut ? 'is-on' : '',
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
                      className="ptab disabled:opacity-50"
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

/** Ingredientes por grupo: al marcar uno sin stock, las pizzas que lo llevan se descartan solas. */
function Ingredientes({ locId, query, busy, onToggle }) {
  const out = ingredientsOut(locId)
  const items = ingredientCatalog().filter((i) => !query || i.label.toLowerCase().includes(query))
  const groups = [...new Set(items.map((i) => i.group))].map((g) => ({ label: g, items: items.filter((i) => i.group === g) }))

  if (!items.length) {
    return <p className="rounded-lg border border-dashed border-tomate/50 p-6 text-center text-carbon/55">No hay ningún ingrediente con ese nombre.</p>
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="mono normal-case text-carbon/55">Marca lo que se ha acabado: las pizzas que lo llevan dejan de poder pedirse en la web de esta sede hasta que lo repongas.</p>
      {groups.map((g) => (
        <section key={g.label}>
          <h3 className="mono text-carbon/60 mb-2">{g.label}</h3>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {g.items.map((i) => {
              const isOut = out.includes(i.key)
              const used = productsUsing(i.key)
              return (
                <li key={i.key} className={['pcard p-3 flex items-center gap-3', isOut ? 'bg-tomate/5' : ''].join(' ')}>
                  <div className="flex-1 min-w-0">
                    <p className="font-sans font-bold text-carbon truncate">{i.label}</p>
                    <p className="mono normal-case text-carbon/50">
                      {isOut
                        ? `Sin stock${used.length ? ` · ${used.length} descartada${used.length === 1 ? '' : 's'}` : ''}`
                        : used.length ? `En ${used.length} producto${used.length === 1 ? '' : 's'}` : 'Solo como topping'}
                    </p>
                  </div>
                  <button
                    onClick={() => onToggle(i.key, !isOut)}
                    disabled={busy === `ing:${i.key}`}
                    aria-pressed={isOut}
                    aria-label={`${i.label}: ${isOut ? 'reponer' : 'marcar sin stock'}`}
                    className={['ptab disabled:opacity-50', isOut ? 'is-on' : ''].join(' ')}
                  >
                    {isOut ? <PackageX className="w-3.5 h-3.5" /> : <Package className="w-3.5 h-3.5" />}
                    {isOut ? 'Sin stock' : 'Hay'}
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}

/** Precio (o precios por ración). Se guarda al salir del campo o con Intro.
    Siempre el precio de carta, sin el descuento que tenga en vigor. */
const cartaPrice = (p) => p.priceBefore ?? p.price

function PriceFields({ product, editable, busy, onSave }) {
  const portions = product.portions
  const fields = portions
    ? portions.map((p) => ({ id: p.id, label: p.label, value: cartaPrice(p) }))
    : [{ id: null, label: null, value: cartaPrice(product) }]

  const commit = (field, raw, current) => {
    const text = raw.trim()
    if (text === asInput(current)) return
    if (portions) {
      const next = Object.fromEntries(portions.map((p) => [p.id, p.id === field.id ? text : asInput(cartaPrice(p))]))
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
              className="pfield !w-20 !px-3 !py-2 text-right font-bold disabled:opacity-50"
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
