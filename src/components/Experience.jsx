import { useRef } from 'react'
import { EXPERIENCE } from '../data/content'
import { img, srcSet } from '../data/images'
import { gsap, useGSAP, revealImage, EASE, onEnter } from '../lib/motion'

/**
 * Tres pilares de calidad (masa, horno, ingredientes). Cada imagen
 * entra con un clip-path reveal — el peso "premium" del sistema.
 */
export default function Experience() {
  const rootRef = useRef(null)

  useGSAP(() => {
    gsap.from('.exp-heading', {
      y: 40,
      opacity: 0,
      duration: 0.9,
      ease: EASE.in,
      scrollTrigger: onEnter(rootRef.current, 'top 75%'),
    })

    gsap.utils.toArray('.exp-pillar').forEach((pillar, i) => {
      const wrap = pillar.querySelector('.exp-image-wrap')
      const image = pillar.querySelector('.exp-image')
      const tl = gsap.timeline({ scrollTrigger: onEnter(pillar, 'top 82%') })
      tl.add(revealImage(wrap, image))
      tl.from(pillar.querySelectorAll('.exp-text'), { y: 20, opacity: 0, stagger: 0.08, duration: 0.6 }, '-=0.5')
    })
  }, { scope: rootRef })

  return (
    <section id="experiencia" ref={rootRef} className="section bg-masa">
      <div className="shell">
        <div className="exp-heading max-w-2xl">
          <p className="mono text-tomate mb-4">LA EXPERIENCIA</p>
          <h2 className="font-sans font-extrabold uppercase text-display-sm text-carbon leading-[0.95]">
            {EXPERIENCE.title[0]}<br />
            <em className="font-serif italic font-semibold text-tomate ">{EXPERIENCE.title[1]}</em>
          </h2>
          <p className="mt-5 text-carbon/60 text-base sm:text-lg">{EXPERIENCE.text}</p>
        </div>

        <div className="mt-14 grid md:grid-cols-3 gap-8 lg:gap-10">
          {EXPERIENCE.pillars.map((p) => (
            <div key={p.id} className="exp-pillar">
              <div className="exp-image-wrap relative aspect-[4/5] rounded-card overflow-hidden clip-hidden shadow-island">
                <img
                  src={img(p.image, 700, 70)}
                  srcSet={srcSet(p.image, [400, 700, 1000])}
                  sizes="(min-width: 768px) 33vw, 90vw"
                  alt={p.alt}
                  loading="lazy"
                  className="exp-image h-full w-full object-cover"
                />
              </div>
              <p className="exp-text mono text-tomate mt-5">{p.label}</p>
              <p className="exp-text mt-2 text-carbon/60">{p.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
