import { useState } from 'react'
import { VALUES } from '../data/content'

/* Forma de cada sello: óvalo relleno, círculo con filete y placa inclinada */
const STAMP = [
  'rounded-[50%] bg-forno text-queso w-60 h-36 -rotate-[8deg] border border-forno outline outline-1 outline-offset-[-7px] outline-queso',
  'rounded-full border border-forno text-forno w-40 h-40 outline outline-1 outline-offset-[-7px] outline-forno',
  'rounded-[1.75rem] border border-forno text-forno w-60 h-32 rotate-[14deg] outline outline-1 outline-offset-[-7px] outline-forno',
]

/**
 * Valores de la casa sobre amarillo queso: titular, un recuadro de
 * línea doble con el texto y tres sellos alrededor. Tocar un sello
 * cambia el titular y el texto.
 */
export default function Values() {
  const [activeId, setActiveId] = useState(VALUES[0].id)
  const active = VALUES.find((v) => v.id === activeId)

  return (
    <section className="bg-queso py-24 sm:py-40">
      <div className="px-5 text-center text-forno">
        <h2 className="font-sans font-bold leading-[2.2] text-2xl">
          <span className="block uppercase">{active.kicker}</span>
          <span className="block text-[3.25rem] leading-none">{active.title}</span>
        </h2>

        <div className="mt-12 mx-auto max-w-[80rem] grid lg:grid-cols-[1fr_31rem_1fr] gap-12 items-center">
          <div className="flex lg:flex-col items-center justify-center gap-8 lg:gap-14 flex-wrap order-1">
            {VALUES.slice(0, 2).map((v, i) => (
              <Stamp key={v.id} value={v} shape={STAMP[i]} on={v.id === activeId} onClick={() => setActiveId(v.id)} />
            ))}
          </div>

          <div className="frame-navy order-3 lg:order-2 mx-auto w-full max-w-[31rem]">
            <div className="frame-in flex items-center justify-center min-h-[28rem] px-8 sm:px-12 py-10" aria-live="polite">
              <p className="font-sans font-medium text-lg leading-[1.3]">{active.text}</p>
            </div>
          </div>

          <div className="flex items-center justify-center order-2 lg:order-3">
            <Stamp value={VALUES[2]} shape={STAMP[2]} on={VALUES[2].id === activeId} onClick={() => setActiveId(VALUES[2].id)} />
          </div>
        </div>
      </div>
    </section>
  )
}

function Stamp({ value, shape, on, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={[
        'inline-flex flex-col items-center justify-center leading-none transition-transform duration-300 ease-magnetic hover:scale-105',
        shape,
        on ? 'scale-105' : 'opacity-90',
      ].join(' ')}
    >
      <span className="font-sans font-bold uppercase text-[0.7rem] tracking-wide">{value.kicker}</span>
      <span className="font-display font-bold text-3xl mt-1">{value.title}</span>
    </button>
  )
}
