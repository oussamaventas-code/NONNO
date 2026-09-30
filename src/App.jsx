import Grain from './components/Grain'
import Navbar from './components/Navbar'
import MobileNav from './components/MobileNav'
import Hero from './components/Hero'
import MenuShowcase from './components/MenuShowcase'
import DealsBand from './components/DealsBand'
import Menu from './components/Menu'
import Story from './components/Story'
import Values from './components/Values'
import LocationSelector from './components/LocationSelector'
import Footer from './components/Footer'

import CartDrawer from './components/CartDrawer'
import ProductModal from './components/ProductModal'
import LocationPrompt from './components/LocationPrompt'
import Checkout from './components/Checkout'
import StickyOrderBar from './components/StickyOrderBar'
import Toasts from './components/Toasts'
import AccountDrawer from './components/AccountDrawer'
import OrderTracking from './components/OrderTracking'
import { usePath } from './lib/router'
import { useMenuOverrides } from './hooks/useMenuOverrides'

/**
 * Dos páginas con la misma cabecera y el mismo footer:
 *   "/"      landing (estructura de diner): Hero → Escaparate de la
 *            carta → Ofertas → Historia → Valores → Pedido en las sedes.
 *   "/carta" la carta completa con el pedido online.
 * Los sistemas globales (carrito, modal, checkout, avisos) viven
 * fuera del flujo de scroll y se muestran/ocultan según el estado.
 */
export default function App() {
  const path = usePath()
  /* Precios, ocultos y agotados que la dirección cambia desde el panel */
  useMenuOverrides()

  return (
    <>
      <Grain />
      <Navbar />
      <MobileNav />

      <main>
        {path.startsWith('/p/') ? (
          <OrderTracking token={decodeURIComponent(path.slice(3))} />
        ) : path === '/carta' ? (
          <Menu />
        ) : (
          <>
            <Hero />
            <MenuShowcase />
            <DealsBand />
            <Story />
            <Values />
            <div className="double-rule border-forno bg-masa" aria-hidden="true" />
            <LocationSelector />
          </>
        )}
      </main>

      <Footer />

      <StickyOrderBar />
      <CartDrawer />
      <ProductModal />
      <LocationPrompt />
      <Checkout />
      <AccountDrawer />
      <Toasts />
    </>
  )
}
