import { ArrowRight, Phone } from 'lucide-react'
import { allergensOf, getAllergen } from '../data/allergens'
import { getLocation } from '../data/locations'
import AllergenIcon from './AllergenIcon'

function Chip({ id, tone }) {
  return (
    <li className="flex items-center gap-2 pr-1">
      <AllergenIcon id={id} tone={tone} size="sm" />
      <span className={tone === 'contains' ? 'text-sm font-semibold text-carbon' : 'text-sm text-carbon/70'}>
        {getAllergen(id).label}
      </span>
    </li>
  )
}

/**
 * Alérgenos de un producto en su ficha: lo que lleva (relleno) y lo
 * que puede llevar en trazas (a trazos), con enlace a la tabla entera.
 * Sin ficha, se dice claramente y se da el teléfono de la sede.
 */
export default function ProductAllergens({ productId, locationId, onOpenTable }) {
  const a = allergensOf(productId)
  const phone = getLocation(locationId)?.phones?.[0]

  return (
    <section className="mt-7 rounded-md border border-tomate/40 bg-masa/60 p-4" aria-labelledby="alergenos-title">
      <div className="flex items-baseline justify-between gap-3">
        <h3 id="alergenos-title" className="mono text-tomate">Alérgenos</h3>
        <button
          onClick={onOpenTable}
          className="mono normal-case inline-flex items-center gap-1 text-tomate hover:text-horno transition-colors"
        >
          Tabla completa <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {!a ? (
        <p className="mt-3 text-sm text-carbon/75 leading-snug">
          Todavía no tenemos la ficha de alérgenos de este producto.{' '}
          {phone && (
            <>
              Si tienes alguna alergia, llámanos antes de pedir:{' '}
              <a href={`tel:+34${phone.replace(/\s/g, '')}`} className="inline-flex items-center gap-1 font-bold text-tomate whitespace-nowrap">
                <Phone className="w-3.5 h-3.5" /> {phone}
              </a>
            </>
          )}
        </p>
      ) : (
        <>
          {a.contains.length > 0 ? (
            <div className="mt-3">
              <p className="text-xs font-bold uppercase tracking-wider text-carbon/55 mb-2">Contiene</p>
              <ul className="flex flex-wrap gap-x-4 gap-y-2">
                {a.contains.map((id) => <Chip key={id} id={id} tone="contains" />)}
              </ul>
            </div>
          ) : (
            <p className="mt-3 text-sm font-semibold text-carbon">No lleva ninguno de los 14 alérgenos.</p>
          )}

          {a.traces.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-bold uppercase tracking-wider text-carbon/55 mb-2">Puede contener trazas</p>
              <ul className="flex flex-wrap gap-x-4 gap-y-2">
                {a.traces.map((id) => <Chip key={id} id={id} tone="traces" />)}
              </ul>
            </div>
          )}

          {a.note && <p className="mt-3 text-sm text-carbon/70 leading-snug">{a.note}</p>}
        </>
      )}
    </section>
  )
}
