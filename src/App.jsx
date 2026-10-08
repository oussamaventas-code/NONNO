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
import NewPassword from './components/NewPassword'
import { lazy, Suspense, useEffect } from 'react'
import { useStore } from './store/StoreContext'
import { usePath, navigate } from './lib/router'
import { useMenuOverrides } from './hooks/useMenuOverrides'
import { useSiteContent } from './hooks/useSiteContent'

const AllergensPage = lazy(() => import('./components/AllergensPage'))
const PrivacyPage = lazy(() => import('./components/PrivacyPage'))
const TermsPage = lazy(() => import('./components/TermsPage'))
const CookieConsent = lazy(() => import('./components/CookieConsent'))
const NotFoundPage = lazy(() => import('./components/NotFoundPage'))

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
  useSiteContent()

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
        {/^\/p\/[^/]+$/.test(path) ? (
          <OrderTracking token={decodeURIComponent(path.slice(3))} />
        ) : path === '/cuenta/contrasena' ? (
          <NewPassword />
        ) : path === '/carta' ? (
          <Menu />
        ) : path === '/alergenos' ? (
          <Suspense fallback={<p className="mono py-16 text-center text-tomate">PREPARANDO LA GUÍA…</p>}><AllergensPage /></Suspense>
        ) : path === '/privacidad' ? (
          <Suspense fallback={<p className="mono py-16 text-center text-tomate">PREPARANDO LA GUÍA…</p>}><PrivacyPage /></Suspense>
        ) : path === '/terminos' ? (
          <Suspense fallback={<p className="mono py-16 text-center text-tomate">PREPARANDO LA GUÍA…</p>}><TermsPage /></Suspense>
        ) : path === '/pedir' ? (
          <ElegirPedido />
        ) : path === '/' ? (
          <Entrada />
        ) : (
          <Suspense fallback={<p className="mono py-16 text-center text-tomate">BUSCANDO UNA BUENA PORCIÓN…</p>}><NotFoundPage /></Suspense>
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
      <Suspense fallback={null}><CookieConsent /></Suspense>
    </>
  )
}
