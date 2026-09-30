import Grain from './components/Grain'
import Navbar from './components/Navbar'
import MobileNav from './components/MobileNav'
import Entrada from './components/Entrada'
import ElegirPedido from './components/ElegirPedido'
import Menu from './components/Menu'
import Footer from './components/Footer'

import CartDrawer from './components/CartDrawer'
import ProductModal from './components/ProductModal'
import LocationPrompt from './components/LocationPrompt'
import Checkout from './components/Checkout'
import StickyOrderBar from './components/StickyOrderBar'
import Toasts from './components/Toasts'
import AccountDrawer from './components/AccountDrawer'
import OrderTracking from './components/OrderTracking'
import { useEffect } from 'react'
import { useStore } from './store/StoreContext'
import { usePath, navigate } from './lib/router'
import { useMenuOverrides } from './hooks/useMenuOverrides'

/**
 * Flujo de pedido en tres pantallas, con la misma cabecera y carrito:
 *   "/"       ENTRADA          nombre, una frase y PEDIR.
 *   "/pedir"  ELECCIÓN         sede y recoger / entrega.
 *   "/carta"  MENÚ             categorías, productos, añadir y carrito.
 *   "/p/…"    seguimiento del pedido.
 * Los sistemas globales (carrito, modal, checkout, avisos) viven
 * fuera del flujo de scroll y se muestran/ocultan según el estado.
 */
export default function App() {
  const path = usePath()
  const { locationId } = useStore()
  const enFlujo = path === '/' || path === '/pedir'

  /* La carta necesita sede: sin ella se pasa antes por la elección */
  useEffect(() => {
    if (path === '/carta' && !locationId) navigate('/pedir')
  }, [path, locationId])
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
        ) : path === '/pedir' ? (
          <ElegirPedido />
        ) : (
          <Entrada />
        )}
      </main>

      {!enFlujo && <Footer />}

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
