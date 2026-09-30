import { SITE } from '../data/site'
import { HERO } from '../data/content'
import { navigate } from '../lib/router'
import { PHOTO, img, srcSet } from '../data/images'

/**
 * PANTALLA 1 — ENTRADA. Solo dice qué es Nonno y lleva a pedir.
 * Sin scroll, sin navegación: una puerta de entrada al pedido.
 */
export default function Entrada() {
  return (
    <section className="relative isolate overflow-hidden bg-masa min-h-[calc(100svh-3.5rem)] flex flex-col items-center justify-center text-center px-5 py-10">
      {/* Fachada del local de fondo, oscurecida para que el texto se lea */}
      <img
        src={img(PHOTO.venueSangonera, 1200)}
        srcSet={srcSet(PHOTO.venueSangonera)}
        sizes="100vw"
        alt=""
        fetchPriority="high"
        className="absolute inset-0 -z-20 h-full w-full object-cover object-[50%_15%]"
      />
      <div className="absolute inset-0 -z-10 bg-masa/70" aria-hidden="true" />
      <img
        src="/logo-nonno.png"
        alt="La Pizza de Nonno"
        width="160"
        height="160"
        className="h-32 w-32 sm:h-40 sm:w-40 rounded-full object-cover border border-tomate"
      />
      <h1 className="mt-6 font-display font-bold text-tomate text-[clamp(3rem,14vw,6rem)] leading-none">
        {SITE.brand.line2}
      </h1>
      <p className="mt-4 font-sans font-medium text-tomate text-lg sm:text-xl leading-snug">
        {HERO.line1}
        <span className="block font-semibold uppercase">{HERO.line2}</span>
      </p>
      <button onClick={() => navigate('/pedir')} className="btn-retro mt-10">
        <span className="w-[16rem] sm:w-[18rem] !h-16 !text-3xl">PEDIR</span>
      </button>
    </section>
  )
}
