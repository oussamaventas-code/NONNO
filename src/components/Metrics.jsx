import { useRef } from 'react'
import { METRICS } from '../data/content'
import { gsap, useGSAP, countTo, onEnter } from '../lib/motion'

/**
 * Cuatro métricas sobre negro horno. Las dos primeras son datos
 * proporcionados; las dos últimas son de marca y se leen como tal.
 */
export default function Metrics() {
  const rootRef = useRef(null)

  useGSAP(() => {
    const items = gsap.utils.toArray('.metric-item')

    gsap.from(items, {
      y: 40,
      opacity: 0,
      stagger: 0.15,
      duration: 0.8,
      ease: 'power3.out',
      scrollTrigger: onEnter(rootRef.current, 'top 75%'),
    })

    items.forEach((item) => {
      const valueNode = item.querySelector('.metric-value')
      const raw = item.dataset.value
      if (raw === null || raw === 'null' || !valueNode) return
      gsap.set(valueNode, { textContent: '0' })
      ScrollTriggerCount(item, valueNode, Number(raw), Number(item.dataset.decimals), item.dataset.suffix || '')
    })

    function ScrollTriggerCount(trigger, node, value, decimals, suffix) {
      gsap.timeline({ scrollTrigger: onEnter(trigger, 'top 75%') }).add(() => {
        countTo(node, value, { decimals, suffix })
      })
    }
  }, { scope: rootRef })

  return (
    <section ref={rootRef} className="section bg-forno text-crema overflow-hidden">
      <div className="shell">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-y-12 gap-x-6">
          {METRICS.map((m) => (
            <div
              key={m.id}
              className="metric-item text-center lg:text-left border-t border-crema/10 pt-6"
              data-value={m.value}
              data-decimals={m.decimals ?? 0}
              data-suffix={m.suffix ?? ''}
            >
              <p className="font-serif italic font-semibold text-[clamp(2.5rem,7vw,4.5rem)] leading-none text-horno">
                {m.display ?? <span className="metric-value">0{m.suffix}</span>}
              </p>
              <p className="mono mt-3 text-crema/80">{m.label}</p>
              <p className="mono mt-1 text-crema/35">{m.note}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
