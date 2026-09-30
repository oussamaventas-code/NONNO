import { useRef } from 'react'
import { Pizza, X } from 'lucide-react'
import { useStore, useActions } from '../store/StoreContext'
import { gsap, useGSAP, EASE, revealFrom, guard } from '../lib/motion'
import { clock } from '../lib/format'

/**
 * Avisos con forma de ticket de cocina. Entran deslizando desde abajo,
 * nunca un toast genérico de esquina.
 *
 * El contenedor se mantiene siempre montado (aunque vacío) para que
 * el ref de GSAP nunca apunte a un nodo inexistente.
 */
export default function Toasts() {
  const { toasts } = useStore()
  const { dismissToast, openCart } = useActions()
  const listRef = useRef(null)

  useGSAP(() => {
    if (!toasts.length) return
    revealFrom('.nonno-toast:last-child', { y: 24, opacity: 0, duration: 0.5, ease: EASE.in })
  }, { dependencies: [toasts.length], scope: listRef })

  return (
    <div
      ref={listRef}
      className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] sm:bottom-6 right-0 sm:right-6 left-0 sm:left-auto z-[95] flex flex-col-reverse gap-2 px-3 sm:px-0 sm:w-80 pointer-events-none"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="nonno-toast ticket pointer-events-auto shadow-float flex items-center gap-3 pl-4 pr-3 py-3"
        >
          <span className="flex-shrink-0 w-9 h-9 rounded-full bg-albahaca/10 text-albahaca flex items-center justify-center">
            <Pizza className="w-4 h-4" strokeWidth={1.75} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[0.8rem] font-sans font-semibold text-carbon leading-tight normal-case truncate">
              {t.title}
            </p>
            {t.action && (
              <button
                onClick={() => { openCart(); dismissToast(t.id) }}
                className="mono text-neon mt-0.5 hover:text-horno transition-colors"
              >
                {t.action} →
              </button>
            )}
          </div>
          <span className="mono text-carbon/30 flex-shrink-0">{clock()}</span>
          <button
            onClick={() => dismissToast(t.id)}
            className="flex-shrink-0 text-carbon/30 hover:text-carbon transition-colors"
            aria-label="Cerrar aviso"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
