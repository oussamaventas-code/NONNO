import { MapPin } from 'lucide-react'
import { LOCATIONS } from '../data/locations'
import { useActions } from '../store/StoreContext'
import { useStoreStatus } from '../hooks/useStoreStatus'
import { navigate } from '../lib/router'
import { img, srcSet } from '../data/images'

/**
 * PANTALLA 2 — ELECCIÓN DEL PEDIDO. Una sola decisión: en qué sede.
 * Un botón por sede y pasa a la carta; recoger o entrega se elige
 * después, al hacer el pedido.
 */
export default function ElegirPedido() {
  const { setLocation } = useActions()
  const { isOpen } = useStoreStatus()

  const choose = (locId) => {
    setLocation(locId)
    navigate('/carta')
  }

  return (
    <section className="bg-masa px-5 py-6 sm:py-14">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-center font-display font-bold text-tomate text-[clamp(2rem,8vw,3.25rem)] leading-none">
          ¿Dónde quieres pedir?
        </h1>

        <div className="mt-5 sm:mt-8 flex flex-col gap-4 sm:gap-5">
          {LOCATIONS.map((loc) => {
            const abierta = isOpen(loc.id)
            return (
              <div key={loc.id} className="frame">
                <div className="frame-in p-3 sm:p-5">
                  {/* Solo las sedes con foto propia del local */}
                  {loc.image?.startsWith('own:') && (
                    <img
                      src={img(loc.image, 600)}
                      srcSet={srcSet(loc.image)}
                      sizes="(min-width: 672px) 640px, 90vw"
                      alt={`Local de ${loc.name}`}
                      loading="lazy"
                      className="mb-3 h-28 sm:h-48 w-full rounded-md object-cover object-[50%_10%] border border-tomate/40"
                    />
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-sans font-extrabold uppercase text-xl text-tomate leading-tight">{loc.name}</h2>
                    <span className={[
                      'rounded-md px-1.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide',
                      abierta ? 'bg-albahaca text-masa' : 'bg-forno/10 text-carbon/60',
                    ].join(' ')}>
                      {abierta ? 'Abierta' : 'Cerrada ahora'}
                    </span>
                  </div>
                  <p className="mt-1 flex items-start gap-1 text-sm text-carbon/70">
                    <MapPin className="w-4 h-4 mt-px flex-shrink-0 text-tomate" /> {loc.address}
                  </p>

                  <button
                    onClick={() => choose(loc.id)}
                    className="btn bg-tomate text-masa mt-3 sm:mt-4 w-full !min-h-[3.25rem] sm:!min-h-[3.75rem] text-lg"
                  >
                    <span className="btn-layer bg-forno" />
                    <span className="btn-label">ELEGIR</span>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
