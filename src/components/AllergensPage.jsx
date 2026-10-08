import { ArrowLeft, Wheat } from 'lucide-react'
import { ALLERGENS } from '../data/siteContent'
import { useSiteContent } from '../hooks/useSiteContent'
import { navigate } from '../lib/router'

export default function AllergensPage() {
  const content = useSiteContent()
  const allergens = content.allergens?.length ? content.allergens : ALLERGENS

  return (
    <main className="shell min-h-[60vh] py-10 sm:py-16">
      <button onClick={() => navigate('/carta')} className="inline-flex min-h-11 items-center gap-2 text-xs font-bold uppercase tracking-wider text-tomate">
        <ArrowLeft className="h-4 w-4" /> Volver a la carta
      </button>
      <header className="mx-auto mt-8 max-w-3xl text-center">
        <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full border-2 border-tomate bg-crema text-tomate">
          <Wheat className="h-7 w-7" />
        </span>
        <p className="mono mt-4 text-tomate">Información de Nonno</p>
        <h1 className="mt-2 font-display text-4xl font-extrabold text-tomate sm:text-5xl">Alérgenos</h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-carbon/75">
          Consulta la presencia habitual de alérgenos y los ingredientes donde pueden aparecer.
        </p>
      </header>

      <div className="mx-auto mt-9 grid max-w-5xl gap-3 sm:grid-cols-2">
        {allergens.map((item, index) => (
          <article key={item.id} className="pframe bg-crema">
            <div className="pframe-in flex h-full items-start gap-4 p-4 sm:p-5">
              <span className="font-display text-3xl font-bold italic text-tomate/40">{String(index + 1).padStart(2, '0')}</span>
              <div>
                <h2 className="font-sans text-lg font-extrabold uppercase text-tomate">{item.name}</h2>
                <p className="mono mt-1 text-carbon/65">{item.presence}</p>
                <p className="mt-2 text-sm leading-relaxed text-carbon/75">{item.details}</p>
              </div>
            </div>
          </article>
        ))}
      </div>

      <aside className="mx-auto mt-6 max-w-5xl rounded-lg border border-horno/70 bg-queso/60 p-4 text-sm leading-relaxed text-carbon">
        Esta guía resume la presencia indicada en la carta. Las recetas pueden cambiar y puede haber contacto cruzado en cocina. Si tienes una alergia, consulta con la sede antes de hacer el pedido; el equipo confirmará la información del producto y sus trazas.
      </aside>
    </main>
  )
}
