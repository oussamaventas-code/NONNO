import { useRef } from 'react'
import { KITCHEN_KPIS, KITCHEN_RHYTHM } from '../data/content'
import { gsap, useGSAP, onEnter } from '../lib/motion'

const R = 42
const CIRC = 2 * Math.PI * R

/**
 * Mini dashboard abstracto de marca ("HECHA CON RITMO. SERVIDA CON
 * FUEGO."). Etiquetado como VISUAL EXPERIENCE: no son métricas de negocio.
 */
export default function KitchenDashboard() {
  const rootRef = useRef(null)

  useGSAP(() => {
    gsap.from('.kpi-card', {
      y: 30,
      opacity: 0,
      stagger: 0.12,
      duration: 0.8,
      ease: 'power3.out',
      scrollTrigger: onEnter(rootRef.current, 'top 75%'),
    })

    gsap.utils.toArray('.kpi-ring').forEach((ring) => {
      const arc = Number(ring.dataset.arc) / 100
      gsap.fromTo(
        ring,
        { strokeDashoffset: CIRC },
        {
          strokeDashoffset: CIRC * (1 - arc),
          duration: 1.4,
          ease: 'power2.out',
          scrollTrigger: onEnter(ring, 'top 85%'),
        }
      )
    })

    gsap.from('.rhythm-bar', {
      scaleX: 0,
      transformOrigin: 'left center',
      stagger: 0.12,
      duration: 1,
      ease: 'power3.out',
      scrollTrigger: onEnter(rootRef.current, 'top 70%'),
    })
  }, { scope: rootRef })

  return (
    <section ref={rootRef} className="section bg-masa">
      <div className="shell">
        <div className="max-w-2xl">
          <p className="mono text-tomate mb-4">VISUAL EXPERIENCE</p>
          <h2 className="font-sans font-extrabold uppercase text-display-sm text-carbon leading-[0.95]">
            HECHA CON RITMO.<br />
            <em className="font-serif italic font-semibold text-tomate ">SERVIDA CON FUEGO.</em>
          </h2>
        </div>

        <div className="mt-12 grid sm:grid-cols-3 gap-6">
          {KITCHEN_KPIS.map((kpi) => (
            <div key={kpi.id} className="kpi-card bg-crema rounded-card p-6 sm:p-8 flex flex-col items-center text-center shadow-island">
              <div className="relative w-28 h-28">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle cx="50" cy="50" r={R} fill="none" stroke="currentColor" strokeWidth="6" className="text-carbon/8" />
                  <circle
                    cx="50" cy="50" r={R} fill="none" strokeWidth="6" strokeLinecap="round"
                    stroke="currentColor"
                    className="kpi-ring text-tomate"
                    data-arc={kpi.arc}
                    strokeDasharray={CIRC}
                    strokeDashoffset={CIRC}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="font-serif italic font-semibold text-2xl text-carbon">{kpi.value}</span>
                </div>
              </div>
              <p className="mono mt-4 text-carbon/70">{kpi.label}</p>
              <p className="mono mt-1 text-carbon/35">{kpi.caption}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 bg-carbon rounded-card p-6 sm:p-8">
          <div className="flex flex-col gap-5">
            {KITCHEN_RHYTHM.map((row) => (
              <div key={row.id}>
                <div className="flex items-center justify-between mb-2">
                  <span className="mono text-crema/60">{row.label}</span>
                  <span className="mono text-crema/30">{Math.round(row.level * 100)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-crema/10 overflow-hidden">
                  <div
                    className="rhythm-bar h-full rounded-full bg-horno"
                    style={{ width: `${row.level * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
