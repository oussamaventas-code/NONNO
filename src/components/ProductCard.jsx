import { Plus, Leaf, Flame as FlameIcon } from 'lucide-react'
import { img, srcSet } from '../data/images'
import { price } from '../lib/format'
import { priceFrom } from '../data/menu'

/**
 * Card editorial de producto. Tres variantes de layout (tall / circle /
 * wide) para romper la grid a propósito — no todas las pizzas son
 * iguales y la web no debería parecer que sí.
 */
export default function ProductCard({ product, onOpen }) {
  const layout = product.layout || 'tall'
  const from = priceFrom(product)
  const hasSizes = Boolean(product.sizes)

  if (layout === 'circle') {
    return (
      <article className="product-card group flex flex-col items-center text-center">
        <button
          onClick={() => onOpen(product.id)}
          className="relative w-full max-w-[15rem] aspect-square rounded-full overflow-hidden shadow-island"
          aria-label={`Ver ${product.name}`}
        >
          <img
            src={img(product.image, 500, 68)}
            srcSet={srcSet(product.image, [300, 500, 700])}
            sizes="300px"
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-700 ease-magnetic group-hover:scale-105"
          />
          {product.badge && (
            <span className="absolute top-3 left-1/2 -translate-x-1/2 mono normal-case rounded-full bg-tomate text-crema px-3 py-1">
              {product.badge}
            </span>
          )}
        </button>
        <div className="mt-5">
          <h3 className="font-sans font-bold uppercase text-base text-carbon flex items-center justify-center gap-1.5">
            {product.name}
            {product.vegetarian && <Leaf className="w-3.5 h-3.5 text-albahaca" strokeWidth={2} />}
            {product.spicy && <FlameIcon className="w-3.5 h-3.5 text-tomate" strokeWidth={2} />}
          </h3>
          <p className="mt-1 text-sm text-carbon/50 line-clamp-1">{product.description}</p>
          <button
            onClick={() => onOpen(product.id)}
            className="btn mt-3 bg-carbon text-crema w-11 h-11 !min-h-0 !px-0 rounded-full mx-auto"
            aria-label={`Añadir ${product.name}`}
          >
            <span className="btn-layer bg-tomate" />
            <span className="btn-label"><Plus className="w-4 h-4" strokeWidth={2.5} /></span>
          </button>
          <p className="mono mt-2 text-carbon/60">{hasSizes && 'DESDE '}{price(from)}</p>
        </div>
      </article>
    )
  }

  if (layout === 'wide') {
    return (
      <article className="product-card group grid grid-cols-[8.5rem_1fr] sm:grid-cols-[11rem_1fr] gap-4 sm:gap-6 items-center bg-crema rounded-card overflow-hidden shadow-island p-3 sm:p-4">
        <button
          onClick={() => onOpen(product.id)}
          className="relative aspect-square rounded-2xl overflow-hidden"
          aria-label={`Ver ${product.name}`}
        >
          <img
            src={img(product.image, 500, 68)}
            srcSet={srcSet(product.image, [300, 500, 700])}
            sizes="176px"
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-700 ease-magnetic group-hover:scale-105"
          />
        </button>
        <div className="pr-2 sm:pr-4">
          {product.badge && (
            <span className="mono normal-case text-tomate">{product.badge}</span>
          )}
          <h3 className="font-sans font-bold uppercase text-base sm:text-lg text-carbon flex items-center gap-1.5 mt-0.5">
            {product.name}
            {product.vegetarian && <Leaf className="w-3.5 h-3.5 text-albahaca flex-shrink-0" strokeWidth={2} />}
            {product.spicy && <FlameIcon className="w-3.5 h-3.5 text-tomate flex-shrink-0" strokeWidth={2} />}
          </h3>
          <p className="mt-1 text-sm text-carbon/50 line-clamp-2">{product.description}</p>
          <div className="mt-3 flex items-center justify-between">
            <p className="mono text-carbon/70">{hasSizes && 'DESDE '}{price(from)}</p>
            <button
              onClick={() => onOpen(product.id)}
              className="btn bg-tomate text-crema w-10 h-10 !min-h-0 !px-0 rounded-full"
              aria-label={`Añadir ${product.name}`}
            >
              <span className="btn-layer bg-horno" />
              <span className="btn-label"><Plus className="w-4 h-4" strokeWidth={2.5} /></span>
            </button>
          </div>
        </div>
      </article>
    )
  }

  /* layout tall (por defecto) */
  return (
    <article className="product-card group flex flex-col">
      <button
        onClick={() => onOpen(product.id)}
        className="relative aspect-[4/5] rounded-card overflow-hidden shadow-island"
        aria-label={`Ver ${product.name}`}
      >
        <img
          src={img(product.image, 700, 70)}
          srcSet={srcSet(product.image, [400, 700, 1000])}
          sizes="(min-width: 1024px) 25vw, 50vw"
          alt={product.name}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-700 ease-magnetic group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-carbon/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        {product.badge && (
          <span className="absolute top-3 left-3 mono normal-case rounded-full bg-tomate text-crema px-3 py-1">
            {product.badge}
          </span>
        )}
        <span className="absolute bottom-3 right-3 w-10 h-10 rounded-full bg-crema text-carbon flex items-center justify-center opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 ease-magnetic">
          <Plus className="w-4 h-4" strokeWidth={2.5} />
        </span>
      </button>
      <div className="mt-4 flex-1">
        <h3 className="font-sans font-bold uppercase text-base text-carbon flex items-center gap-1.5">
          {product.name}
          {product.vegetarian && <Leaf className="w-3.5 h-3.5 text-albahaca" strokeWidth={2} />}
          {product.spicy && <FlameIcon className="w-3.5 h-3.5 text-tomate" strokeWidth={2} />}
        </h3>
        <p className="mt-1 text-sm text-carbon/50 line-clamp-2">{product.description}</p>
      </div>
      <p className="mono mt-2 text-carbon/60">{hasSizes && 'DESDE '}{price(from)}</p>
    </article>
  )
}
