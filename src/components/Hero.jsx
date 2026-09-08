import { useRef } from 'react'
import { Flame, ChevronDown } from 'lucide-react'
import { HERO } from '../data/content'
import { img, srcSet } from '../data/images'
import { gsap, useGSAP, EASE, DUR, STAGGER } from '../lib/motion'

/**
 * Hero 100dvh. Imagen full-screen + statement editorial en el tercio
 * inferior izquierdo. Todo el peso está en la carga: nada de rebote.
 */
export default function Hero() {
  const rootRef = useRef(null)

  useGSAP(() => {
    const tl = gsap.timeline({ defaults: { ease: EASE.in } })

    tl.fromTo('.hero-image', { scale: 1.12 }, { scale: 1, duration: DUR.cinematic * 1.6, ease: 'power1.out' }, 0)
      .from('.hero-navmask', { opacity: 0, duration: 0.6 }, 0)
      .from('.hero-badge', { opacity: 0, y: 12, stagger: 0.08, duration: 0.6 }, 0.3)
      .from('.hero-line', { y: 60, opacity: 0, stagger: STAGGER.text, duration: DUR.base }, 0.4)
      .from('.hero-sub', { y: 24, opacity: 0, duration: DUR.base }, '-=0.5')
      .from('.hero-cta', { y: 20, opacity: 0, stagger: 0.1, duration: 0.7 }, '-=0.6')
      .from('.hero-oven', { y: 30, opacity: 0, duration: DUR.base }, '-=0.5')
      .from('.hero-scroll', { opacity: 0, duration: 0.8 }, '-=0.3')
  }, { scope: rootRef })

  const scrollToMenu = () =>
    document.getElementById('menu')?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <section
      id="inicio"
      ref={rootRef}
      className="relative h-[100dvh] min-h-[640px] w-full overflow-hidden bg-forno text-crema"
    >
      {/* Fondo */}
      <div className="absolute inset-0 hero-image">
        <img
          src={img(HERO.image, 1920, 78)}
          srcSet={srcSet(HERO.image)}
          sizes="100vw"
          alt={HERO.alt}
          className="h-full w-full object-cover"
          fetchPriority="high"
        />
      </div>
      {/* Overlays: oscuro + gradiente inferior para legibilidad del texto */}
      <div className="absolute inset-0 bg-forno/35" />
      <div className="absolute inset-0 bg-gradient-to-t from-forno via-forno/35 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-forno/70 via-transparent to-transparent" />
      <div className="hero-navmask absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-forno/60 to-transparent" />

      {/* Contenido */}
      <div className="absolute inset-x-0 bottom-0 pb-24 sm:pb-20">
        <div className="shell grid lg:grid-cols-[1.6fr_1fr] gap-10 lg:gap-8 items-end">
          <div>
            {/* Badges */}
            <div className="flex flex-wrap gap-2 mb-5">
              {HERO.badges.map((b) => (
                <span
                  key={b}
                  className="hero-badge mono normal-case tracking-wide rounded-full border border-crema/25 bg-forno/30 backdrop-blur-sm px-3 py-1.5 flex items-center gap-1.5"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-horno animate-pulse-dot" />
                  {b}
                </span>
              ))}
            </div>

            {/* Sin unidades dvh en el tamaño: en móvil la barra del
                navegador aparece y desaparece al hacer scroll, y el
                titular cambiaría de tamaño a mitad de gesto. */}
            <h1 className="font-sans font-extrabold uppercase leading-[0.9] tracking-tight text-[clamp(2.5rem,8.5vw,6.5rem)] text-crema">
              <span className="block overflow-hidden"><span className="hero-line block">{HERO.line1}</span></span>
              <span className="block overflow-hidden"><span className="hero-line block">{HERO.line2}</span></span>
              <span className="block overflow-hidden">
                <span className="hero-line block">
                  {HERO.line3Pre}
                  <em className="font-serif italic font-semibold text-horno">{HERO.line3Serif}</em>
                  {HERO.line3Post}
                </span>
              </span>
            </h1>

            <p className="hero-sub mt-6 max-w-md text-base sm:text-lg text-crema/80 leading-snug">
              {HERO.sub}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button onClick={scrollToMenu} className="hero-cta btn bg-tomate text-crema px-7 sm:px-8">
                <span className="btn-layer bg-horno" />
                <span className="btn-label">🍕 {HERO.ctaPrimary}</span>
              </button>
              <button
                onClick={scrollToMenu}
                className="hero-cta group inline-flex items-center gap-2 text-crema/90 hover:text-horno transition-colors mono normal-case tracking-wide"
              >
                {HERO.ctaSecondary}
                <ChevronDown className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
              </button>
            </div>
          </div>

          {/* Micro-interfaz: estado del horno */}
          <div className="hero-oven ticket ml-auto w-full max-w-[15rem] px-5 py-4 shadow-float">
            <p className="mono text-carbon/50">{HERO.oven.title}</p>
            <p className="mt-2 flex items-center gap-2 text-[0.8rem] font-sans font-bold uppercase tracking-wide text-albahaca">
              <span className="w-2 h-2 rounded-full bg-albahaca animate-pulse-dot" />
              <Flame className="w-3.5 h-3.5" strokeWidth={2} />
              {HERO.oven.state}
            </p>
            <p className="mt-1 mono text-carbon/40">{HERO.oven.line}</p>
          </div>
        </div>
      </div>

      <div className="hero-scroll absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-crema/50">
        <span className="mono">SCROLL</span>
        <ChevronDown className="w-4 h-4 animate-bounce" style={{ animationDuration: '2s' }} />
      </div>
    </section>
  )
}
