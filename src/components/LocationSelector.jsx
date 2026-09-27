import { useEffect, useRef } from 'react'
import { LOCATIONS } from '../data/locations'
import { useSelectedLocation, useActions } from '../store/StoreContext'
import { useStoreStatus } from '../hooks/useStoreStatus'
import { useNearestLocation } from '../hooks/useNearestLocation'
import LocationCard from './LocationCard'
import { gsap, useGSAP, EASE, STAGGER, onEnter , revealFrom } from '../lib/motion'
import { scrollToSection } from '../lib/scroll'

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

  const scrollToMenu = () =>
    scrollToSection('menu')

  const handleOrder = (id) => {
    setLocation(id)
    openCart()
  }

  return (
    <section id="sedes" ref={rootRef} className="section bg-masa">
      <div className="shell">
        <div className="max-w-2xl">
          <p className="mono text-tomate mb-4">NUESTRAS SEDES</p>
          <h2 className="font-sans font-extrabold uppercase text-display-sm text-carbon leading-[0.95]">
            DOS SEDES.<br />
            UN MISMO <em className="font-serif italic font-semibold text-tomate ">NONNO</em>.
          </h2>
          <p className="mt-5 text-carbon/60 text-base sm:text-lg">
            Elige desde dónde quieres disfrutar tu pizza.
          </p>
        </div>

        <div className="mt-12 grid md:grid-cols-2 gap-6 lg:gap-8">
          {LOCATIONS.map((loc) => (
            <div key={loc.id} className="location-card">
              <LocationCard
                location={loc}
                selected={locationId === loc.id}
                closed={!isOpen(loc.id)}
                nearestKm={nearest?.id === loc.id ? nearest.km : null}
                onSelect={() => setLocation(loc.id)}
                onViewMenu={scrollToMenu}
                onOrder={() => handleOrder(loc.id)}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
