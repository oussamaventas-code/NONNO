import { useRef } from 'react'
import { PROCESS } from '../data/content'
import { gsap, useGSAP, onEnter } from '../lib/motion'

/**
 * "DEL HORNO A TU MESA." Timeline horizontal en desktop, vertical en
 * móvil. La línea la dibuja GSAP vía stroke-dashoffset.
 */
export default function Process() {
  const rootRef = useRef(null)

  useGSAP(() => {
    gsap.from('.process-heading', {
      y: 40,
      opacity: 0,
      duration: 0.9,
      ease: 'power3.out',
      scrollTrigger: onEnter(rootRef.current, 'top 78%'),
    })

    const tl = gsap.timeline({ scrollTrigger: onEnter(rootRef.current, 'top 65%') })
    tl.fromTo('.process-line', { strokeDashoffset: 1000 }, { strokeDashoffset: 0, duration: 1.4, ease: 'power2.inOut' })
      .from('.process-node', { scale: 0, stagger: 0.25, duration: 0.5, ease: 'back.out(2)' }, '-=1.1')
      .from('.process-text', { y: 20, opacity: 0, stagger: 0.25, duration: 0.5 }, '-=1.1')
  }, { scope: rootRef })

  return (
    <section ref={rootRef} className="section bg-masa overflow-hidden">
      <div className="shell">
        <div className="process-heading max-w-xl">
          <p className="mono text-tomate mb-4">CÓMO FUNCIONA</p>
          <h2 className="font-sans font-extrabold uppercase text-display-sm text-carbon leading-[0.95]">
            DEL HORNO<br />
            <em className="font-serif italic font-semibold text-tomate not-italic">A TU MESA.</em>
          </h2>
        </div>

        {/* Desktop: horizontal */}
        <div className="hidden md:block mt-16 relative">
          <svg viewBox="0 0 1000 4" className="absolute top-6 left-0 w-full h-1 overflow-visible" preserveAspectRatio="none">
            <line x1="0" y1="2" x2="1000" y2="2" stroke="currentColor" strokeWidth="2" className="text-carbon/10" />
            <line
              x1="0" y1="2" x2="1000" y2="2" stroke="currentColor" strokeWidth="2"
              className="process-line text-tomate"
              strokeDasharray="1000" strokeDashoffset="1000"
            />
          </svg>
          <div className="relative grid grid-cols-3 gap-8">
            {PROCESS.map((step) => (
              <div key={step.id}>
                <span className="process-node relative z-10 flex items-center justify-center w-12 h-12 rounded-full bg-tomate text-crema font-serif italic font-semibold text-lg">
                  {step.id}
                </span>
                <p className="process-text mt-6 font-sans font-extrabold uppercase text-lg text-carbon">{step.title}</p>
                <p className="process-text mt-2 text-carbon/55 max-w-xs">{step.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Móvil: vertical */}
        <div className="md:hidden mt-12 relative pl-8">
          <svg width="4" className="absolute left-0 top-0 h-full" preserveAspectRatio="none">
            <line x1="2" y1="0" x2="2" y2="100%" stroke="currentColor" strokeWidth="2" className="text-carbon/10" />
            <line
              x1="2" y1="0" x2="2" y2="100%" stroke="currentColor" strokeWidth="2"
              className="process-line text-tomate"
              strokeDasharray="600" strokeDashoffset="600"
            />
          </svg>
          <div className="flex flex-col gap-10">
            {PROCESS.map((step) => (
              <div key={step.id} className="relative">
                <span className="process-node absolute -left-8 top-0 -translate-x-1/2 flex items-center justify-center w-9 h-9 rounded-full bg-tomate text-crema font-serif italic font-semibold text-sm">
                  {step.id}
                </span>
                <p className="process-text font-sans font-extrabold uppercase text-lg text-carbon">{step.title}</p>
                <p className="process-text mt-1 text-carbon/55">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
