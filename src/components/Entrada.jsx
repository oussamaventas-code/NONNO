import { navigate } from '../lib/router'
import { PHOTO, img, srcSet } from '../data/images'

/**
 * PANTALLA 1 — ENTRADA. Las dos sedes de fondo, el cartel de Nonno
 * (la chica y la pizza, recortadas) por encima y el botón de pedir.
 * Sin scroll, sin navegación: una puerta de entrada al pedido.
 */
export default function Entrada() {
  return (
    <section className="relative isolate overflow-hidden bg-masa min-h-[calc(100svh-3.5rem)] flex flex-col items-center justify-center text-center px-3 py-4 sm:py-6">
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
      <div className="absolute inset-0 -z-10 bg-masa/70" aria-hidden="true" />
      {/* Mezcla en la unión de las dos fotos: sin línea dura */}
      <div className="absolute -z-10 inset-x-0 top-1/2 h-40 -translate-y-1/2 bg-gradient-to-b from-transparent via-masa/90 to-transparent lg:inset-y-0 lg:inset-x-auto lg:left-1/2 lg:h-auto lg:w-48 lg:-translate-x-1/2 lg:translate-y-0 lg:bg-gradient-to-r" aria-hidden="true" />

      {/* El recorte se ajusta al alto libre (PC) o al ancho (móvil) y deja sitio al botón */}
      <img
        src="/fotos/pizzas/nonno-recorte-1000.webp"
        srcSet="/fotos/pizzas/nonno-recorte-520.webp 520w, /fotos/pizzas/nonno-recorte-1000.webp 1000w"
        sizes="(min-width: 640px) 560px, 88vw"
        alt="La Pizza de Nonno: la pizza más orgánica de Murcia"
        width="1000"
        height="965"
        fetchPriority="high"
        className="h-auto w-[min(92vw,36rem,calc((100svh-14rem)*1.035))] drop-shadow-[0_10px_30px_rgba(0,0,0,0.7)]"
      />
      <button onClick={() => navigate('/pedir')} className="btn-retro mt-5 sm:mt-7">
        <span className="w-[16rem] sm:w-[18rem] !h-16 !text-3xl">PEDIR</span>
      </button>
    </section>
  )
}
