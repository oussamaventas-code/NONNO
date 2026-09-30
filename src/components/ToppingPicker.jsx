import { useState } from 'react'
import { Beef, Salad, Milk, Droplets, Fish, Egg, Check } from 'lucide-react'
import { getExtra } from '../data/menu'
import { price } from '../lib/format'

/* Grupos de toppings, en el orden en que más se piden */
export const TOPPING_GROUPS = [
  { id: 'Carnes', label: 'Carnes', Icon: Beef },
  { id: 'Verduras', label: 'Verduras', Icon: Salad },
  { id: 'Quesos', label: 'Quesos', Icon: Milk },
  { id: 'Salsas y toques', label: 'Salsas', Icon: Droplets },
  { id: 'Del mar', label: 'Del mar', Icon: Fish },
  { id: 'Otros', label: 'Otros', Icon: Egg },
]

/**
 * Toppings por tipo: un botón con icono por grupo y, debajo, solo los
 * ingredientes de ese grupo. Mucho menos texto que la lista entera.
 * Lo usan la ficha de la web y el editor del mostrador.
 *
 * @param {string[]} extraIds  toppings disponibles para el producto
 * @param {string[]} selected  toppings marcados
 * @param {'lg'|'sm'} size     'lg' en la web (dedo en el móvil), 'sm' en el mostrador
 */
export default function ToppingPicker({ extraIds = [], selected, onToggle, size = 'lg', title = 'TOPPINGS' }) {
  const extras = extraIds.map(getExtra).filter(Boolean)
  const groups = TOPPING_GROUPS
    .map((g) => ({ ...g, items: extras.filter((e) => e.group === g.id) }))
    .filter((g) => g.items.length)
  const [groupId, setGroupId] = useState(groups[0]?.id)
  if (!groups.length) return null
  const group = groups.find((g) => g.id === groupId) || groups[0]

  /* Si todos cuestan lo mismo se dice una vez y no en cada botón */
  const prices = new Set(extras.map((e) => e.price))
  const uniform = prices.size === 1 ? [...prices][0] : null
  const lg = size === 'lg'
  const picked = extras.filter((e) => selected.includes(e.id))

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <p className="mono text-tomate">{title}</p>
        {uniform != null && <p className="mono normal-case text-carbon/55">+{price(uniform)} cada uno</p>}
      </div>

      <div className={['grid gap-1.5', lg ? 'grid-cols-3 sm:grid-cols-6' : 'grid-cols-3 sm:grid-cols-6 lg:grid-cols-3 xl:grid-cols-6'].join(' ')} role="tablist">
        {groups.map((g) => {
          const n = g.items.filter((e) => selected.includes(e.id)).length
          const active = g.id === group.id
          return (
            <button
              key={g.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setGroupId(g.id)}
              className={[
                'relative flex flex-col items-center gap-1 rounded-md border px-1 font-semibold uppercase tracking-wide transition-colors',
                lg ? 'py-2.5 text-[0.7rem]' : 'py-2 text-[0.65rem]',
                active ? 'border-tomate bg-tomate text-masa' : 'border-tomate/40 text-tomate hover:bg-tomate/10',
              ].join(' ')}
            >
              <g.Icon className={lg ? 'w-6 h-6' : 'w-5 h-5'} strokeWidth={1.75} />
              {g.label}
              {n > 0 && (
                <span className={[
                  'absolute -top-1.5 -right-1.5 min-w-[1.15rem] h-[1.15rem] px-1 rounded-full text-[0.65rem] leading-[1.15rem] text-center font-bold',
                  active ? 'bg-masa text-tomate' : 'bg-tomate text-masa',
                ].join(' ')}>{n}</span>
              )}
            </button>
          )
        })}
      </div>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {group.items.map((extra) => {
          const on = selected.includes(extra.id)
          return (
            <button
              key={extra.id}
              type="button"
              onClick={() => onToggle(extra.id)}
              aria-pressed={on}
              className={[
                'inline-flex items-center gap-1 rounded-md border font-semibold transition-colors',
                lg ? 'px-3 py-2 min-h-[40px] text-sm' : 'px-2.5 py-1.5 text-xs',
                on ? 'border-tomate bg-tomate text-masa' : 'border-tomate/40 bg-masa text-carbon hover:border-tomate',
              ].join(' ')}
            >
              {on && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
              {extra.label}
              {uniform == null && <span className="opacity-70">+{price(extra.price)}</span>}
            </button>
          )
        })}
      </div>

      {/* Resumen de lo elegido en todos los grupos: se puede quitar desde aquí */}
      {lg && picked.length > 0 && (
        <p className="mt-3 flex flex-wrap items-center gap-1.5 text-sm">
          <span className="font-semibold text-carbon/70">Llevas:</span>
          {picked.map((e) => (
            <button key={e.id} type="button" onClick={() => onToggle(e.id)} className="rounded-md bg-queso px-2 py-0.5 font-semibold text-carbon hover:line-through" aria-label={`Quitar ${e.label}`}>
              + {e.label} ×
            </button>
          ))}
        </p>
      )}
    </div>
  )
}
