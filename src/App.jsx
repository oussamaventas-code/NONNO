import Grain from './components/Grain'
import Navbar from './components/Navbar'
import MobileNav from './components/MobileNav'
import Hero from './components/Hero'
import LocationSelector from './components/LocationSelector'
import Metrics from './components/Metrics'
import Menu from './components/Menu'
import FeaturedProduct from './components/FeaturedProduct'
import Experience from './components/Experience'
import KitchenFeed from './components/KitchenFeed'
import KitchenDashboard from './components/KitchenDashboard'
import BeforeAfter from './components/BeforeAfter'
import Process from './components/Process'
import Editorial from './components/Editorial'
import Faq from './components/Faq'
import FinalCta from './components/FinalCta'
import Footer from './components/Footer'

import CartDrawer from './components/CartDrawer'
import ProductModal from './components/ProductModal'
import LocationPrompt from './components/LocationPrompt'
import Checkout from './components/Checkout'
import StickyOrderBar from './components/StickyOrderBar'
import Toasts from './components/Toasts'

/**
 * Orden exacto de la experiencia:
 * Navbar → Hero → Sedes → Métricas → Menú → Destacado → Experiencia
 * → micro-UIs → Proceso → Editorial → FAQ → CTA final → Footer.
 * Los sistemas globales (carrito, modal, checkout, avisos) viven
 * fuera del flujo de scroll y se muestran/ocultan según el estado.
 */
export default function App() {
  return (
    <>
      <Grain />
      <Navbar />
      <MobileNav />

      <main>
        <Hero />
        <LocationSelector />
        <Metrics />
        <Menu />
        <FeaturedProduct />
        <Experience />
        <KitchenFeed />
        <KitchenDashboard />
        <BeforeAfter />
        <Process />
        <Editorial />
        <Faq />
        <FinalCta />
      </main>

      <Footer />

      <StickyOrderBar />
      <CartDrawer />
      <ProductModal />
      <LocationPrompt />
      <Checkout />
      <Toasts />
    </>
  )
}
