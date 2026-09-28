import { useRef, useState } from 'react'
import { Star } from 'lucide-react'
import { CATEGORIES, PICKUP_DEALS, productsByCategory } from '../data/menu'
import { MENU_INTRO, CATEGORY_BLURBS } from '../data/content'
import { price } from '../lib/format'
import { useActions } from '../store/StoreContext'
import ProductCard from './ProductCard'
import { useGSAP, STAGGER, onEnter, revealFrom } from '../lib/motion'

/**
 * La carta. Titular serif centrado, pestañas de texto con estrella en
 * la activa, un párrafo por categoría y la cuadrícula de tarjetas.
 */
export default function Menu() {
  const [active, setActive] = useState(CATEGORIES[0].id)
  const { openProduct } = useActions()
  const rootRef = useRef(null)
  const gridRef = useRef(null)

  const products = productsByCategory(active)
  const deal = PICKUP_DEALS.find((d) => d.category === active)

  useGSAP(() => {
    revealFrom('.menu-heading', {
      y: 40,
      opacity: 0,
      duration: 0.9,
      ease: 'power3.out',
      scrollTrigger: onEnter(rootRef.current, 'top 75%'),
    })
  }, { scope: rootRef })

  useGSAP(() => {
    revealFrom('.product-card', {
      y: 30,
      opacity: 0,
      stagger: STAGGER.cards,
      duration: 0.7,
      ease: 'power3.out',
    })
  }, { dependencies: [active], scope: gridRef })

  return (
    <section id="menu" ref={rootRef} className="bg-masa pt-16 sm:pt-20 pb-24 sm:pb-32">
      <div className="shell">
        <h1 className="menu-heading text-center font-display font-bold text-tomate text-[clamp(2.5rem,4.45vw,4rem)] leading-none">
          La carta
        </h1>
        <p className="menu-heading mt-6 mx-auto max-w-2xl text-center font-sans font-medium text-lg text-tomate">
          {MENU_INTRO} Toca un plato para personalizarlo y añadirlo a tu pedido.
        </p>

        {/* Pestañas: sticky bajo la cabecera */}
        <div className="sticky top-0 z-30 mt-10 -mx-5 sm:mx-0 px-5 py-3 bg-masa/95 backdrop-blur-sm">
          <div className="hide-scrollbar flex sm:justify-center gap-6 sm:gap-10 overflow-x-auto">
            {CATEGORIES.map((cat) => {
              const on = active === cat.id
              return (
                <button
                  key={cat.id}
                  onClick={() => setActive(cat.id)}
                  aria-pressed={on}
                  className={[
                    'flex-shrink-0 inline-flex items-center gap-1.5 py-2 font-sans font-bold uppercase tracking-[0.12em] text-[0.8rem] transition-colors border-b-2',
                    on ? 'text-tomate border-tomate' : 'text-tomate/45 border-transparent hover:text-tomate/80',
                  ].join(' ')}
                >
                  {on && <Star className="w-3.5 h-3.5 fill-tomate" strokeWidth={0} />}
                  {cat.label}
                </button>
              )
            })}
          </div>
        </div>

        {CATEGORY_BLURBS[active] && (
          <p className="mt-6 mx-auto max-w-2xl text-center font-sans font-medium text-tomate/90 leading-relaxed">
            {CATEGORY_BLURBS[active]}
          </p>
        )}

        {deal && (
          <div className="frame mt-10 mx-auto max-w-3xl">
          <div className="frame-in p-5 sm:p-7 text-center">
            <p className="font-display font-extrabold text-2xl text-tomate">
              Llévatelas por <em className="italic">menos</em>
            </p>
            <p className="mt-1 font-sans text-sm text-tomate/75">Solo para recoger en el local · se aplica sola al hacer el pedido</p>
            <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-4">
              {deal.packs.map((p) => (
                <div key={p.qty} className="rounded-lg border-2 border-dashed border-tomate/50 px-2 py-3">
                  <p className="font-display font-extrabold text-lg min-[400px]:text-xl sm:text-3xl text-forno">{price(p.price)}</p>
                  <p className="font-sans font-bold uppercase tracking-wider text-[0.7rem] text-tomate mt-1">{p.qty} {deal.label}</p>
                </div>
              ))}
            </div>
          </div>
          </div>
        )}

        <div
          ref={gridRef}
          key={active}
          className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8"
        >
          {products.map((p) => (
            <ProductCard key={p.id} product={p} onOpen={openProduct} />
          ))}
        </div>
      </div>
    </section>
  )
}
