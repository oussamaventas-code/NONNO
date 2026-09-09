import { useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { FAQ } from '../data/faq'
import { gsap, useGSAP, onEnter , revealFrom } from '../lib/motion'

/**
 * Acordeón de preguntas frecuentes. Altura animada con GSAP
 * (power2.inOut), icono + que rota a × al abrir.
 */
export default function Faq() {
  const [openId, setOpenId] = useState(null)
  const rootRef = useRef(null)
  const bodyRefs = useRef({})
  const iconRefs = useRef({})

  useGSAP(() => {
    revealFrom('.faq-item', {
      y: 24,
      opacity: 0,
      stagger: 0.08,
      duration: 0.7,
      ease: 'power3.out',
      scrollTrigger: onEnter(rootRef.current, 'top 78%'),
    })
  }, { scope: rootRef })

  const toggle = (id) => {
    const isOpening = openId !== id
    const prevId = openId
    setOpenId(isOpening ? id : null)

    if (prevId && prevId !== id && bodyRefs.current[prevId]) {
      gsap.to(bodyRefs.current[prevId], { height: 0, duration: 0.4, ease: 'power2.inOut' })
      gsap.to(iconRefs.current[prevId], { rotate: 0, duration: 0.3 })
    }

    const body = bodyRefs.current[id]
    const icon = iconRefs.current[id]
    if (!body) return

    if (isOpening) {
      gsap.set(body, { height: 'auto' })
      const h = body.offsetHeight
      gsap.fromTo(body, { height: 0 }, { height: h, duration: 0.45, ease: 'power2.inOut' })
      gsap.to(icon, { rotate: 45, duration: 0.3 })
    } else {
      gsap.to(body, { height: 0, duration: 0.4, ease: 'power2.inOut' })
      gsap.to(icon, { rotate: 0, duration: 0.3 })
    }
  }

  return (
    <section className="section bg-masa">
      <div className="shell max-w-3xl mx-auto" ref={rootRef}>
        <p className="mono text-tomate mb-4 text-center">PREGUNTAS FRECUENTES</p>
        <h2 className="font-sans font-extrabold uppercase text-display-sm text-carbon leading-[0.95] text-center">
          ¿ALGUNA <em className="font-serif italic font-semibold text-tomate ">DUDA</em>?
        </h2>

        <div className="mt-12 flex flex-col divide-y divide-carbon/10 border-t border-b border-carbon/10">
          {FAQ.map((item) => {
            const open = openId === item.id
            return (
              <div key={item.id} className="faq-item">
                <button
                  onClick={() => toggle(item.id)}
                  aria-expanded={open}
                  className="w-full flex items-center justify-between gap-4 py-5 sm:py-6 text-left"
                >
                  <span className="font-sans font-bold text-base sm:text-lg text-carbon">{item.q}</span>
                  <span
                    ref={(el) => (iconRefs.current[item.id] = el)}
                    className="flex-shrink-0 w-9 h-9 rounded-full border border-carbon/15 flex items-center justify-center text-carbon"
                  >
                    <Plus className="w-4 h-4" strokeWidth={2} />
                  </span>
                </button>
                <div
                  ref={(el) => (bodyRefs.current[item.id] = el)}
                  className="overflow-hidden"
                  style={{ height: 0 }}
                >
                  <p className="pb-6 text-carbon/60 max-w-2xl">{item.a}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
