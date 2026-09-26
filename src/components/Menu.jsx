import { useRef, useState } from 'react'
import { CATEGORIES, PICKUP_DEALS, productsByCategory } from '../data/menu'
import { price } from '../lib/format'
import { useActions } from '../store/StoreContext'
import ProductCard from './ProductCard'
import { gsap, useGSAP, STAGGER, onEnter , revealFrom } from '../lib/motion'

/**
 * Núcleo del producto. Tabs sticky por categoría + grid editorial
 * que alterna layouts. Cambiar de categoría reanima la entrada.
 */
export default function Menu() {
  const [active, setActive] = useState(CATEGORIES[0].id)
  const { openProduct } = useActions()
  const rootRef = useRef(null)
  const gridRef = useRef(null)

  const products = productsByCategory(active)
  const deal = PICKUP_DEALS.find((d) => d.category === active)

  useGSAP(() => {
    revealFrom('.menu-heading-line', {
      y: 50,
      opacity: 0,
      stagger: STAGGER.text,
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
    <section id="menu" ref={rootRef} className="section bg-masa">
      <div className="shell">
        <div className="max-w-2xl">
          <p className="mono text-tomate mb-4">EL MENÚ</p>
          <h2 className="font-sans font-extrabold uppercase text-display-sm text-carbon leading-[0.95]">
            <span className="menu-heading-line block">EL MENÚ</span>
            <span className="menu-heading-line block">
              QUE NO <em className="font-serif italic font-semibold text-tomate ">NECESITA</em>
            </span>
            <span className="menu-heading-line block">PRESENTACIÓN.</span>
          </h2>
          <p className="mt-5 text-carbon/60 text-base sm:text-lg">Bueno, quizá un poco.</p>
        </div>

        {/* Tabs sticky */}
        <div className="sticky top-[4.5rem] sm:top-20 z-30 mt-10 -mx-5 sm:mx-0 px-5 sm:px-0 py-3 bg-masa/90 backdrop-blur-md">
          <div className="hide-scrollbar flex gap-2 overflow-x-auto fade-edges-x">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActive(cat.id)}
                className={[
                  'flex-shrink-0 rounded-full px-5 py-2.5 min-h-[44px] font-sans font-bold uppercase text-[0.78rem] tracking-wide transition-all duration-300 ease-magnetic border',
                  active === cat.id
                    ? 'bg-carbon text-crema border-carbon'
                    : 'bg-transparent text-carbon/60 border-carbon/15 hover:border-carbon/40',
                ].join(' ')}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {deal && (
          <div className="mt-8 rounded-card bg-carbon text-crema p-5 sm:p-6">
            <p className="font-sans font-extrabold uppercase text-lg">
              Llévatelas por <em className="font-serif italic font-semibold text-horno">menos</em>
            </p>
            <p className="mono normal-case text-crema/60 mt-1">Solo para recoger en el local · se aplica sola al hacer el pedido</p>
            <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
              {deal.packs.map((p) => (
                <div key={p.qty} className="rounded-2xl border border-dashed border-crema/25 px-3 py-3 text-center">
                  <p className="font-serif italic font-semibold text-2xl sm:text-3xl text-horno">{price(p.price)}</p>
                  <p className="mono normal-case text-crema/70 mt-1">{p.qty} {deal.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Grid editorial */}
        <div
          ref={gridRef}
          key={active}
          className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6"
        >
          {products.map((p) => (
            <ProductCard key={p.id} product={p} onOpen={openProduct} />
          ))}
        </div>
      </div>
    </section>
  )
}
