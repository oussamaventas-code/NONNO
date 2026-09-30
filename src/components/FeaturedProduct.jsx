import { useRef } from 'react'
import { Star, Plus } from 'lucide-react'
import { featuredProduct, priceOf } from '../data/menu'
import { img, srcSet } from '../data/images'
import { price } from '../lib/format'
import { useActions } from '../store/StoreContext'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { gsap, useGSAP, EASE, onEnter , revealFrom } from '../lib/motion'

/**
 * Producto destacado a pantalla casi completa. Rotación de la imagen
 * apenas perceptible (0.6°) — el peso está en la quietud, no en el giro.
 */
export default function FeaturedProduct() {
  const product = featuredProduct()
  const { openProduct } = useActions()
  const rootRef = useRef(null)
  const reduced = useReducedMotion()

  useGSAP(() => {
    revealFrom('.featured-in', {
      y: 40,
      opacity: 0,
      stagger: 0.1,
      duration: 0.9,
      ease: EASE.in,
      scrollTrigger: onEnter(rootRef.current, 'top 70%'),
    })

    if (!reduced) {
      gsap.to('.featured-image', {
        rotate: 0.6,
        duration: 6,
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true,
      })
    }
  }, { scope: rootRef })

  return (
    <section ref={rootRef} className="section bg-forno text-luz overflow-hidden">
      <div className="shell grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        <div className="featured-in order-2 lg:order-1">
          <p className="mono text-horno mb-4">★ {product.badge || 'FAVORITA'}</p>
          <h2 className="font-sans font-extrabold uppercase text-display-sm leading-[0.95]">
            LA FAVORITA<br />
            <em className="font-serif italic font-semibold text-horno ">DEL NONNO.</em>
          </h2>
          <p className="mt-6 max-w-md text-luz/65 text-base sm:text-lg">{product.description}</p>

          <div className="mt-6 flex flex-wrap gap-2">
            {product.ingredients.map((ing) => (
              <span key={ing} className="mono normal-case rounded-full border border-luz/15 px-3 py-1.5 text-luz/60">
                {ing}
              </span>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-4 sm:gap-6">
            <p className="font-serif italic font-semibold text-3xl text-luz">
              {price(priceOf(product))}
            </p>
            <button
              onClick={() => openProduct(product.id)}
              className="btn bg-tomate text-forno px-6 w-full sm:w-auto"
            >
              <span className="btn-layer bg-horno" />
              <span className="btn-label"><Plus className="w-4 h-4" strokeWidth={2.5} /> AÑADIR AL PEDIDO</span>
            </button>
          </div>
        </div>

        <div className="featured-in order-1 lg:order-2 relative">
          <div className="featured-image relative aspect-square rounded-block overflow-hidden shadow-ember will-change-transform">
            <img
              src={img(product.image, 1100, 76)}
              srcSet={srcSet(product.image, [600, 900, 1300])}
              sizes="(min-width: 1024px) 45vw, 90vw"
              alt={product.name}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          </div>
          <span className="absolute -top-3 -right-3 sm:top-4 sm:right-4 mono normal-case flex items-center gap-1.5 rounded-full bg-crema text-carbon px-4 py-2 shadow-float">
            <Star className="w-3.5 h-3.5 fill-tomate text-neon" /> FAVORITA
          </span>
        </div>
      </div>
    </section>
  )
}
