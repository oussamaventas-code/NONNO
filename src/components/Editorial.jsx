import { useRef } from 'react'
import { EDITORIAL } from '../data/content'
import { img, srcSet } from '../data/images'
import { gsap, useGSAP, onEnter } from '../lib/motion'

/**
 * Sección editorial de marca. "NO HACEMOS PIZZA RÁPIDA" / "HACEMOS
 * PIZZA QUE DESAPARECE RÁPIDO" animado palabra a palabra. Cada palabra
 * vive en su propio span enmascarado para poder animarla en Y sin
 * depender de plugins de pago (SplitText).
 */
function Word({ children, highlight }) {
  return (
    <span className="inline-block overflow-hidden align-top">
      <span
        className={[
          'editorial-word inline-block',
          highlight ? 'font-serif italic font-semibold text-tomate not-italic' : '',
        ].join(' ')}
      >
        {children}
      </span>
    </span>
  )
}

export default function Editorial() {
  const rootRef = useRef(null)

  useGSAP(() => {
    gsap.from('.editorial-image', {
      scale: 1.15,
      duration: 2,
      ease: 'power1.out',
      scrollTrigger: onEnter(rootRef.current, 'top 85%'),
    })

    gsap.from('.editorial-word', {
      yPercent: 110,
      opacity: 0,
      stagger: 0.05,
      duration: 0.6,
      ease: 'power3.out',
      scrollTrigger: onEnter(rootRef.current, 'top 60%'),
    })
  }, { scope: rootRef })

  return (
    <section ref={rootRef} className="relative section bg-forno text-crema overflow-hidden">
      <div className="absolute inset-0 editorial-image">
        <img
          src={img(EDITORIAL.image, 1920, 60)}
          srcSet={srcSet(EDITORIAL.image)}
          sizes="100vw"
          alt={EDITORIAL.alt}
          loading="lazy"
          className="h-full w-full object-cover"
        />
      </div>
      <div className="absolute inset-0 bg-forno/78" />

      <div className="shell relative text-center">
        <h2 className="font-sans font-extrabold uppercase text-display-md leading-[0.9]">
          {EDITORIAL.blockA.map((word, i) => (
            <span key={i}>
              <Word>{word}</Word>{' '}
            </span>
          ))}
        </h2>
        <h2 className="mt-4 font-sans font-extrabold uppercase text-display-md leading-[0.9]">
          {EDITORIAL.blockB.map((word, i) => (
            <span key={i}>
              <Word highlight={word.replace('.', '') === EDITORIAL.highlight}>{word}</Word>{' '}
            </span>
          ))}
        </h2>
      </div>
    </section>
  )
}
