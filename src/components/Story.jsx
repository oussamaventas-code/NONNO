import { useRef } from 'react'
import { STORY, ILLUSTRATIONS } from '../data/content'
import { useGSAP, onEnter, revealFrom } from '../lib/motion'
import Illustration from './Illustration'

/** Nube de dibujo animado, en amarillo queso con contorno azul. */
function Cloud({ className = '' }) {
  return (
    <svg viewBox="0 0 120 60" className={className} aria-hidden="true">
      <path
        d="M18 50c-9 0-14-6-12-13 2-6 8-8 13-7 1-9 9-15 18-13 4-9 16-12 25-6 5-6 16-6 21 1 9-2 17 4 17 12 7 1 11 7 9 13-1 5-6 8-11 8H18z"
        fill="rgb(var(--c-queso))"
        stroke="rgb(var(--c-forno))"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * "Nuestra historia": bloque azul noche con el borde superior curvo,
 * nubes flotando y la ilustración del Nonno apoyada en el suelo.
 */
export default function Story() {
  const rootRef = useRef(null)

  useGSAP(() => {
    revealFrom('.story-in', {
      y: 30,
      opacity: 0,
      stagger: 0.12,
      duration: 0.9,
      ease: 'power3.out',
      scrollTrigger: onEnter(rootRef.current, 'top 70%'),
    })
  }, { scope: rootRef })

  return (
    <section id="historia" ref={rootRef}>
      <div className="relative bg-forno text-queso overflow-hidden">
        {/* Goterones de salsa: continúan la franja roja de las ofertas */}
        <svg viewBox="0 0 1440 90" preserveAspectRatio="none" className="absolute top-0 inset-x-0 w-full h-12 sm:h-20" aria-hidden="true">
          <path
            fill="rgb(var(--c-tomate))"
            d="M0,0H1440V22c-22,0-30,14-30,30s-14,24-26,24-26-10-26-26-12-26-34-28c-40-4-58,6-96,6s-42-8-70-8-30,22-30,40-12,26-24,26-24-10-24-28-14-34-50-36c-44-2-70,8-120,8s-60-6-86-6-34,14-34,30-10,22-22,22-22-10-22-24-18-30-58-32c-48-2-66,4-104,4s-52-6-80-6-30,24-30,44-12,30-26,30-26-12-26-30-10-40-44-42c-38-2-62,6-100,6S250,20,222,20s-32,16-32,32-12,26-26,26-26-12-26-26S120,22,86,22C52,22,34,30,0,30Z"
          />
        </svg>
        <Cloud className="absolute top-44 left-[3%] w-24 sm:w-32" />
        <Cloud className="absolute top-60 right-[5%] w-28 sm:w-36" />
        <Cloud className="hidden sm:block absolute bottom-40 left-[14%] w-24" />
        <Cloud className="hidden sm:block absolute bottom-56 right-[15%] w-20" />

        <div className="relative px-5 pt-28 sm:pt-36 text-center">
          <h2 className="story-in font-display font-bold text-[clamp(2rem,3.6vw,3.25rem)] leading-none">
            · {STORY.title} ·
          </h2>
          <p className="story-in mx-auto mt-16 max-w-[68rem] font-display font-bold text-[clamp(1.4rem,2.9vw,2.625rem)] leading-none">
            {STORY.lines.map((l) => <span key={l} className="block">{l}</span>)}
          </p>

          <div className="story-in mt-10 flex justify-center">
            <Illustration
              src={ILLUSTRATIONS.story}
              alt="Ilustración del Nonno junto al horno de leña con una pizza recién hecha"
              className="w-full max-w-[26rem] h-auto -mb-1"
              fallbackClassName="w-56 h-56 sm:w-64 sm:h-64 mb-12"
            />
          </div>
        </div>
      </div>
      <div className="double-rule border-forno bg-queso" aria-hidden="true" />
    </section>
  )
}
