import { Plus, Leaf, Flame as FlameIcon } from 'lucide-react'
import { price } from '../lib/format'
import { priceOf } from '../data/menu'
import ProductImage from './ProductImage'

/**
 * Tarjeta de producto: foto a la izquierda, nombre, descripción,
 * precio y botón + a la derecha. Toda la carta usa la misma, para
 * que se lea rápido y sin sorpresas.
 */
export default function ProductCard({ product, onOpen }) {
  const halfPortion = product.portions?.find((p) => p.id === 'media')

  return (
    <article className="product-card group grid grid-cols-[7rem_1fr] sm:grid-cols-[11rem_1fr] gap-4 sm:gap-6 items-center bg-crema rounded-card overflow-hidden shadow-island p-3 sm:p-4 h-full">
      <button
        onClick={() => onOpen(product.id)}
        className="relative aspect-square rounded-2xl overflow-hidden"
        aria-label={`Ver ${product.name}`}
      >
        <ProductImage
          image={product.image}
          category={product.category}
          alt={product.name}
          widths={[300, 500, 700]}
          sizes="176px"
          className="h-full w-full transition-transform duration-700 ease-magnetic group-hover:scale-105"
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
        <p className="mt-1 text-sm text-carbon/50 line-clamp-3">{product.description}</p>
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="mono text-carbon/70">
            {price(priceOf(product))}
            {halfPortion && <span className="block text-carbon/45">½ ración {price(halfPortion.price)}</span>}
          </p>
          <button
            onClick={() => onOpen(product.id)}
            className="btn bg-tomate text-crema w-10 h-10 !min-h-0 !px-0 rounded-full flex-shrink-0"
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
