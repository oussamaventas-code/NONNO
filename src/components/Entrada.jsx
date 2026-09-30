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
      {/* Fachadas de las dos sedes de fondo (una sobre otra en el móvil, lado a lado en pantallas grandes) */}
      <div className="absolute inset-0 -z-20 grid grid-rows-2 lg:grid-rows-1 lg:grid-cols-2" aria-hidden="true">
        {[PHOTO.venueSangonera, PHOTO.venueSantoAngel].map((photo, i) => (
          <img
            key={photo}
            src={img(photo, 1200)}
            srcSet={srcSet(photo)}
            sizes="(min-width: 1024px) 50vw, 100vw"
            alt=""
            fetchPriority={i === 0 ? 'high' : undefined}
            className="h-full w-full object-cover object-[50%_12%]"
          />
        ))}
      </div>
      <div className="absolute inset-0 -z-10 bg-masa/80" aria-hidden="true" />
      {/* Mezcla en la unión de las dos fotos: sin línea dura */}
      <div className="absolute -z-10 inset-x-0 top-1/2 h-40 -translate-y-1/2 bg-gradient-to-b from-transparent via-masa/90 to-transparent lg:inset-y-0 lg:inset-x-auto lg:left-1/2 lg:h-auto lg:w-48 lg:-translate-x-1/2 lg:translate-y-0 lg:bg-gradient-to-r" aria-hidden="true" />
      <h1 className="font-display font-bold text-tomate text-[clamp(3rem,14vw,6rem)] leading-none">
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
