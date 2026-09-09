import { useRef } from 'react'
import { X, Minus, Plus, Trash2, Pizza } from 'lucide-react'
import { useStore, useActions, useCart, useSelectedLocation } from '../store/StoreContext'
import { useLockBodyScroll } from '../hooks/useLockBodyScroll'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { useIsDesktop } from '../hooks/useMediaQuery'
import { img } from '../data/images'
import { price } from '../lib/format'
import { lineTotal } from '../lib/pricing'
import { SITE } from '../data/site'
import { gsap, useGSAP, EASE, revealFrom, guard } from '../lib/motion'
import { scrollToSection } from '../lib/scroll'

/**
 * Carrito global. Desktop: drawer lateral derecho. Móvil: bottom sheet.
 * Siempre montado (vive en el store), solo cambia su visibilidad.
 */
export default function CartDrawer() {
  const { ui } = useStore()
  const { closeCart, setQty, removeLine, openCheckout } = useActions()
  const { lines, subtotal, isEmpty } = useCart()
  const { location } = useSelectedLocation()
  const isDesktop = useIsDesktop()
  const open = ui.cartOpen

  const panelRef = useRef(null)
  const dialogRef = useRef(null)

  useLockBodyScroll(open)
  useFocusTrap(dialogRef, open, closeCart)

  useGSAP(() => {
    if (!open) return
    revealFrom(panelRef.current, { opacity: 0, duration: 0.3, ease: EASE.in })
    if (isDesktop) {
      guard(gsap.fromTo(dialogRef.current, { x: '100%' }, { x: '0%', duration: 0.55, ease: EASE.curtain }))
    } else {
      guard(gsap.fromTo(dialogRef.current, { y: '100%' }, { y: '0%', duration: 0.5, ease: EASE.curtain }))
    }
  }, { dependencies: [open], scope: panelRef })

  if (!open) return null

  const scrollToMenu = () => {
    closeCart()
    setTimeout(() => scrollToSection('menu'), 200)
  }

  return (
    <div ref={panelRef} className="fixed inset-0 z-[100] flex items-end sm:items-stretch sm:justify-end">
      <button
        className="absolute inset-0 bg-forno/70 backdrop-blur-sm"
        onClick={closeCart}
        aria-label="Cerrar carrito"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-title"
        className="relative w-full sm:w-[26rem] sm:max-w-full max-h-[92dvh] sm:max-h-none sm:h-full bg-crema rounded-t-block sm:rounded-none flex flex-col shadow-float"
      >
        <div className="flex items-center justify-between px-6 sm:px-7 pt-6 pb-4 border-b border-carbon/8">
          <div>
            <h2 id="cart-title" className="font-sans font-extrabold uppercase text-xl text-carbon">TU PEDIDO</h2>
            {location && (
              <p className="mono normal-case text-carbon/45 mt-1">{location.name}</p>
            )}
          </div>
          <button
            onClick={closeCart}
            className="w-10 h-10 rounded-full flex items-center justify-center text-carbon/50 hover:bg-carbon/5 transition-colors"
            aria-label="Cerrar carrito"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isEmpty ? (
          <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-4">
            <span className="w-16 h-16 rounded-full bg-carbon/5 flex items-center justify-center text-carbon/25">
              <Pizza className="w-7 h-7" strokeWidth={1.5} />
            </span>
            <p className="text-carbon/60 font-serif italic text-lg">{SITE.messages.cartEmpty}</p>
            <button onClick={scrollToMenu} className="btn bg-carbon text-crema px-6">
              <span className="btn-layer bg-tomate" />
              <span className="btn-label">{SITE.messages.cartEmptyCta}</span>
            </button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-6 sm:px-7 py-5 flex flex-col gap-5">
            {lines.map((line) => (
              <div key={line.id} className="flex gap-4">
                <img
                  src={img(line.image, 200, 60)}
                  alt=""
                  loading="lazy"
                  className="w-16 h-16 rounded-2xl object-cover flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-sans font-bold text-sm text-carbon truncate">{line.name}</p>
                    <button
                      onClick={() => removeLine(line.id)}
                      className="text-carbon/30 hover:text-tomate transition-colors flex-shrink-0"
                      aria-label={`Eliminar ${line.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  {line.sizeLabel && (
                    <p className="mono normal-case text-carbon/45 mt-0.5">{line.sizeLabel}</p>
                  )}
                  {line.extraLabels.length > 0 && (
                    <p className="mono normal-case text-carbon/45 mt-0.5 truncate">
                      + {line.extraLabels.join(', ')}
                    </p>
                  )}
                  {line.note && (
                    <p className="text-xs text-carbon/40 italic mt-0.5">"{line.note}"</p>
                  )}
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-1 rounded-full border border-carbon/12 p-0.5">
                      <button
                        onClick={() => setQty(line.id, line.qty - 1)}
                        className="w-7 h-7 rounded-full flex items-center justify-center text-carbon hover:bg-carbon/5"
                        aria-label="Quitar unidad"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-6 text-center text-sm font-semibold text-carbon">{line.qty}</span>
                      <button
                        onClick={() => setQty(line.id, line.qty + 1)}
                        className="w-7 h-7 rounded-full flex items-center justify-center text-carbon hover:bg-carbon/5"
                        aria-label="Añadir unidad"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <p className="mono text-carbon/70">{price(lineTotal(line))}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!isEmpty && (
          <div className="px-6 sm:px-7 py-5 border-t border-carbon/8 pb-safe">
            <div className="flex items-center justify-between mb-4">
              <span className="mono text-carbon/50">SUBTOTAL</span>
              <span className="font-serif italic font-semibold text-2xl text-carbon">{price(subtotal)}</span>
            </div>
            <button onClick={openCheckout} className="btn w-full bg-tomate text-crema">
              <span className="btn-layer bg-horno" />
              <span className="btn-label">CONTINUAR CON EL PEDIDO →</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
