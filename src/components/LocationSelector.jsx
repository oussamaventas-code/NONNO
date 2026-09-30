import { useEffect, useRef } from 'react'
import { LOCATIONS } from '../data/locations'
import { useSelectedLocation, useActions } from '../store/StoreContext'
import { useStoreStatus } from '../hooks/useStoreStatus'
import { useNearestLocation } from '../hooks/useNearestLocation'
import LocationCard from './LocationCard'
import Illustration from './Illustration'
import { ORDER_BAND, ILLUSTRATIONS } from '../data/content'
import { useGSAP, EASE, STAGGER, onEnter, revealFrom } from '../lib/motion'

/**
 * Selector de sedes. Fija selectedLocation en el store y persiste.
 * Ambas tarjetas abren "VER MENÚ" haciendo scroll a #menu.
 */
export default function LocationSelector() {
  const { locationId } = useSelectedLocation()
  const { setLocation, openCart } = useActions()
  const { isOpen } = useStoreStatus()
  const nearest = useNearestLocation()
  const rootRef = useRef(null)

  /* Si nadie ha elegido sede todavía (ni queda una guardada de una
     visita anterior), se le pone directamente la más cercana. El
     cliente sigue pudiendo cambiarla tocando la otra tarjeta. */
  useEffect(() => {
    if (nearest && !locationId) setLocation(nearest.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nearest])

  useGSAP(() => {
    revealFrom('.location-card', {
      y: 50,
      opacity: 0,
      stagger: STAGGER.cards,
      duration: 0.9,
      ease: EASE.in,
      scrollTrigger: onEnter(rootRef.current, 'top 78%'),
    })
  }, { scope: rootRef })

  const handleOrder = (id) => {
    setLocation(id)
    openCart()
  }

  return (
    <section id="sedes" ref={rootRef} className="bg-masa pt-24 sm:pt-[7.5rem] pb-24 sm:pb-[7.5rem] overflow-hidden">
      <h2 className="px-5 mx-auto max-w-[70rem] text-center font-display font-bold text-neon text-[clamp(2rem,3.6vw,3.25rem)] leading-none">
        {ORDER_BAND.title}
      </h2>

      <div className="relative mt-24 mx-auto max-w-[60rem] px-5 sm:px-8 lg:px-0 flex flex-col gap-10">
        {/* Sello "Take Away" saliéndose por la esquina de la primera caja */}
        <span
          className="absolute z-10 -top-12 left-2 lg:-left-44 -rotate-[14deg] inline-flex items-center justify-center w-44 h-24 lg:w-60 lg:h-32 rounded-[50%] bg-[#2F7FD1] text-masa border-2 border-forno outline outline-1 outline-offset-[-7px] outline-masa font-display italic font-bold text-2xl lg:text-4xl shadow-[3px_3px_0_0_rgb(var(--c-forno))]"
          aria-hidden="true"
        >
          Take Away
        </span>

        {LOCATIONS.map((loc) => (
          <div key={loc.id} className="location-card">
            <LocationCard
              location={loc}
              selected={locationId === loc.id}
              closed={!isOpen(loc.id)}
              onOrder={() => handleOrder(loc.id)}
            />
          </div>
        ))}

        {/* Pegatina de reparto saliéndose por la derecha */}
        <Illustration
          src={ILLUSTRATIONS.delivery}
          alt=""
          hideWhenMissing
          className="hidden lg:block absolute -right-40 top-1/2 -translate-y-1/2 w-60 rotate-6 pointer-events-none"
        />
      </div>
    </section>
  )
}
