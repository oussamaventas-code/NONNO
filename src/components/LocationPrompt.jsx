import { useRef } from 'react'
import { X, Star } from 'lucide-react'
import { LOCATIONS } from '../data/locations'
import { useStore, useActions } from '../store/StoreContext'
import { useLockBodyScroll } from '../hooks/useLockBodyScroll'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { SITE } from '../data/site'
import { decimal } from '../lib/format'
import { img } from '../data/images'
import { gsap, useGSAP, EASE, revealFrom, guard } from '../lib/motion'

/**
 * "¿DESDE QUÉ NONNO PEDIMOS?" — se abre cuando el usuario intenta
 * añadir un producto sin sede elegida. Nunca un alert del navegador.
 */
export default function LocationPrompt({ onPicked }) {
  const { ui } = useStore()
  const { setLocation, closeLocationPrompt } = useActions()
  const open = ui.locationPrompt
  const panelRef = useRef(null)
  const dialogRef = useRef(null)

  useLockBodyScroll(open)
  useFocusTrap(dialogRef, open, closeLocationPrompt)

  useGSAP(() => {
    if (!open) return
    revealFrom(panelRef.current, { opacity: 0, duration: 0.3, ease: EASE.in })
    revealFrom(dialogRef.current, { y: 30, opacity: 0, scale: 0.97, duration: 0.5, ease: EASE.in })
  }, { dependencies: [open], scope: panelRef })

  if (!open) return null

  const pick = (id) => {
    setLocation(id)
    onPicked?.(id)
  }

  return (
    <div
      ref={panelRef}
      className="fixed inset-0 z-[105] flex items-center justify-center p-4"
    >
      <button
        className="absolute inset-0 bg-forno/70 backdrop-blur-sm"
        onClick={closeLocationPrompt}
        aria-label="Cerrar"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="location-prompt-title"
        className="relative w-full max-w-lg bg-crema rounded-block p-6 sm:p-8 shadow-float"
      >
        <button
          onClick={closeLocationPrompt}
          className="absolute top-5 right-5 text-carbon/40 hover:text-carbon transition-colors"
          aria-label="Cerrar"
        >
          <X className="w-5 h-5" />
        </button>

        <p className="mono text-tomate mb-2">NONNO / ELEGIR SEDE</p>
        <h3 id="location-prompt-title" className="font-sans font-extrabold uppercase text-2xl sm:text-3xl text-carbon leading-tight pr-8">
          {SITE.messages.needLocation}
        </h3>

        <div className="mt-6 flex flex-col gap-3">
          {LOCATIONS.map((loc) => (
            <button
              key={loc.id}
              onClick={() => pick(loc.id)}
              className="group flex items-center gap-4 rounded-card border border-carbon/10 bg-white/60 p-3 text-left transition-all hover:border-tomate hover:bg-white"
            >
              <img
                src={img(loc.image, 160, 60)}
                alt=""
                className="w-16 h-16 rounded-2xl object-cover flex-shrink-0"
                loading="lazy"
              />
              <div className="flex-1 min-w-0">
                <p className="font-sans font-bold uppercase text-sm text-carbon">{loc.name}</p>
                <p className="mono normal-case text-carbon/50 flex items-center gap-1 mt-1">
                  <Star className="w-3 h-3 fill-horno text-horno" /> {decimal(loc.rating)} · {loc.reviews} reseñas
                </p>
              </div>
              <span className="mono text-tomate opacity-0 group-hover:opacity-100 transition-opacity">ELEGIR →</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
