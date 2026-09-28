import { useRef, useState } from 'react'
import { Star } from 'lucide-react'
import { PRODUCTS, priceOf } from '../data/menu'
import { price } from '../lib/format'
import { MENU_INTRO, SHOWCASE_TABS } from '../data/content'
import { useActions } from '../store/StoreContext'
import { navigate } from '../lib/router'
import { useGSAP, onEnter, revealFrom } from '../lib/motion'
import ProductImage from './ProductImage'

/**
 * Escaparate de la carta en la landing: titular, pestañas de texto
 * con estrella, párrafos de la categoría y un carrusel infinito de
 * fotos enmarcadas. Tocar una foto abre el producto para pedirlo;
 * la carta completa está en /carta.
 */
export default function MenuShowcase() {
  const [tabId, setTabId] = useState(SHOWCASE_TABS[0].id)
  const { openProduct } = useActions()
  const rootRef = useRef(null)

  const tab = SHOWCASE_TABS.find((t) => t.id === tabId)
  const products = PRODUCTS.filter((p) => tab.categories.includes(p.category) && p.image)
  // Se repite la lista hasta llenar la pista; luego se duplica entera
  // para que el bucle (-50%) no tenga salto.
  const base = products.length ? Array.from({ length: Math.ceil(8 / products.length) }, () => products).flat() : []
  const track = [...base, ...base]

  useGSAP(() => {
    revealFrom('.showcase-in', {
      y: 40,
      opacity: 0,
      stagger: 0.12,
      duration: 0.9,
      ease: 'power3.out',
      scrollTrigger: onEnter(rootRef.current, 'top 75%'),
    })
  }, { scope: rootRef })

  return (
    <section id="menu" ref={rootRef} className="bg-masa pt-24 sm:pt-32 pb-28 sm:pb-32 overflow-hidden">
      <div className="px-5">
        <h2 className="showcase-in mx-auto max-w-[70rem] text-center font-display font-bold text-tomate text-[clamp(2rem,3.6vw,3.25rem)] leading-none">
          {MENU_INTRO}
        </h2>

        <div className="showcase-in mt-16 flex justify-center gap-10 sm:gap-16" role="tablist" aria-label="Categorías">
          {SHOWCASE_TABS.map((t) => {
            const on = t.id === tabId
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={on}
                onClick={() => setTabId(t.id)}
                className={[
                  'inline-flex items-center gap-2 font-sans font-medium uppercase text-lg sm:text-xl transition-colors',
                  on ? 'text-tomate' : 'text-tomate/70 hover:text-tomate',
                ].join(' ')}
              >
                {on && <Star className="w-4 h-4 fill-tomate" strokeWidth={0} />}
                {t.label}
              </button>
            )
          })}
        </div>

        <div className="showcase-in mx-auto mt-10 max-w-[46rem] text-center font-sans font-medium text-tomate flex flex-col gap-4">
          {tab.text.map((p) => <p key={p}>{p}</p>)}
        </div>
      </div>

      {/* Carrusel: se desliza solo y se para al pasar el ratón */}
      <div className="marquee mt-12 sm:mt-14 overflow-hidden">
        <ul key={tabId} className="animate-marquee flex w-max gap-5 sm:gap-10 px-2.5 sm:px-5 py-1" style={{ animationDuration: `${base.length * 5}s` }}>
          {track.map((p, i) => (
            <li key={`${p.id}-${i}`} aria-hidden={i >= base.length || undefined}>
              <button
                onClick={() => openProduct(p.id)}
                tabIndex={i >= base.length ? -1 : 0}
                className="frame block w-[16rem] sm:w-[27rem] aspect-square group"
                aria-label={`Ver ${p.name}`}
              >
                <span className="frame-in block">
                  <ProductImage
                    image={p.image}
                    category={p.category}
                    alt={p.name}
                    width={600}
                    widths={[400, 600, 900]}
                    sizes="(min-width: 640px) 27rem, 16rem"
                    className="h-full w-full transition-transform duration-700 ease-magnetic group-hover:scale-105"
                  />
                  {/* Pegatina de precio */}
                  <span className="absolute top-3 right-3 flex items-center justify-center w-[4.5rem] h-[4.5rem] sm:w-20 sm:h-20 rounded-full bg-queso border border-tomate outline outline-1 outline-offset-[-5px] outline-tomate rotate-12 font-display font-bold text-tomate text-base sm:text-lg leading-none shadow-[2px_2px_0_0_rgb(var(--c-tomate))]">
                    {price(priceOf(p))}
                  </span>
                  <span className="absolute left-2 bottom-2 rounded-md bg-masa/95 border border-tomate px-3 py-1.5 font-display italic font-bold text-tomate text-base sm:text-lg">
                    {p.name}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-20 sm:mt-24 flex flex-wrap justify-center gap-5 px-5">
        <button onClick={() => navigate('/carta')} className="btn-retro"><span className="min-w-[13.9rem]">Haz tu pedido</span></button>
        <button onClick={() => navigate('/carta')} className="btn-retro"><span className="min-w-[13.9rem]">Ver toda la carta</span></button>
      </div>
    </section>
  )
}
