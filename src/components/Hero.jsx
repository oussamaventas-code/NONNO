import { useRef } from 'react'
import { HERO, ILLUSTRATIONS, STAMP_TEXT } from '../data/content'
import { useGSAP, EASE, DUR, STAGGER, revealTimeline } from '../lib/motion'
import { navigate } from '../lib/router'
import Illustration from './Illustration'
import HeroMedia from './HeroMedia'
import Ticker, { SpinningStamp } from './Ticker'

/**
 * Hero: titular serif centrado y etiqueta de sedes; debajo, tres
 * columnas — vídeo pegado al borde izquierdo, texto + mascota + botón,
 * y vídeo pegado al borde derecho. Termina en la franja de cuadros.
 */
export default function Hero() {
  const rootRef = useRef(null)

  useGSAP(() => {
    /* Sin timeline (reducir movimiento activo) el hero se queda tal
       cual está en el HTML: visible. Nunca al revés. */
    const tl = revealTimeline({ defaults: { ease: EASE.in } })
    if (!tl) return

    tl.from('.hero-line', { y: 40, opacity: 0, stagger: STAGGER.text, duration: DUR.base }, 0.1)
      .from('.hero-tag', { opacity: 0, duration: 0.6 }, '-=0.4')
      .from('.hero-photo', { opacity: 0, duration: DUR.base }, '-=0.5')
      .from('.hero-center > *', { y: 20, opacity: 0, stagger: 0.1, duration: 0.7 }, '-=0.7')
  }, { scope: rootRef })

  return (
    <section id="inicio" ref={rootRef} className="bg-masa overflow-hidden">
      <div className="px-5 pt-10 sm:pt-11 text-center">
        <h1 className="font-display font-bold text-neon text-[clamp(2.25rem,4.45vw,4rem)] leading-none">
          <span className="hero-line block">{HERO.line1}</span>
          <span className="hero-line block">{HERO.line2}</span>
        </h1>
        <p className="hero-tag mt-12 font-sans font-semibold uppercase text-lg text-neon">{HERO.tag}</p>
      </div>

      <div className="mt-10 sm:mt-14 grid grid-cols-2 lg:grid-cols-[minmax(0,428px)_1fr_minmax(0,428px)] gap-y-10 gap-x-3 lg:gap-x-8 items-start">
        {/* Vídeo izquierdo: pegado al borde, solo redondeado por dentro */}
        <div className="hero-photo frame border-l-0 rounded-l-none pl-0 order-2 lg:order-1">
          <div className="frame-in border-l-0 rounded-l-none">
            <HeroMedia video={HERO.photoLeft.video} poster={HERO.photoLeft.poster} alt={HERO.photoLeft.alt} priority />
          </div>
        </div>

        {/* Centro */}
        <div className="hero-center col-span-2 lg:col-span-1 order-1 lg:order-2 flex flex-col items-center text-center px-5 lg:pt-8">
          <p className="font-sans font-medium text-neon text-lg leading-[1.3] max-w-[32rem]">{HERO.sub}</p>
          <div className="relative mt-8 w-[17rem] aspect-square">
            <SpinningStamp text={STAMP_TEXT} className="absolute -top-6 -right-12 sm:-right-16 w-24 h-24 z-10" />
            <Illustration
              src={ILLUSTRATIONS.mascot}
              alt="Nonno, la mascota de la pizzería: una porción de pizza con bigote y gorro de chef"
              className="w-full h-full object-contain"
              fallbackClassName="w-full h-full"
            />
          </div>
          <button onClick={() => navigate('/carta')} className="btn-retro mt-6">
            <span className="w-[15.5rem]">{HERO.cta}</span>
          </button>
        </div>

        {/* Vídeo derecho: pegado al borde */}
        <div className="hero-photo frame border-r-0 rounded-r-none pr-0 order-3">
          <div className="frame-in border-r-0 rounded-r-none">
            <HeroMedia video={HERO.photoRight.video} poster={HERO.photoRight.poster} alt={HERO.photoRight.alt} />
          </div>
        </div>
      </div>

      <div className="mt-20 sm:mt-[5.5rem]"><Ticker /></div>
    </section>
  )
}
