import { useEffect, useRef, useState } from 'react'
import { X, Minus, Plus, Leaf, Flame as FlameIcon, Check } from 'lucide-react'
import { getProduct, getExtra, isPizza, isSoldOut, PIZZA_SIZE } from '../data/menu'
import ProductImage from './ProductImage'
import { unitPrice } from '../lib/pricing'
import { price } from '../lib/format'
import { useStore, useActions } from '../store/StoreContext'
import { useLockBodyScroll } from '../hooks/useLockBodyScroll'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { useIsDesktop } from '../hooks/useMediaQuery'
import { gsap, useGSAP, EASE, revealFrom, guard } from '../lib/motion'

/**
 * Modal de producto: nunca navega a otra página.
 *
 * Los ingredientes se pueden quitar uno a uno tocándolos. La pizza
 * mantiene su nombre y su precio: es la misma pizza, hecha a la
 * manera del cliente. Se manda a cocina como "SIN cebolla", que es
 * mucho más difícil de pasar por alto que una nota escrita a mano.
 */
export default function ProductModal() {
  const { ui, locationId } = useStore()
  const { closeProduct, addToCart, openLocationPrompt } = useActions()
  const productId = ui.productId
  const product = productId ? getProduct(productId) : null
  const isDesktop = useIsDesktop()
  const soldOut = Boolean(product) && isSoldOut(product.id, locationId)

  const panelRef = useRef(null)
  const dialogRef = useRef(null)

  const [portionId, setPortionId] = useState(null)
  const [extraIds, setExtraIds] = useState([])
  const [removed, setRemoved] = useState([])
  const [qty, setQty] = useState(1)
  const [note, setNote] = useState('')
  const pendingAdd = useRef(false)

  useEffect(() => {
    if (!product) return
    setPortionId(product.portions?.[0]?.id || null)
    setExtraIds([])
    setRemoved([])
    setQty(1)
    setNote('')
    pendingAdd.current = false
  }, [productId])

  /* Si el usuario eligió sede desde el selector de "¿desde qué Nonno
     pedimos?" mientras este modal seguía abierto, completamos el
     añadido automáticamente en cuanto la sede queda fijada. */
  useEffect(() => {
    if (locationId && pendingAdd.current && product) {
      pendingAdd.current = false
      const ok = addToCart({ productId, portionId, extraIds, removed, qty, note })
      if (ok) closeProduct()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId])

  useLockBodyScroll(Boolean(product))
  useFocusTrap(dialogRef, Boolean(product), closeProduct)

  useGSAP(() => {
    if (!product) return
    revealFrom(panelRef.current, { opacity: 0, duration: 0.3, ease: EASE.in })
    if (isDesktop) {
      revealFrom(dialogRef.current, { y: 30, opacity: 0, scale: 0.97, duration: 0.45, ease: EASE.in })
    } else {
      guard(gsap.fromTo(dialogRef.current, { y: '100%' }, { y: '0%', duration: 0.5, ease: EASE.curtain }))
    }
  }, { dependencies: [productId], scope: panelRef })

  if (!product) return null

  const toggleExtra = (id) =>
    setExtraIds((prev) => (prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]))

  const toggleIngredient = (ing) =>
    setRemoved((prev) => (prev.includes(ing) ? prev.filter((i) => i !== ing) : [...prev, ing]))

  const total = unitPrice(product, { extraIds, portionId }) * qty

  const extrasByGroup = (product.extras || []).reduce((acc, id) => {
    const extra = getExtra(id)
    if (!extra) return acc
    acc[extra.group] = acc[extra.group] || []
    acc[extra.group].push(extra)
    return acc
  }, {})

  const handleAdd = () => {
    if (!locationId) {
      pendingAdd.current = true
      openLocationPrompt()
      return
    }
    const ok = addToCart({ productId, portionId, extraIds, removed, qty, note })
    if (ok) closeProduct()
  }

  const notePlaceholder = 'Ej. "poco hecha", "el timbre no funciona"'

  return (
    <div ref={panelRef} className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
      <button
        className="absolute inset-0 bg-forno/70 backdrop-blur-sm"
        onClick={closeProduct}
        aria-label="Cerrar"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-modal-title"
        className="relative w-full sm:max-w-2xl max-h-[92dvh] sm:max-h-[85vh] overflow-y-auto bg-crema rounded-t-block sm:rounded-block shadow-float"
      >
        <button
          onClick={closeProduct}
          className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-forno/40 backdrop-blur-sm text-luz flex items-center justify-center hover:bg-forno/60 transition-colors"
          aria-label="Cerrar"
        >
          <X className="w-5 h-5" />
        </button>

        <div className={product.image ? 'relative h-56 sm:h-72' : 'relative h-40'}>
          <ProductImage
            image={product.image}
            category={product.category}
            alt={product.name}
            width={900}
            widths={[500, 900, 1300]}
            sizes="(min-width: 640px) 42rem, 100vw"
            className="h-full w-full rounded-t-block"
            iconClassName="w-12 h-12"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-crema via-transparent to-transparent" />
        </div>

        <div className="px-6 sm:px-8 pb-8 -mt-6 relative">
          {product.badge && <span className="mono normal-case text-tomate">{product.badge}</span>}
          <h2 id="product-modal-title" className="font-sans font-extrabold uppercase text-2xl sm:text-3xl text-carbon flex items-center gap-2 mt-1">
            {product.name}
            {product.vegetarian && <Leaf className="w-4 h-4 text-albahaca" strokeWidth={2} />}
            {product.spicy && <FlameIcon className="w-4 h-4 text-tomate" strokeWidth={2} />}
          </h2>
          <p className="mt-2 text-carbon/60">{product.description}</p>

          {isPizza(product) && (
            <p className="mono text-carbon/40 mt-3">TAMAÑO ÚNICO · {PIZZA_SIZE.diameter}</p>
          )}

          {product.portions?.length > 1 && (
            <div className="mt-6 grid grid-cols-2 gap-3">
              {product.portions.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPortionId(p.id)}
                  aria-pressed={portionId === p.id}
                  className={[
                    'rounded-2xl border p-4 text-left transition-all',
                    portionId === p.id ? 'border-tomate bg-tomate/5' : 'border-carbon/12 hover:border-carbon/30',
                  ].join(' ')}
                >
                  <span className="block font-sans font-bold text-sm text-carbon">{p.label}</span>
                  <span className="block mono normal-case text-carbon/55 mt-0.5">{price(p.price)}</span>
                </button>
              ))}
            </div>
          )}

          {/* Ingredientes: se quitan tocándolos */}
          {product.ingredients?.length > 0 && (
            <div className="mt-8">
              <div className="flex items-baseline justify-between gap-3 mb-1">
                <p className="mono text-carbon/50">INGREDIENTES</p>
                {removed.length > 0 && (
                  <button
                    onClick={() => setRemoved([])}
                    className="mono normal-case text-tomate hover:text-horno transition-colors"
                  >
                    Restaurar todos
                  </button>
                )}
              </div>
              <p className="text-xs text-carbon/45 mb-3">
                Toca un ingrediente para quitarlo. El precio no cambia.
              </p>

              <div className="flex flex-wrap gap-2">
                {product.ingredients.map((ing) => {
                  const off = removed.includes(ing)
                  return (
                    <button
                      key={ing}
                      onClick={() => toggleIngredient(ing)}
                      aria-pressed={!off}
                      aria-label={off ? `Añadir ${ing}` : `Quitar ${ing}`}
                      className={[
                        'group flex items-center gap-1.5 rounded-full border px-3.5 py-2 min-h-[40px] text-sm transition-all duration-300 ease-magnetic',
                        off
                          ? 'border-carbon/12 text-carbon/35 line-through bg-transparent'
                          : 'border-albahaca/35 bg-albahaca/8 text-carbon',
                      ].join(' ')}
                    >
                      {off
                        ? <Plus className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={2.5} />
                        : <Check className="w-3.5 h-3.5 flex-shrink-0 text-albahaca" strokeWidth={2.5} />}
                      {ing}
                    </button>
                  )
                })}
              </div>

              {removed.length > 0 && (
                <p className="mt-3 rounded-2xl bg-tomate/8 px-4 py-2.5 text-sm font-semibold text-tomate">
                  Sin {removed.join(', sin ')}
                </p>
              )}
            </div>
          )}

          {/* Extras */}
          {Object.keys(extrasByGroup).length > 0 && (
            <div className="mt-8">
              <p className="mono text-carbon/50 mb-3">AÑADIR EXTRAS</p>
              <div className="space-y-5">
                {Object.entries(extrasByGroup).map(([group, extras]) => (
                  <div key={group}>
                    <p className="text-xs font-sans font-bold uppercase text-carbon/40 mb-2">{group}</p>
                    <div className="flex flex-wrap gap-2">
                      {extras.map((extra) => {
                        const checked = extraIds.includes(extra.id)
                        return (
                          <button
                            key={extra.id}
                            onClick={() => toggleExtra(extra.id)}
                            aria-pressed={checked}
                            className={[
                              'rounded-full border px-4 py-2 min-h-[40px] text-sm transition-all duration-300 ease-magnetic',
                              checked
                                ? 'border-tomate bg-tomate/10 text-tomate font-semibold'
                                : 'border-carbon/12 text-carbon/60 hover:border-carbon/30',
                            ].join(' ')}
                          >
                            {extra.label} <span className="mono normal-case">+{price(extra.price)}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8">
            <label htmlFor="product-note" className="mono text-carbon/50 mb-3 block">
              NOTA (OPCIONAL)
            </label>
            <input
              id="product-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={notePlaceholder}
              maxLength={140}
              className="w-full rounded-2xl border border-carbon/12 bg-white/60 px-4 py-3 text-sm text-carbon placeholder:text-carbon/35 focus:border-tomate outline-none transition-colors"
            />
          </div>

          <div className="mt-8 flex items-center gap-4">
            <div className="flex items-center gap-1 rounded-full border border-carbon/15 p-1">
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="w-10 h-10 rounded-full flex items-center justify-center text-carbon hover:bg-carbon/5 transition-colors disabled:opacity-30"
                disabled={qty <= 1}
                aria-label="Quitar unidad"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="w-8 text-center font-sans font-bold text-carbon">{qty}</span>
              <button
                onClick={() => setQty((q) => q + 1)}
                className="w-10 h-10 rounded-full flex items-center justify-center text-carbon hover:bg-carbon/5 transition-colors"
                aria-label="Añadir unidad"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <button onClick={handleAdd} disabled={soldOut} className="btn flex-1 bg-tomate text-forno px-6 disabled:opacity-50 disabled:pointer-events-none">
              <span className="btn-layer bg-horno" />
              <span className="btn-label">{soldOut ? 'AGOTADO HOY EN ESTA SEDE' : `AÑADIR AL PEDIDO · ${price(total)}`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
