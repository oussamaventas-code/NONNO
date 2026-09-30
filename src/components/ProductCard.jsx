import { Plus, Leaf, Flame as FlameIcon } from 'lucide-react'
import { price } from '../lib/format'
import { priceOf, isSoldOut, missingIngredients } from '../data/menu'
import { useStore } from '../store/StoreContext'
import ProductImage from './ProductImage'

/**
 * Tarjeta de producto enmarcada: foto arriba, nombre, ingredientes,
 * precio y botón +. Toda la carta usa la misma, para que se lea
 * rápido y sin sorpresas.
 */
export default function ProductCard({ product, onOpen }) {
  const { locationId } = useStore()
  const soldOut = isSoldOut(product.id, locationId)
  const missing = missingIngredients(product.id, locationId)
  const halfPortion = product.portions?.find((p) => p.id === 'media')

  return (
    <article className="product-card group frame h-full">
      <div className="frame-in flex flex-col">
      <button
        onClick={() => onOpen(product.id)}
        className="relative aspect-[4/3] overflow-hidden bg-tomate/10 border-b border-tomate"
        aria-label={`Ver ${product.name}`}
      >
        <ProductImage
          image={product.image}
          category={product.category}
          alt={product.name}
          widths={[400, 600, 800, 1200]}
          sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 90vw"
          className="h-full w-full transition-transform duration-700 ease-magnetic group-hover:scale-105"
        />
        {soldOut && (
          <span className="absolute inset-0 flex items-center justify-center bg-forno/55">
            <span className="rounded-md bg-masa text-tomate font-sans font-extrabold uppercase tracking-wider text-sm px-3 py-1.5">{missing.length ? `Sin ${missing[0]}` : 'Agotado hoy'}</span>
          </span>
        )}
        {product.badge && (
          <span className="absolute top-2 left-2 rounded-md bg-tomate text-masa font-sans font-bold uppercase tracking-wider text-[0.65rem] px-2 py-1">
            {product.badge}
          </span>
        )}
      </button>
      <div className="flex flex-col flex-1 px-4 pt-4 pb-4">
        <h3 className="font-display font-extrabold text-xl text-forno flex items-center gap-1.5">
          {product.name}
          {product.vegetarian && <Leaf className="w-4 h-4 text-albahaca flex-shrink-0" strokeWidth={2} />}
          {product.spicy && <FlameIcon className="w-4 h-4 text-tomate flex-shrink-0" strokeWidth={2} />}
        </h3>
        <p className="mt-1 text-sm text-forno/65 line-clamp-2 flex-1">{product.description}</p>
        <div className="mt-4 flex items-end justify-between gap-3">
          <p className="font-display font-extrabold text-2xl text-tomate leading-none">
            {price(priceOf(product))}
            {halfPortion && <span className="block mt-1 font-sans font-semibold text-xs text-forno/55">½ ración {price(halfPortion.price)}</span>}
          </p>
          <button
            onClick={() => onOpen(product.id)}
            disabled={soldOut}
            className="btn bg-tomate w-11 h-11 !min-h-0 !px-0 flex-shrink-0 disabled:opacity-40 disabled:pointer-events-none"
            aria-label={soldOut ? `${product.name}: agotado` : `Añadir ${product.name}`}
          >
            <span className="btn-layer bg-forno" />
            <span className="btn-label"><Plus className="w-5 h-5" strokeWidth={2.5} /></span>
          </button>
        </div>
      </div>
      </div>
    </article>
  )
}
