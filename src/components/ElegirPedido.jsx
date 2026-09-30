import { MapPin } from 'lucide-react'
import { LOCATIONS } from '../data/locations'
import { useActions } from '../store/StoreContext'
import { useStoreStatus } from '../hooks/useStoreStatus'
import { navigate } from '../lib/router'
import { img, srcSet } from '../data/images'
import { kitchenHours } from '../lib/kitchenSlots'

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
            /* Abierta de verdad: interruptor del local encendido y dentro del horario de cocina */
            const hours = kitchenHours(loc.kitchen)
            const abierta = isOpen(loc.id) && hours.open
            const estado = abierta ? 'Abierta'
              : !isOpen(loc.id) ? 'Cerrada'
                : hours.later ? `Abre a las ${hours.opensAt}` : `Abre mañana ${hours.opensAt}`
            return (
              <div key={loc.id} className="frame neon">
                {/* Foto vertical entera a la izquierda: se ve la fachada completa */}
                {/* La altura la marca el texto (nunca corta el botón); la foto se estira a esa altura */}
                <div className="frame-in grid grid-cols-[7.5rem_1fr] sm:grid-cols-[11rem_1fr] min-h-[11.5rem] sm:min-h-[15rem]">
                  <div className="relative">
                    {loc.image?.startsWith('own:') && (
                      <img
                        src={img(loc.image, 600)}
                        srcSet={srcSet(loc.image)}
                        sizes="(min-width: 640px) 176px, 120px"
                        alt={`Fachada de Nonno ${loc.name}`}
                        loading="lazy"
                        className="absolute inset-0 h-full w-full object-cover object-center"
                      />
                    )}
                  </div>
                  <div className="flex flex-col p-3 sm:p-5 min-w-0">
                    <h2 className="font-sans font-extrabold uppercase text-lg sm:text-2xl neon-amarillo leading-tight">{loc.name}</h2>
                    <span className={[
                      'mt-1.5 self-start whitespace-nowrap',
                      abierta ? 'pill-neon' : 'rounded-full px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide border border-carbon/30 text-carbon/60',
                    ].join(' ')}>
                      {estado}
                    </span>
                    <p className="mt-2 flex items-start gap-1 text-sm text-carbon/70">
                      <MapPin className="w-4 h-4 mt-px flex-shrink-0 text-tomate" /> {loc.address}
                    </p>
                    <span className="flex-1 min-h-3" aria-hidden="true" />
                    <button
                      onClick={() => choose(loc.id)}
                      className="btn-neon min-h-[3rem] sm:min-h-[3.5rem] text-lg sm:text-2xl"
                    >
                      PEDIR
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
