import { useEffect, useRef } from 'react'
import { X, Star, MapPin, Package, Truck, Clock } from 'lucide-react'
import { LOCATIONS } from '../data/locations'
import { useStore, useActions } from '../store/StoreContext'
import { useLockBodyScroll } from '../hooks/useLockBodyScroll'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { useStoreStatus } from '../hooks/useStoreStatus'
import { decimal } from '../lib/format'
import { img } from '../data/images'
import { revealFrom, useGSAP, EASE } from '../lib/motion'

/* A los 2 s de entrar, si el cliente aún no tiene sede, se le pregunta
   desde qué Nonno pide. Si lo cierra sin elegir, no se le vuelve a
   insistir en esa visita: ya se le preguntará al añadir algo. */
const WELCOME_DELAY_MS = 2000
const DISMISSED_KEY = 'nonno.sede.preguntada'

/**
 * "¿DESDE QUÉ NONNO PEDIMOS?"
 * Se abre sola al entrar (primera visita sin sede) y también cuando el
 * cliente intenta añadir un producto sin sede elegida.
 */
export default function LocationPrompt() {
  const { ui, locationId } = useStore()
  const { setLocation, openLocationPrompt, closeLocationPrompt } = useActions()
  const { isOpen: storeOpen } = useStoreStatus()
  const open = ui.locationPrompt
  const panelRef = useRef(null)
  const dialogRef = useRef(null)

  /* Bienvenida: solo si no hay sede guardada y no se ha cerrado ya en esta visita */
  useEffect(() => {
    if (locationId) return undefined
    let dismissed = false
    try { dismissed = sessionStorage.getItem(DISMISSED_KEY) === '1' } catch { /* modo privado */ }
    if (dismissed) return undefined
    const timer = setTimeout(openLocationPrompt, WELCOME_DELAY_MS)
    return () => clearTimeout(timer)
    // Solo al cargar la web
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const close = () => {
    try { sessionStorage.setItem(DISMISSED_KEY, '1') } catch { /* modo privado */ }
    closeLocationPrompt()
  }

  useLockBodyScroll(open)
  useFocusTrap(dialogRef, open, close)

  useGSAP(() => {
    if (!open) return
    revealFrom(panelRef.current, { opacity: 0, duration: 0.3, ease: EASE.in })
    revealFrom(dialogRef.current, { y: 30, opacity: 0, scale: 0.97, duration: 0.5, ease: EASE.in })
  }, { dependencies: [open], scope: panelRef })

  if (!open) return null

  return (
    <div ref={panelRef} className="fixed inset-0 z-[105] flex items-end sm:items-center justify-center sm:p-4">
      <button className="absolute inset-0 bg-forno/70 backdrop-blur-sm" onClick={close} aria-label="Cerrar" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="location-prompt-title"
        className="frame relative w-full sm:max-w-xl bg-masa !rounded-b-none sm:!rounded-b-lg max-h-[92vh] overflow-y-auto"
      >
        <div className="frame-in px-5 pt-6 pb-5 sm:px-7 sm:pt-7">
          <button
            onClick={close}
            className="absolute top-3 right-3 w-10 h-10 rounded-md border border-tomate/50 flex items-center justify-center text-tomate hover:bg-tomate/10 transition-colors"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="text-center pr-6 pl-6">
            <img
              src="/logo-nonno.png"
              alt=""
              width="64"
              height="64"
              className="mx-auto h-16 w-16 rounded-full object-cover border border-tomate"
            />
            <h3 id="location-prompt-title" className="mt-3 font-display italic font-bold text-3xl sm:text-4xl text-tomate leading-none">
              ¿Desde qué Nonno pides?
            </h3>
            <p className="mt-2 text-sm text-carbon/70">Elige tu pizzería y te enseñamos su carta, sus horarios y si te la llevamos a casa.</p>
          </div>

          <div className="mt-5 flex flex-col gap-3">
            {LOCATIONS.map((loc) => {
              const abierta = storeOpen(loc.id)
              return (
                <button
                  key={loc.id}
                  onClick={() => setLocation(loc.id)}
                  className="group frame !p-[5px] text-left bg-crema transition-transform hover:-translate-y-0.5 active:translate-x-px active:translate-y-px"
                >
                  <span className="frame-in flex items-center gap-3 p-3">
                    <img
                      src={img(loc.image, 200, 60)}
                      alt=""
                      className="w-20 h-20 rounded-md object-cover flex-shrink-0 border border-tomate/40"
                      loading="lazy"
                    />
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-2 flex-wrap">
                        <span className="font-sans font-extrabold uppercase text-lg text-tomate leading-tight">{loc.name}</span>
                        <span className={[
                          'rounded-md px-1.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide',
                          abierta ? 'bg-albahaca text-masa' : 'bg-forno/10 text-carbon/60',
                        ].join(' ')}>
                          {abierta ? 'Abierta' : 'Cerrada ahora'}
                        </span>
                      </span>
                      <span className="mt-1 flex items-start gap-1 text-xs text-carbon/70">
                        <MapPin className="w-3.5 h-3.5 mt-px flex-shrink-0 text-tomate" /> {loc.address}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-carbon/80">
                        {loc.rating != null && (
                          <span className="flex items-center gap-1"><Star className="w-3.5 h-3.5 fill-horno text-horno" /> {decimal(loc.rating)}</span>
                        )}
                        {loc.services.pickup && <span className="flex items-center gap-1"><Package className="w-3.5 h-3.5 text-tomate" /> Recoger</span>}
                        {loc.services.delivery && <span className="flex items-center gap-1"><Truck className="w-3.5 h-3.5 text-tomate" /> A domicilio</span>}
                        {loc.kitchen && <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-tomate" /> {loc.kitchen.open}–{loc.kitchen.close}</span>}
                      </span>
                    </span>
                    <span className="hidden sm:flex self-center rounded-md bg-tomate px-3 py-2 font-sans font-bold uppercase text-xs tracking-wide text-masa group-hover:bg-forno transition-colors">
                      Elegir
                    </span>
                  </span>
                </button>
              )
            })}
          </div>

          <button onClick={close} className="mt-4 w-full text-center text-sm font-semibold text-carbon/55 underline underline-offset-4 hover:text-tomate">
            Solo quiero ver la carta
          </button>
        </div>
      </div>
    </div>
  )
}
