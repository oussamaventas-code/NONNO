import { useCallback, useRef, useState } from 'react'
import { ChevronsLeftRight } from 'lucide-react'
import { BEFORE_AFTER } from '../data/content'
import { img } from '../data/images'
import { gsap, useGSAP, onEnter , revealFrom } from '../lib/motion'

/**
 * "ANTES DE NONNO" vs "DESPUÉS DE NONNO" con divisor arrastrable.
 * Puntero (mouse + touch), sin dependencias externas.
 */
export default function BeforeAfter() {
  const [split, setSplit] = useState(50)
  const containerRef = useRef(null)
  const rootRef = useRef(null)
  const dragging = useRef(false)

  useGSAP(() => {
    revealFrom('.ba-in', {
      y: 30,
      opacity: 0,
      stagger: 0.1,
      duration: 0.8,
      ease: 'power3.out',
      scrollTrigger: onEnter(rootRef.current, 'top 78%'),
    })
  }, { scope: rootRef })

  const updateFromClientX = useCallback((clientX) => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const pct = ((clientX - rect.left) / rect.width) * 100
    setSplit(Math.min(96, Math.max(4, pct)))
  }, [])

  const onPointerDown = (e) => {
    dragging.current = true
    e.currentTarget.setPointerCapture?.(e.pointerId)
    updateFromClientX(e.clientX)
  }
  const onPointerMove = (e) => {
    if (!dragging.current) return
    updateFromClientX(e.clientX)
  }
  const onPointerUp = () => { dragging.current = false }

  const onKeyDown = (e) => {
    if (e.key === 'ArrowLeft') setSplit((s) => Math.max(4, s - 4))
    if (e.key === 'ArrowRight') setSplit((s) => Math.min(96, s + 4))
  }

  return (
    <section ref={rootRef} className="section bg-masa">
      <div className="shell">
        <div className="ba-in max-w-2xl mx-auto text-center mb-10">
          <p className="mono text-tomate mb-4">EL ANTES Y EL DESPUÉS</p>
          <h2 className="font-sans font-extrabold uppercase text-display-sm text-carbon leading-[0.95]">
            {BEFORE_AFTER.before.title.replace('.', '')} <span className="text-carbon/25">/</span>{' '}
            <em className="font-serif italic font-semibold text-tomate ">{BEFORE_AFTER.after.title}</em>
          </h2>
        </div>

        <div
          ref={containerRef}
          className="ba-in relative mx-auto max-w-3xl aspect-[16/10] sm:aspect-[16/8] rounded-block overflow-hidden select-none shadow-float touch-none"
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          {/* Después (base) */}
          <div className="absolute inset-0">
            <img src={img(BEFORE_AFTER.after.image, 1200, 72)} alt={BEFORE_AFTER.after.alt} className="h-full w-full object-cover" loading="lazy" />
            <div className="absolute inset-0 bg-gradient-to-t from-forno/70 via-transparent to-transparent" />
            <div className="absolute bottom-5 right-5 text-right text-luz">
              <span className="text-3xl">{BEFORE_AFTER.after.emoji}</span>
              <p className="font-serif italic font-semibold text-xl mt-1">{BEFORE_AFTER.after.text}</p>
            </div>
          </div>

          {/* Antes (recortado por el split) */}
          <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}>
            <img src={img(BEFORE_AFTER.before.image, 1200, 72)} alt={BEFORE_AFTER.before.alt} className="h-full w-full object-cover grayscale" loading="lazy" />
            <div className="absolute inset-0 bg-forno/40" />
            <div className="absolute bottom-5 left-5 text-luz">
              <span className="text-3xl">{BEFORE_AFTER.before.emoji}</span>
              <p className="font-serif italic font-semibold text-xl mt-1">{BEFORE_AFTER.before.text}</p>
            </div>
          </div>

          {/* Divisor */}
          <div className="absolute inset-y-0 pointer-events-none" style={{ left: `${split}%` }}>
            <div className="absolute inset-y-0 -translate-x-1/2 w-0.5 bg-crema/80" />
          </div>
          <button
            role="slider"
            aria-label="Comparar antes y después de Nonno"
            aria-valuenow={Math.round(split)}
            aria-valuemin={4}
            aria-valuemax={96}
            onKeyDown={onKeyDown}
            onPointerDown={onPointerDown}
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-12 h-12 rounded-full bg-crema text-carbon flex items-center justify-center shadow-float cursor-grab active:cursor-grabbing"
            style={{ left: `${split}%` }}
          >
            <ChevronsLeftRight className="w-5 h-5" strokeWidth={2} />
          </button>
        </div>
      </div>
    </section>
  )
}
