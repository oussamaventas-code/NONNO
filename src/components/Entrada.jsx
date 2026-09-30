import { navigate } from '../lib/router'

/**
 * PANTALLA 1 — ENTRADA. El cartel de Nonno y el botón de pedir.
 * Sin scroll, sin navegación: una puerta de entrada al pedido.
 * El cartel es cuadrado: se ajusta al alto que queda libre (PC) o al
 * ancho de la pantalla (móvil) para que el botón se vea siempre.
 */
export default function Entrada() {
  return (
    <section className="bg-masa min-h-[calc(100svh-3.5rem)] flex flex-col items-center justify-center text-center px-3 py-4 sm:py-6">
      <img
        src="/fotos/pizzas/nonno-cartel-1200.webp"
        srcSet="/fotos/pizzas/nonno-cartel-640.webp 640w, /fotos/pizzas/nonno-cartel-1200.webp 1200w"
        sizes="(min-width: 640px) 600px, 94vw"
        alt="La Pizza de Nonno: la pizza más orgánica de Murcia"
        width="1200"
        height="1200"
        fetchPriority="high"
        className="aspect-square rounded-lg object-cover w-[min(94vw,calc(100svh-14rem))] max-w-[40rem]"
      />
      <button onClick={() => navigate('/pedir')} className="btn-retro mt-5 sm:mt-7">
        <span className="w-[16rem] sm:w-[18rem] !h-16 !text-3xl">PEDIR</span>
      </button>
    </section>
  )
}
