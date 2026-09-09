import { useEffect, useRef, useState } from 'react'
import { X, Minus, Plus, Leaf, Flame as FlameIcon } from 'lucide-react'
import { getProduct, getExtra, defaultSize } from '../data/menu'
import { img, srcSet } from '../data/images'
import { unitPrice } from '../lib/pricing'
import { price } from '../lib/format'
import { useStore, useActions } from '../store/StoreContext'
import { useLockBodyScroll } from '../hooks/useLockBodyScroll'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { useIsDesktop } from '../hooks/useMediaQuery'
import { gsap, useGSAP, EASE, revealFrom, guard } from '../lib/motion'

/**
 * Modal de producto: nunca navega a otra página. Tamaño, extras,
 * cantidad y nota, con el precio recalculándose en cada cambio.
 * Desktop: panel centrado. Móvil: bottom sheet.
 */
export default function ProductModal() {
  const { ui, locationId } = useStore()
  const { closeProduct, addToCart, openLocationPrompt } = useActions()
  const productId = ui.productId
  const product = productId ? getProduct(productId) : null
  const isDesktop = useIsDesktop()

  const panelRef = useRef(null)
  const dialogRef = useRef(null)

  const [sizeId, setSizeId] = useState(null)
  const [extraIds, setExtraIds] = useState([])
  const [qty, setQty] = useState(1)
  const [note, setNote] = useState('')
  const pendingAdd = useRef(false)

  useEffect(() => {
    if (!product) return
    setSizeId(product.sizes ? defaultSize(product).id : null)
    setExtraIds([])
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
      const ok = addToCart({ productId, sizeId, extraIds, qty, note })
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

  const total = unitPrice(product, { sizeId, extraIds }) * qty

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
    const ok = addToCart({ productId, sizeId, extraIds, qty, note })
    if (ok) closeProduct()
  }

  const notePlaceholder = 'Ej. "Sin cebolla", "el timbre no funciona"'

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
          className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-forno/40 backdrop-blur-sm text-crema flex items-center justify-center hover:bg-forno/60 transition-colors"
          aria-label="Cerrar"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="relative h-56 sm:h-72">
          <img
            src={img(product.image, 900, 72)}
            srcSet={srcSet(product.image, [500, 900, 1300])}
            sizes="(min-width: 640px) 42rem, 100vw"
            alt={product.name}
            className="h-full w-full object-cover rounded-t-block sm:rounded-t-block"
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

          <div className="mt-4 flex flex-wrap gap-2">
            {product.ingredients.map((ing) => (
              <span key={ing} className="mono normal-case rounded-full border border-carbon/12 px-3 py-1 text-carbon/60">
                {ing}
              </span>
            ))}
          </div>

          {product.sizes && (
            <div className="mt-8">
              <p className="mono text-carbon/50 mb-3">TAMAÑO</p>
              <div className="grid grid-cols-3 gap-2">
                {product.sizes.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSizeId(s.id)}
                    className={[
                      'rounded-2xl border px-3 py-3 text-center transition-all duration-300 ease-magnetic',
                      sizeId === s.id
                        ? 'border-tomate bg-tomate/5 text-carbon'
                        : 'border-carbon/12 text-carbon/60 hover:border-carbon/30',
                    ].join(' ')}
                  >
                    <span className="block font-sans font-bold text-sm uppercase">{s.label}</span>
                    <span className="block mono text-carbon/40 mt-0.5">{s.diameter}</span>
                    <span className="block mono text-carbon/70 mt-1">{price(s.price)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {Object.keys(extrasByGroup).length > 0 && (
            <div className="mt-8">
              <p className="mono text-carbon/50 mb-3">EXTRAS</p>
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
                                ? 'border-albahaca bg-albahaca/10 text-albahaca font-semibold'
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

            <button onClick={handleAdd} className="btn flex-1 bg-tomate text-crema px-6">
              <span className="btn-layer bg-horno" />
              <span className="btn-label">AÑADIR AL PEDIDO · {price(total)}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
