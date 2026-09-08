import { useRef } from 'react'
import { FINAL_CTA } from '../data/content'
import { useActions } from '../store/StoreContext'
import { gsap, useGSAP, onEnter } from '../lib/motion'

/**
 * CTA final a toda pantalla. Fondo rojo tomate, titular enorme,
 * botón gigante. El último empujón antes del footer.
 */
export default function FinalCta() {
  const rootRef = useRef(null)
  const { openCart } = useActions()

  useGSAP(() => {
    gsap.from('.cta-in', {
      y: 40,
      opacity: 0,
      stagger: 0.1,
      duration: 0.9,
      ease: 'power3.out',
      scrollTrigger: onEnter(rootRef.current, 'top 78%'),
    })
  }, { scope: rootRef })

  const scrollToMenu = () => {
    document.getElementById('menu')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <section ref={rootRef} className="section bg-tomate text-crema text-center overflow-hidden">
      <div className="shell">
        <h2 className="cta-in font-sans font-extrabold uppercase text-display-lg leading-[0.86]">
          {FINAL_CTA.line1}<br />{FINAL_CTA.line2}
        </h2>
        <p className="cta-in mt-2 font-serif italic font-semibold text-display-sm text-forno/90">
          {FINAL_CTA.serif}
        </p>

        {/* El botón es inline-flex y más alto que su caja de línea:
            sin este contenedor de bloque, el texto siguiente se le monta encima. */}
        <div className="cta-in mt-10 flex justify-center">
          <button
            onClick={scrollToMenu}
            className="btn bg-forno text-crema px-10 sm:px-14 py-4 sm:py-5 text-base sm:text-lg min-h-[56px]"
          >
            <span className="btn-layer bg-carbon" />
            <span className="btn-label">🍕 {FINAL_CTA.cta}</span>
          </button>
        </div>

        <p className="cta-in mono normal-case mt-6 text-crema/70">{FINAL_CTA.foot}</p>
      </div>
    </section>
  )
}
