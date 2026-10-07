import { useState } from 'react'
import { ArrowLeft, Check, Phone, X } from 'lucide-react'
import { ALLERGENS, ALLERGEN_NOTICE, ALLERGEN_SOURCE, allergensOf, getAllergen } from '../data/allergens'
import { CATEGORIES, productsByCategory } from '../data/menu'
import { LOCATIONS } from '../data/locations'
import { useActions } from '../store/StoreContext'
import { navigate } from '../lib/router'
import AllergenIcon from './AllergenIcon'

const toneOf = (a, id) => (a.contains.includes(id) ? 'contains' : a.traces.includes(id) ? 'traces' : 'off')

/**
 * Tabla de alérgenos de toda la carta. Arriba, "¿qué no puedes tomar?":
 * al marcar alérgenos, los platos que los llevan se apagan y se dice
 * por qué. En móvil, una tarjeta por plato; en escritorio, la tabla de
 * 14 columnas como la del local.
 */
export default function AllergenTable() {
  const { openProduct } = useActions()
  const [avoid, setAvoid] = useState([])
  const [strict, setStrict] = useState(false)

  const groups = CATEGORIES
    .map((cat) => ({ ...cat, items: productsByCategory(cat.id).filter((p) => allergensOf(p.id)) }))
    .filter((g) => g.items.length)
  const pending = CATEGORIES
    .flatMap((cat) => productsByCategory(cat.id))
    .filter((p) => !allergensOf(p.id) && p.category !== 'bebidas')

  /* Alérgenos marcados que este plato lleva (o trae en trazas, si se pide) */
  const conflicts = (a) => avoid.filter((id) => a.contains.includes(id) || (strict && a.traces.includes(id)))
  const total = groups.reduce((n, g) => n + g.items.length, 0)
  const ok = groups.reduce((n, g) => n + g.items.filter((p) => !conflicts(allergensOf(p.id)).length).length, 0)

  const toggle = (id) => setAvoid((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id]))
  /* La ficha se abre encima de la tabla: no hace falta tener sede elegida */
  const open = (id) => openProduct(id)

  return (
    <section className="bg-masa pt-6 sm:pt-10 pb-28 sm:pb-32">
      <div className="shell">
        <button onClick={() => navigate('/carta')} className="mono normal-case inline-flex items-center gap-1.5 text-tomate hover:text-horno transition-colors">
          <ArrowLeft className="w-4 h-4" /> Volver a la carta
        </button>

        <header className="mt-6 text-center">
          <h1 className="font-display font-extrabold text-display-sm text-tomate">Alérgenos</h1>
          <p className="mt-3 mx-auto max-w-xl font-sans text-sm sm:text-base text-carbon/70 leading-snug">
            Lo que lleva cada plato de la carta. Marca lo que no puedes tomar y te decimos qué puedes pedir.
          </p>
        </header>

        {/* Filtro */}
        <div className="frame mt-8 mx-auto max-w-4xl">
          <div className="frame-in p-4 sm:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="mono text-tomate">¿Qué no puedes tomar?</p>
              {avoid.length > 0 && (
                <button onClick={() => setAvoid([])} className="mono normal-case text-tomate hover:text-horno transition-colors">
                  Quitar filtro
                </button>
              )}
            </div>
            <div className="mt-3 grid grid-cols-2 min-[420px]:grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              {ALLERGENS.map((al) => {
                const on = avoid.includes(al.id)
                return (
                  <button
                    key={al.id}
                    onClick={() => toggle(al.id)}
                    aria-pressed={on}
                    className={[
                      'flex items-center gap-2 rounded-md border px-2 py-1.5 text-left text-[0.8rem] font-semibold leading-tight transition-colors',
                      on ? 'border-tomate bg-tomate/10 text-tomate' : 'border-tomate/30 text-carbon hover:border-tomate',
                    ].join(' ')}
                  >
                    <AllergenIcon id={al.id} tone={on ? 'contains' : 'traces'} size="sm" title="" />
                    {al.label}
                  </button>
                )
              })}
            </div>
            <label className="mt-4 inline-flex items-center gap-2 text-sm text-carbon/80 cursor-pointer select-none">
              <input type="checkbox" checked={strict} onChange={(e) => setStrict(e.target.checked)} className="w-4 h-4 accent-[rgb(var(--c-tomate))]" />
              Descartar también los que pueden tener trazas
            </label>
            {avoid.length > 0 && (
              <p className="mt-3 font-sans font-bold text-carbon">
                <span className="text-tomate">{ok}</span> de {total} platos sin {avoid.map((id) => getAllergen(id).label.toLowerCase()).join(', ')}
                {strict && ' (ni trazas)'}
              </p>
            )}
          </div>
        </div>

        {/* Leyenda */}
        <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-carbon/75">
          <span className="inline-flex items-center gap-2"><AllergenIcon id="lacteos" tone="contains" size="sm" title="" /> Contiene</span>
          <span className="inline-flex items-center gap-2"><AllergenIcon id="lacteos" tone="traces" size="sm" title="" /> Puede contener trazas</span>
        </div>

        {/* Móvil: tarjetas */}
        <div className="mt-8 md:hidden space-y-8">
          {groups.map((g) => (
            <div key={g.id}>
              <h2 className="mono text-tomate border-b border-tomate/30 pb-2">{g.label}</h2>
              <ul className="divide-y divide-tomate/15">
                {g.items.map((p) => {
                  const a = allergensOf(p.id)
                  const bad = conflicts(a)
                  return (
                    <li key={p.id} className={`py-3 transition-opacity ${bad.length ? 'opacity-45' : ''}`}>
                      <div className="flex items-center justify-between gap-3">
                        <button onClick={() => open(p.id)} className="font-sans font-bold uppercase text-carbon text-left hover:text-tomate">{p.name}</button>
                        <Verdict active={avoid.length > 0} bad={bad} />
                      </div>
                      {a.contains.length > 0 ? (
                        <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5">
                          {a.contains.map((id) => (
                            <li key={id} className="inline-flex items-center gap-1.5 text-sm font-semibold text-carbon">
                              <AllergenIcon id={id} tone="contains" size="sm" title="" />
                              {getAllergen(id).label}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1.5 text-sm text-carbon/70">Sin alérgenos</p>
                      )}
                      {a.traces.length > 0 && (
                        <p className="mt-2 text-xs text-carbon/60">
                          Trazas: {a.traces.map((id) => getAllergen(id).label.toLowerCase()).join(', ')}
                        </p>
                      )}
                      {a.note && <p className="mt-1.5 text-xs text-carbon/60 leading-snug">{a.note}</p>}
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>

        {/* Escritorio: tabla */}
        <div className="mt-8 hidden md:block overflow-x-auto rounded-md border border-tomate/40">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 bg-crema">
              <tr>
                <th className="text-left px-4 py-3 mono text-tomate font-normal">Plato</th>
                {ALLERGENS.map((al) => (
                  <th key={al.id} className="px-1 py-3 align-bottom">
                    <div className="flex flex-col items-center gap-1.5">
                      <AllergenIcon id={al.id} tone={avoid.includes(al.id) ? 'contains' : 'traces'} size="sm" />
                      <span className="text-[0.65rem] font-bold uppercase leading-tight text-carbon/60 max-w-[4.5rem] text-center">{al.label}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            {groups.map((g) => (
              <tbody key={g.id}>
                <tr>
                  <th colSpan={ALLERGENS.length + 1} className="text-left px-4 pt-5 pb-2 mono text-tomate font-normal bg-masa border-t border-tomate/30">{g.label}</th>
                </tr>
                {g.items.map((p) => {
                  const a = allergensOf(p.id)
                  const bad = conflicts(a)
                  return (
                    <tr key={p.id} className={`border-t border-tomate/10 hover:bg-tomate/5 transition-opacity ${bad.length ? 'opacity-40' : ''}`}>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <button onClick={() => open(p.id)} className="font-sans font-bold uppercase text-carbon text-left hover:text-tomate">{p.name}</button>
                          <Verdict active={avoid.length > 0} bad={bad} compact />
                        </div>
                        {a.note && <p className="mt-0.5 text-xs text-carbon/60 leading-snug max-w-[16rem]">{a.note}</p>}
                      </td>
                      {ALLERGENS.map((al) => {
                        const tone = toneOf(a, al.id)
                        return (
                          <td key={al.id} className={`px-1 py-2 text-center ${avoid.includes(al.id) ? 'bg-tomate/5' : ''}`}>
                            {tone !== 'off' && (
                              <AllergenIcon
                                id={al.id}
                                tone={tone}
                                size="sm"
                                className="!w-6 !h-6 [&>svg]:!w-3.5 [&>svg]:!h-3.5"
                                title={`${al.label}${tone === 'traces' ? ' (trazas)' : ''}`}
                              />
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            ))}
          </table>
        </div>

        {pending.length > 0 && (
          <div className="mt-10 mx-auto max-w-3xl rounded-md border border-dashed border-tomate/50 p-4 sm:p-5">
            <p className="mono text-tomate">Aún sin ficha</p>
            <p className="mt-2 text-sm text-carbon/75 leading-snug">
              {pending.map((p) => p.name).join(' · ')}.
            </p>
            <p className="mt-2 text-sm text-carbon/75 leading-snug">
              Si tienes alguna alergia y quieres pedir alguno de estos, llámanos antes:{' '}
              {LOCATIONS.map((l, i) => (
                <span key={l.id} className="whitespace-nowrap">
                  {i > 0 && ' · '}{l.name}{' '}
                  <a href={`tel:+34${l.phones[0].replace(/\s/g, '')}`} className="inline-flex items-center gap-1 font-bold text-tomate">
                    <Phone className="w-3.5 h-3.5" />{l.phones[0]}
                  </a>
                </span>
              ))}
            </p>
          </div>
        )}

        <p className="mt-10 mx-auto max-w-2xl text-center text-xs text-carbon/60 leading-relaxed">
          {ALLERGEN_NOTICE}
          <br />
          <span className="mono normal-case">{ALLERGEN_SOURCE}</span>
        </p>
      </div>
    </section>
  )
}

/* Veredicto por plato cuando hay filtro: "Apto" o "Lleva gluten, huevos" */
function Verdict({ active, bad, compact = false }) {
  if (!active) return null
  if (!bad.length) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-albahaca/15 px-2 py-0.5 text-[0.7rem] font-bold uppercase text-albahaca whitespace-nowrap">
        <Check className="w-3 h-3" strokeWidth={3} /> Apto
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-[0.7rem] font-bold uppercase text-tomate whitespace-nowrap">
      <X className="w-3 h-3" strokeWidth={3} />
      {compact ? 'No' : `Lleva ${bad.map((id) => getAllergen(id).label.toLowerCase()).join(', ')}`}
    </span>
  )
}
