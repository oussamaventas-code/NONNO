import { Clock } from 'lucide-react'
import { hourOf } from '../lib/kitchenSlots'
import { useKitchenEta, minutesUntil } from '../hooks/useKitchenEta'
import { ORDER_BAND } from '../data/content'

/**
 * Caja de línea doble de una sede: nombre (es el enlace para pedir
 * allí), estado y horario con la línea ondulada y los servicios, y la
 * dirección con el teléfono.
 */
export default function LocationCard({ location, selected, closed, onOrder }) {
  const eta = useKitchenEta(closed ? null : location.id, 1)
  const full = eta?.ok === false
  const blocked = closed || full

  return (
    <article className={['frame', selected ? 'ring-2 ring-albahaca ring-offset-4 ring-offset-masa' : ''].join(' ')}>
      <div className="frame-in grid md:grid-cols-[1fr_1.45fr_1fr] gap-6 md:gap-6 px-6 sm:px-8 pt-10 pb-8 text-tomate font-sans font-semibold text-lg leading-6">
        <div>
          <button
            onClick={onOrder}
            disabled={blocked}
            className="font-display italic font-bold text-2xl leading-6 underline decoration-1 underline-offset-4 hover:text-forno disabled:no-underline disabled:cursor-not-allowed text-left"
          >
            {location.name}
          </button>
          <p className="mt-2 text-sm font-medium text-tomate/80">
            {closed ? 'Cerrado ahora' : full ? (eta.reason === 'full' ? 'Completo por hoy' : 'Cocina cerrada') : selected ? 'Tu sede · pedir aquí' : 'Pedir en esta sede'}
          </p>
        </div>

        <div className="flex flex-col items-center">
          <div className="flex gap-2">
            <span className={closed ? 'text-forno/60' : ''}>{closed ? 'CERRADO' : 'ABIERTO'}</span>
            {/* Un tramo del horario por línea */}
            <span>
              {location.hours?.split(/\.\s*/).filter(Boolean).map((t) => <span key={t} className="block">{t}</span>)}
            </span>
          </div>
          {!closed && eta?.ok && (
            <p className="mt-2 flex items-center gap-1.5 text-sm font-medium">
              <Clock className="w-3.5 h-3.5" />
              Recógela a las {hourOf(eta.readyAt)} ({minutesUntil(eta.readyAt)} min)
            </p>
          )}
          <div className="wavy mt-5 w-full max-w-[25rem]" aria-hidden="true" />
          <p className="mt-6 uppercase">{ORDER_BAND.services}</p>
        </div>

        <div className="md:text-right">
          <p>{location.address}</p>
          {location.phones?.map((p) => (
            <a key={p} href={`tel:+34${p.replace(/\s/g, '')}`} className="block mt-2 hover:text-forno">{p}</a>
          ))}
        </div>
      </div>
    </article>
  )
}
