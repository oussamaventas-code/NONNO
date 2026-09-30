import { useEffect, useRef, useState } from 'react'
import { X, Minus, Plus, Leaf, Flame as FlameIcon, Check } from 'lucide-react'
import { getProduct, isPizza, isSoldOut, isExtraOut, missingIngredients, PIZZA_SIZE } from '../data/menu'
import ProductImage from './ProductImage'
import ToppingPicker from './ToppingPicker'
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
  const missing = product ? missingIngredients(product.id, locationId) : []
  /* Toppings agotados en esta sede: no se pueden añadir, y si ya estaban marcados no cuentan */
  const outExtras = product ? (product.extras || []).filter((id) => isExtraOut(id, locationId)) : []

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
      const ok = addToCart({ productId, portionId, extraIds: extraIds.filter((id) => !outExtras.includes(id)), removed, qty, note })
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

  const total = unitPrice(product, { extraIds: extraIds.filter((id) => !outExtras.includes(id)), portionId }) * qty

  const handleAdd = () => {
    if (!locationId) {
      pendingAdd.current = true
      openLocationPrompt()
      return
    }
    const ok = addToCart({ productId, portionId, extraIds: extraIds.filter((id) => !outExtras.includes(id)), removed, qty, note })
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
        className="relative w-full sm:max-w-2xl max-h-[92dvh] sm:max-h-[88vh] flex flex-col bg-crema rounded-t-lg sm:rounded-lg border border-tomate shadow-ember overflow-hidden"
      >
        <button
          onClick={closeProduct}
          className="absolute top-3 right-3 z-10 w-10 h-10 rounded-md border border-tomate bg-masa text-tomate flex items-center justify-center hover:bg-tomate/20 transition-colors"
          aria-label="Cerrar"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex-1 min-h-0 overflow-y-auto">
        <div className={product.image ? 'relative h-52 sm:h-64' : 'relative h-36'}>
          <ProductImage
            image={product.image}
            category={product.category}
            alt={product.name}
            width={900}
            widths={[500, 900, 1300]}
            sizes="(min-width: 640px) 42rem, 100vw"
            className="h-full w-full"
            iconClassName="w-12 h-12"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-crema via-transparent to-transparent" />
        </div>

        <div className="px-6 sm:px-8 pb-8 -mt-6 relative">
          {product.badge && <span className="mono normal-case text-tomate">{product.badge}</span>}
          <h2 id="product-modal-title" className="font-sans font-extrabold uppercase text-2xl sm:text-3xl text-tomate flex items-center gap-2 mt-1">
            {product.name}
            {product.vegetarian && <Leaf className="w-4 h-4 text-albahaca" strokeWidth={2} />}
            {product.spicy && <FlameIcon className="w-4 h-4 text-tomate" strokeWidth={2} />}
          </h2>
          <p className="mt-1 text-carbon/70">{product.description}</p>

          {isPizza(product) && (
            <p className="mono text-carbon/50 mt-2">TAMAÑO ÚNICO · {PIZZA_SIZE.diameter}</p>
          )}

          {product.portions?.length > 1 && (
            <div className="mt-6 grid grid-cols-2 gap-3">
              {product.portions.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPortionId(p.id)}
                  aria-pressed={portionId === p.id}
                  className={[
                    'rounded-md border p-4 text-left transition-all',
                    portionId === p.id ? 'border-tomate bg-tomate/10 shadow-island' : 'border-tomate/40 hover:border-tomate',
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
            <div className="mt-6">
              <div className="flex items-baseline justify-between gap-3 mb-2">
                <p className="mono text-tomate">¿QUITAR ALGO? <span className="normal-case text-carbon/50">toca para quitar</span></p>
                {removed.length > 0 && (
                  <button
                    onClick={() => setRemoved([])}
                    className="mono normal-case text-tomate hover:text-horno transition-colors"
                  >
                    Restaurar todos
                  </button>
                )}
              </div>

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
                        'group flex items-center gap-1.5 rounded-md border px-3 py-2 min-h-[40px] text-sm font-semibold transition-all duration-300 ease-magnetic',
                        off
                          ? 'border-tomate bg-tomate/10 text-tomate line-through'
                          : 'border-tomate/40 bg-masa text-carbon',
                      ].join(' ')}
                    >
                      {off
                        ? <X className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={2.5} />
                        : <Check className="w-3.5 h-3.5 flex-shrink-0 text-tomate" strokeWidth={2.5} />}
                      {ing}
                    </button>
                  )
                })}
              </div>

              {removed.length > 0 && (
                <p className="mt-3 rounded-md border border-tomate bg-tomate/10 px-4 py-2 text-sm font-bold uppercase text-tomate">
                  Sin {removed.join(', sin ')}
                </p>
              )}
            </div>
          )}

          {product.extras?.length > 0 && (
            <div className="mt-7">
              <ToppingPicker extraIds={product.extras} selected={extraIds} onToggle={toggleExtra} title="¿AÑADIR ALGO?" disabledIds={outExtras} />
            </div>
          )}

          <div className="mt-7">
            <label htmlFor="product-note" className="mono text-tomate mb-2 block">
              NOTA (OPCIONAL)
            </label>
            <input
              id="product-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={notePlaceholder}
              maxLength={140}
              className="pfield text-sm"
            />
          </div>

        </div>
        </div>

        {/* Siempre a la vista: no hay que bajar hasta el final para añadir */}
        <div className="flex items-center gap-3 border-t border-tomate bg-masa px-4 sm:px-6 py-3 pb-safe">
            <div className="flex items-center gap-1 rounded-md border border-tomate/50 p-1">
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="w-10 h-10 rounded-md flex items-center justify-center text-tomate hover:bg-tomate/10 transition-colors disabled:opacity-30"
                disabled={qty <= 1}
                aria-label="Quitar unidad"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="w-8 text-center font-sans font-bold text-carbon">{qty}</span>
              <button
                onClick={() => setQty((q) => q + 1)}
                className="w-10 h-10 rounded-md flex items-center justify-center text-tomate hover:bg-tomate/10 transition-colors"
                aria-label="Añadir unidad"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <button onClick={handleAdd} disabled={soldOut} className="btn flex-1 bg-tomate text-masa px-4 sm:px-6 disabled:opacity-50 disabled:pointer-events-none">
              <span className="btn-layer bg-forno" />
              <span className="btn-label">{soldOut ? (missing.length ? `SIN ${missing[0].toUpperCase()} HOY EN ESTA SEDE` : 'AGOTADO HOY EN ESTA SEDE') : `AÑADIR · ${price(total)}`}</span>
            </button>
        </div>
      </div>
    </div>
  )
}
