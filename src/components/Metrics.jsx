import { useRef } from 'react'
import { METRICS } from '../data/content'
import { decimal } from '../lib/format'
import { gsap, useGSAP, countTo, onEnter, revealFrom, ScrollTrigger } from '../lib/motion'

/**
 * Cuatro métricas sobre negro horno. Las dos primeras son datos
 * proporcionados; las dos últimas son de marca y se leen como tal.
 *
 * El HTML ya trae el número final: la animación solo lo cuenta desde
 * cero. Si el reloj de animación no llega a correr, se lee el dato
 * correcto igualmente.
 */
export default function Metrics() {
  const rootRef = useRef(null)

  useGSAP(() => {
    const items = gsap.utils.toArray('.metric-item')

    revealFrom(items, {
      y: 40,
      opacity: 0,
      stagger: 0.15,
      duration: 0.8,
      ease: 'power3.out',
      scrollTrigger: onEnter(rootRef.current, 'top 85%'),
    })

    items.forEach((item) => {
      const node = item.querySelector('.metric-value')
      const raw = item.dataset.value
      if (!raw || raw === 'null' || !node) return

      const value = Number(raw)
      const decimals = Number(item.dataset.decimals) || 0
      const suffix = item.dataset.suffix || ''

      ScrollTrigger.create({
        ...onEnter(item, 'top 85%'),
        onEnter: () => {
          node.textContent = '0' + suffix
          countTo(node, value, { decimals, suffix })
        },
      })
    })
  }, { scope: rootRef })

  return (
    <section ref={rootRef} className="section bg-forno text-luz overflow-hidden">
      <div className="shell">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-y-12 gap-x-6">
          {METRICS.map((m) => (
            <div
              key={m.id}
              className="metric-item text-center lg:text-left border-t border-luz/10 pt-6"
              data-value={m.value}
              data-decimals={m.decimals ?? 0}
              data-suffix={m.suffix ?? ''}
            >
              <p className="font-serif italic font-semibold text-[clamp(2.5rem,7vw,4.5rem)] leading-none text-horno">
                {m.display ?? (
                  <span className="metric-value">
                    {decimal(m.value, m.decimals ?? 0)}{m.suffix}
                  </span>
                )}
              </p>
              <p className="mono mt-3 text-luz/80">{m.label}</p>
              <p className="mono mt-1 text-luz/35">{m.note}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
