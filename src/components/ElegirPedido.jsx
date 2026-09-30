import { MapPin } from 'lucide-react'
import { LOCATIONS, availableModes } from '../data/locations'
import { useStore, useActions } from '../store/StoreContext'
import { useStoreStatus } from '../hooks/useStoreStatus'
import { navigate } from '../lib/router'

/**
 * PANTALLA 2 — ELECCIÓN DEL PEDIDO. Una sola decisión: en qué sede y
 * cómo (recoger o entrega). Usa las sedes y modos reales del proyecto;
 * un toque elige las dos cosas y pasa a la carta.
 */
export default function ElegirPedido() {
  const { locationId, order } = useStore()
  const { setLocation, setMode } = useActions()
  const { isOpen } = useStoreStatus()

  const choose = (locId, modeId) => {
    setLocation(locId)
    setMode(modeId)
    navigate('/carta')
  }

  return (
    <section className="bg-masa px-5 py-10 sm:py-14">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-center font-display font-bold text-tomate text-[clamp(2rem,8vw,3.25rem)] leading-none">
          ¿Dónde quieres pedir?
        </h1>

        <div className="mt-8 flex flex-col gap-5">
          {LOCATIONS.map((loc) => {
            const abierta = isOpen(loc.id)
            return (
              <div key={loc.id} className="frame">
                <div className="frame-in p-4 sm:p-5">
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

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {availableModes(loc.id).map((m) => {
                      const picked = locationId === loc.id && order.mode === m.id
                      return (
                        <button
                          key={m.id}
                          onClick={() => choose(loc.id, m.id)}
                          aria-pressed={picked}
                          className="btn bg-tomate text-masa !min-h-[3.75rem] text-base"
                        >
                          <span className="btn-layer bg-forno" />
                          <span className="btn-label flex-col !gap-0.5">
                            <span>{m.label}</span>
                            <span className="text-[0.7rem] font-medium normal-case tracking-normal opacity-85">{m.hint}</span>
                          </span>
                        </button>
                      )
                    })}
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
