import { useEffect, useRef, useState } from 'react'
import { Pizza, Flame, Milk, Package } from 'lucide-react'
import { KITCHEN_FEED } from '../data/content'
import { clock } from '../lib/format'
import { gsap, useGSAP } from '../lib/motion'

const ICONS = { pizza: Pizza, flame: Flame, cheese: Milk, box: Package }

/**
 * "EL HORNO NO PARA." Simulación visual de notificaciones de cocina.
 * Nunca se presentan como pedidos reales en tiempo real.
 */
export default function KitchenFeed() {
  const [items, setItems] = useState(() => [{ ...KITCHEN_FEED[0], id: 0, at: clock() }])
  const listRef = useRef(null)
  const counter = useRef(1)

  useEffect(() => {
    const timer = setInterval(() => {
      const next = KITCHEN_FEED[counter.current % KITCHEN_FEED.length]
      setItems((prev) => [...prev, { ...next, id: counter.current, at: clock() }].slice(-3))
      counter.current += 1
    }, 2500)
    return () => clearInterval(timer)
  }, [])

  useGSAP(() => {
    gsap.from('.kitchen-ticket:last-child', { x: 24, opacity: 0, duration: 0.5, ease: 'power2.out' })
  }, { dependencies: [items.length], scope: listRef })

  return (
    <section className="py-16 sm:py-20 bg-carbon text-crema overflow-hidden">
      <div className="shell grid lg:grid-cols-2 gap-10 items-center">
        <div>
          <p className="mono text-horno mb-4">VISUAL EXPERIENCE</p>
          <h2 className="font-sans font-extrabold uppercase text-display-sm leading-[0.95]">
            EL HORNO<br /><em className="font-serif italic font-semibold not-italic text-horno">NO PARA.</em>
          </h2>
          <p className="mt-5 max-w-sm text-crema/55">
            Una simulación visual de lo que pasa en cocina. No son pedidos en tiempo real.
          </p>
        </div>

        <div ref={listRef} className="flex flex-col gap-3 min-h-[13rem] justify-end">
          {items.map((item) => {
            const Icon = ICONS[item.icon] || Flame
            return (
              <div key={item.id} className="kitchen-ticket ticket bg-crema text-carbon flex items-center gap-3 pl-4 pr-5 py-3 max-w-md ml-auto">
                <span className="w-8 h-8 rounded-full bg-tomate/10 text-tomate flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4" strokeWidth={1.75} />
                </span>
                <p className="flex-1 text-sm normal-case">{item.text}</p>
                <span className="mono text-carbon/35 flex-shrink-0">{item.at}</span>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
