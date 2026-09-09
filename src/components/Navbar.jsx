import { useRef } from 'react'
import { ShoppingBag, Menu as MenuIcon } from 'lucide-react'
import { NAV_LINKS, SITE } from '../data/site'
import { useActions, useCart } from '../store/StoreContext'
import { useScrolled } from '../hooks/useScrolled'
import { gsap, useGSAP, EASE, revealFrom, guard } from '../lib/motion'

/**
 * Navbar "isla flotante": nunca ocupa todo el ancho, fixed y centrada.
 * Transparente sobre el hero; crema + blur al cruzar el umbral de scroll.
 */
export default function Navbar() {
  const scrolled = useScrolled(72)
  const { lines, count, subtotal } = useCart()
  const { openCart, toggleMobileNav } = useActions()
  const rootRef = useRef(null)

  useGSAP(() => {
    revealFrom(rootRef.current, { y: -24, opacity: 0, duration: 0.9, ease: EASE.in, delay: 0.15 })
  }, { scope: rootRef })

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <header
      ref={rootRef}
      className="fixed inset-x-0 top-3 sm:top-5 z-[90] flex justify-center px-3"
    >
      <div
        className={[
          'flex w-full max-w-5xl items-center justify-between gap-3 rounded-full',
          'px-4 sm:px-5 py-2.5 transition-all duration-500 ease-magnetic',
          scrolled
            ? 'bg-crema/90 shadow-island backdrop-blur-xl border border-carbon/10'
            : 'bg-transparent border border-crema/0',
        ].join(' ')}
      >
        {/* Logo */}
        <button
          onClick={() => scrollTo('inicio')}
          className={[
            'flex flex-col leading-[0.95] text-left font-sans font-extrabold uppercase tracking-tight transition-colors',
            'text-[0.7rem] sm:text-xs',
            scrolled ? 'text-carbon' : 'text-crema',
          ].join(' ')}
          aria-label="Ir al inicio — La Pizza de Nonno"
        >
          <span>{SITE.brand.line1}</span>
          <span className="serif text-base sm:text-lg not-italic font-normal">
            <em className="font-serif italic font-semibold">{SITE.brand.line2}</em>
          </span>
        </button>

        {/* Enlaces (desktop) */}
        <nav
          className={[
            'hidden lg:flex items-center gap-7 font-sans text-[0.78rem] font-semibold uppercase tracking-wide transition-colors',
            scrolled ? 'text-carbon/80' : 'text-crema/90',
          ].join(' ')}
          aria-label="Navegación principal"
        >
          {NAV_LINKS.map((link) => (
            <button
              key={link.id}
              onClick={() => scrollTo(link.id)}
              className="relative py-1 transition-colors hover:text-tomate focus-visible:text-tomate"
            >
              {link.label}
            </button>
          ))}
        </nav>

        {/* Derecha: carrito + menú móvil */}
        <div className="flex items-center gap-2">
          <button
            onClick={openCart}
            className={[
              'btn bg-tomate text-crema px-4 sm:px-5 py-2.5 min-h-[40px] sm:min-h-[44px] text-[0.7rem] sm:text-[0.78rem]',
            ].join(' ')}
            aria-label={`Pedir ahora${count > 0 ? `, ${count} producto${count > 1 ? 's' : ''} en el carrito` : ''}`}
          >
            <span className="btn-layer bg-horno" />
            <span className="btn-label">
              <ShoppingBag className="w-4 h-4" strokeWidth={2} />
              <span className="hidden sm:inline">PEDIR AHORA</span>
              {count > 0 && (
                <span className="mono normal-case tracking-normal">
                  · {count}
                </span>
              )}
            </span>
          </button>

          <button
            onClick={() => toggleMobileNav(true)}
            className={[
              'lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-full border transition-colors',
              scrolled ? 'border-carbon/15 text-carbon' : 'border-crema/30 text-crema',
            ].join(' ')}
            aria-label="Abrir menú de navegación"
          >
            <MenuIcon className="w-5 h-5" strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </header>
  )
}
