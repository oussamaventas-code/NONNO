import { useEffect, useState } from 'react'
import { Menu as MenuIcon, UserRound, MapPin, Flame } from 'lucide-react'
import { readLastOrder, LAST_ORDER_EVENT } from '../lib/lastOrder'
import { trackPath } from '../lib/tracking'
import { NAV_LINKS } from '../data/site'
import { ANNOUNCE } from '../data/content'
import { useCart, useActions, useSelectedLocation } from '../store/StoreContext'
import { useAccount } from '../store/AccountContext'
import { followLink, navigate, usePath } from '../lib/router'

/**
 * Cabecera de diner: barra de aviso, enlaces a la izquierda, logo en
 * el centro y el botón hexagonal "PIDE YA" a la derecha (abre el
 * carrito). No es fija: se va con el scroll, como en la referencia.
 */
export default function Navbar() {
  const { count } = useCart()
  const { openCart, toggleMobileNav, openLocationPrompt } = useActions()
  const { location } = useSelectedLocation()
  const path = usePath()

  /* Pedido en marcha desde este navegador: acceso directo a su seguimiento */
  const [lastOrder, setLastOrder] = useState(readLastOrder)
  useEffect(() => {
    const update = () => setLastOrder(readLastOrder())
    window.addEventListener(LAST_ORDER_EVENT, update)
    return () => window.removeEventListener(LAST_ORDER_EVENT, update)
  }, [])
  const showTrack = lastOrder && !path.startsWith('/p/')
  const { status, points, openAccount } = useAccount()

  return (
    <header className="relative z-[90] bg-masa">
      <p className="bg-tomate text-masa text-center font-sans font-medium uppercase text-[0.72rem] sm:text-sm h-9 leading-9 px-3 truncate">
        {ANNOUNCE}
      </p>

      <div className="border-b border-tomate">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center h-[4.5rem] sm:h-[5.9rem] px-4 sm:px-7">
          {/* Izquierda: enlaces (desktop) / menú (móvil) */}
          <nav className="hidden md:flex items-center" aria-label="Navegación principal">
            {NAV_LINKS.map((link) => (
              <button
                key={link.label}
                onClick={() => followLink(link)}
                className="w-[8.25rem] h-[3.4rem] text-left font-sans font-semibold uppercase text-base text-tomate hover:text-forno transition-colors"
              >
                {link.label}
              </button>
            ))}
          </nav>
          <button
            onClick={() => toggleMobileNav(true)}
            className="md:hidden justify-self-start inline-flex items-center justify-center w-11 h-11 text-tomate"
            aria-label="Abrir menú de navegación"
          >
            <MenuIcon className="w-7 h-7" strokeWidth={2} />
          </button>

          {/* Centro: logo */}
          <button onClick={() => navigate('/')} aria-label="Ir al inicio — La Pizza de Nonno">
            <img
              src="/logo-nonno.png"
              alt="La Pizza de Nonno"
              width="72"
              height="72"
              className="h-14 w-14 sm:h-[4.5rem] sm:w-[4.5rem] rounded-full object-cover border border-tomate"
            />
          </button>

          {/* Derecha: mi cuenta + pedir */}
          <div className="justify-self-end flex items-center gap-3 sm:gap-6">
            {status !== 'loading' && (
              <button
                onClick={openAccount}
                className="inline-flex items-center gap-1.5 font-sans font-semibold uppercase text-base text-tomate hover:text-forno transition-colors"
                aria-label={status === 'member' ? `Mi cuenta, ${points} puntos` : 'Mi cuenta: Club Nonno'}
              >
                <UserRound className="w-6 h-6 sm:w-5 sm:h-5" strokeWidth={2} />
                <span className="hidden sm:inline">{status === 'member' ? `${points} pts` : 'Mi cuenta'}</span>
              </button>
            )}
            <button
              onClick={openCart}
              className="relative inline-flex items-center justify-center gap-1.5 bg-tomate text-masa font-sans font-semibold uppercase tracking-[0.03em] text-sm sm:text-base h-10 sm:h-[3.4rem] w-[6.5rem] sm:w-[7.3rem] hover:bg-forno transition-colors"
              style={{ clipPath: 'polygon(16px 0, calc(100% - 16px) 0, 100% 50%, calc(100% - 16px) 100%, 16px 100%, 0 50%)' }}
              aria-label={`Pide ya${count > 0 ? `, ${count} producto${count > 1 ? 's' : ''} en el carrito` : ''}`}
            >
              PIDE YA
              {count > 0 && <span className="rounded-full bg-masa text-tomate px-1.5 text-xs leading-5">{count}</span>}
            </button>
          </div>
        </div>
      </div>

      {showTrack && (
        <button
          onClick={() => navigate(trackPath(lastOrder.token))}
          className="w-full flex items-center justify-center gap-2 bg-forno text-masa h-10 px-3 font-sans font-semibold uppercase text-[0.8rem] sm:text-sm tracking-wide hover:bg-tomate transition-colors"
        >
          <Flame className="w-4 h-4 text-queso" /> Tu pedido {lastOrder.ref} · <span className="underline underline-offset-2">ver cómo va</span>
        </button>
      )}

      {/* Sede elegida, siempre a la vista y a un toque de cambiarla */}
      <button
        onClick={openLocationPrompt}
        className="w-full flex items-center justify-center gap-1.5 border-b border-tomate/40 bg-crema h-9 px-3 font-sans text-[0.8rem] sm:text-sm text-carbon/80 hover:bg-queso/60 transition-colors"
      >
        <MapPin className="w-4 h-4 text-tomate flex-shrink-0" />
        {location ? (
          <span className="truncate">
            Pides en <strong className="font-bold uppercase text-tomate">{location.name}</strong>
            <span className="ml-2 underline underline-offset-2 text-carbon/55">cambiar</span>
          </span>
        ) : (
          <span className="font-bold uppercase text-tomate">Elige tu Nonno para pedir →</span>
        )}
      </button>
    </header>
  )
}
