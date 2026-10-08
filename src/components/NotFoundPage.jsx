import { useEffect } from 'react'
import { ArrowLeft, ArrowRight, Pizza } from 'lucide-react'
import { navigate } from '../lib/router'

export default function NotFoundPage() {
  useEffect(() => {
    const previousTitle = document.title
    document.title = '404 · La Pizza de Nonno'
    return () => { document.title = previousTitle }
  }, [])

  return (
    <main className="shell flex min-h-[62svh] items-center justify-center py-12 sm:py-16">
      <section className="grid w-full max-w-4xl items-center gap-8 md:grid-cols-[0.8fr_1.2fr] md:gap-12">
        <div className="relative mx-auto flex aspect-square w-full max-w-[18rem] items-center justify-center rounded-full border-2 border-tomate/70 bg-crema shadow-[0_0_32px_rgba(255,92,124,0.2)]">
          <div className="absolute inset-3 rounded-full border border-dashed border-tomate/35" aria-hidden="true" />
          <div className="text-center">
            <Pizza className="mx-auto h-14 w-14 text-tomate" strokeWidth={1.5} />
            <p className="mt-2 font-display text-7xl font-extrabold leading-none text-tomate">404</p>
            <p className="mono mt-2 text-carbon/60">FUERA DE CARTA</p>
          </div>
          <span className="absolute -right-1 top-8 h-3 w-3 rounded-full bg-forno shadow-[0_0_12px_rgba(72,190,255,0.8)]" aria-hidden="true" />
          <span className="absolute -bottom-1 left-12 h-2.5 w-2.5 rounded-full bg-tomate shadow-[0_0_12px_rgba(255,92,124,0.8)]" aria-hidden="true" />
        </div>

        <div className="text-center md:text-left">
          <p className="mono text-tomate">Ups, nos hemos perdido</p>
          <h1 className="mt-2 font-display text-4xl font-extrabold leading-tight text-tomate sm:text-5xl">
            Esta página no está en la carta.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-carbon/70 md:mx-0 sm:text-base">
            Puede que la dirección haya cambiado o que el enlace tenga un ingrediente de más. Vuelve al inicio o entra directamente a pedir.
          </p>

          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row md:justify-start">
            <button onClick={() => navigate('/carta')} className="btn-retro min-h-12">
              <span className="inline-flex items-center gap-2">Ver la carta <ArrowRight className="h-4 w-4" /></span>
            </button>
            <button onClick={() => navigate('/')} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-tomate/40 px-5 text-xs font-bold uppercase tracking-wide text-tomate transition-colors hover:bg-crema">
              <ArrowLeft className="h-4 w-4" /> Volver al inicio
            </button>
          </div>
        </div>
      </section>
    </main>
  )
}
