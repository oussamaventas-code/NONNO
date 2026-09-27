import { Star, Truck, Package, Check, Clock, MapPin, Phone, CalendarClock } from 'lucide-react'
import { img, srcSet } from '../data/images'
import { decimal } from '../lib/format'
import { hourOf } from '../lib/kitchenSlots'
import { useKitchenEta, minutesUntil } from '../hooks/useKitchenEta'

/**
 * Tarjeta grande de sede — no una card genérica. Imagen editorial,
 * valoración real, servicios indicados y CTA doble.
 */
export default function LocationCard({ location, selected, closed, onSelect, onOrder, onViewMenu }) {
  const eta = useKitchenEta(closed ? null : location.id, 1)
  const full = eta?.ok === false

  return (
    <article
      className={[
        'group relative overflow-hidden rounded-block bg-carbon text-crema flex flex-col',
        'transition-all duration-500 ease-magnetic',
        selected ? 'ring-2 ring-tomate ring-offset-4 ring-offset-masa' : '',
      ].join(' ')}
    >
      <div className="relative h-64 sm:h-80 overflow-hidden">
        <img
          src={img(location.image, 1000, 70)}
          srcSet={srcSet(location.image, [500, 800, 1000])}
          sizes="(min-width: 1024px) 50vw, 100vw"
          alt={`Ambiente de ${location.fullName}`}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-700 ease-magnetic group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-carbon via-carbon/10 to-transparent" />
        <span className="absolute top-4 left-4 mono text-crema/60">{location.code}</span>
        {closed && (
          <span className="absolute top-4 right-4 mono normal-case flex items-center gap-1.5 rounded-full bg-carbon/80 px-3 py-1.5 text-crema/80">
            CERRADO AHORA
          </span>
        )}
        {!closed && selected && (
          <span className="absolute top-4 right-4 mono normal-case flex items-center gap-1.5 rounded-full bg-tomate px-3 py-1.5 text-crema">
            <Check className="w-3.5 h-3.5" /> SEDE SELECCIONADA
          </span>
        )}
      </div>

      <div className="p-6 sm:p-8 flex flex-col flex-1">
        <h3 className="font-sans font-extrabold uppercase text-xl sm:text-2xl leading-tight">
          LA PIZZA DE <em className="font-serif italic font-semibold ">NONNO</em>
          <span className="block mt-0.5 text-crema/60 text-base sm:text-lg font-bold">{location.name}</span>
        </h3>

        <div className="mt-3 flex items-center gap-2 mono normal-case text-crema/70">
          <Star className="w-3.5 h-3.5 fill-horno text-horno" />
          <span className="text-crema font-semibold">{decimal(location.rating)}</span>
          <span>· {location.reviews} reseñas</span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {location.services.pickup && (
            <span className="mono normal-case flex items-center gap-1.5 rounded-full border border-crema/15 px-3 py-1.5 text-crema/80">
              <Package className="w-3.5 h-3.5" /> Recogida
            </span>
          )}
          {location.services.delivery && (
            <span className="mono normal-case flex items-center gap-1.5 rounded-full border border-crema/15 px-3 py-1.5 text-crema/80">
              <Truck className="w-3.5 h-3.5" /> Entrega
            </span>
          )}
        </div>

        {!closed && eta && (
          <p className={[
            'mt-4 mono normal-case flex items-center gap-1.5',
            eta.ok ? 'text-horno' : 'text-crema/60',
          ].join(' ')}>
            <Clock className="w-3.5 h-3.5" />
            {eta.ok
              ? `Pide ahora y recógela a las ${hourOf(eta.readyAt)} (${minutesUntil(eta.readyAt)} min)`
              : eta.message}
          </p>
        )}

        {(location.address || location.hours || location.phones?.length > 0) && (
          <div className="mt-4 flex flex-col gap-1.5 text-sm text-crema/70">
            {location.address && <p className="flex items-start gap-2"><MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />{location.address}</p>}
            {location.hours && <p className="flex items-start gap-2"><CalendarClock className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />{location.hours}</p>}
            {location.phones?.length > 0 && (
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                {location.phones.map((p) => (
                  <a key={p} href={`tel:+34${p.replace(/\s/g, '')}`} className="font-semibold text-crema underline-offset-2 hover:underline">{p}</a>
                ))}
              </p>
            )}
          </div>
        )}

        <p className="mt-4 text-sm text-crema/50 flex-1">{location.tagline}</p>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={onViewMenu}
            className="btn bg-transparent border border-crema/25 text-crema px-5 py-2.5 min-h-[44px] flex-1"
          >
            <span className="btn-layer bg-crema/10" />
            <span className="btn-label">VER MENÚ</span>
          </button>
          <button
            onClick={onOrder}
            disabled={closed || full}
            className={[
              'btn px-5 py-2.5 min-h-[44px] flex-1 disabled:opacity-50 disabled:cursor-not-allowed',
              selected ? 'bg-albahaca text-crema' : 'bg-tomate text-crema',
            ].join(' ')}
          >
            <span className="btn-layer bg-horno" />
            <span className="btn-label">
              {closed ? 'CERRADO AHORA' : full ? (eta.reason === 'full' ? 'COMPLETO POR HOY' : 'COCINA CERRADA') :selected ? 'PEDIR AQUÍ ✓' : 'PEDIR EN ESTA SEDE'}
            </span>
          </button>
        </div>
      </div>
    </article>
  )
}
