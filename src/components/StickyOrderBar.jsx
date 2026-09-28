import { ShoppingBag } from 'lucide-react'
import { useCart, useActions } from '../store/StoreContext'
import { price } from '../lib/format'

/**
 * Barra de pedido siempre accesible: móvil = barra inferior sticky,
 * desktop = botón flotante. Solo aparece con productos en el carrito.
 */
export default function StickyOrderBar() {
  const { count, subtotal, isEmpty } = useCart()
  const { openCart } = useActions()

  if (isEmpty) return null

  return (
    <>
      {/* Móvil: barra inferior */}
      <div className="sm:hidden fixed inset-x-0 bottom-0 z-[85] px-3 pb-3 pb-safe">
        <button
          onClick={openCart}
          className="w-full flex items-center justify-between rounded-full bg-panel text-luz px-5 py-3.5 min-h-[52px] shadow-float"
        >
          <span className="flex items-center gap-2 font-sans font-bold text-sm">
            <ShoppingBag className="w-4 h-4" strokeWidth={2} />
            TU PEDIDO · {count}
          </span>
          <span className="mono">{price(subtotal)}</span>
        </button>
      </div>

      {/* Desktop: botón flotante */}
      <button
        onClick={openCart}
        className="hidden sm:flex fixed bottom-8 right-8 z-[85] items-center gap-3 rounded-full bg-tomate text-forno pl-5 pr-6 py-3.5 min-h-[52px] shadow-ember hover:scale-105 transition-transform duration-300 ease-magnetic"
      >
        <ShoppingBag className="w-4 h-4" strokeWidth={2} />
        <span className="font-sans font-bold text-sm">TU PEDIDO · {count}</span>
        <span className="mono normal-case opacity-80">{price(subtotal)}</span>
      </button>
    </>
  )
}
