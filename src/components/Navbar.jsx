import { Menu as MenuIcon, UserRound, Moon, Sun } from 'lucide-react'
import { useTheme } from '../hooks/useTheme'
import { NAV_LINKS } from '../data/site'
import { ANNOUNCE } from '../data/content'
import { useCart, useActions } from '../store/StoreContext'
import { useAccount } from '../store/AccountContext'
import { followLink, navigate } from '../lib/router'

/**
 * Cabecera de diner: barra de aviso, enlaces a la izquierda, logo en
 * el centro y el botón hexagonal "PIDE YA" a la derecha (abre el
 * carrito). No es fija: se va con el scroll, como en la referencia.
 */
export default function Navbar() {
  const { count } = useCart()
  const { openCart, toggleMobileNav } = useActions()
  const { status, points, openAccount } = useAccount()
  const { dark, toggle } = useTheme()

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
            <button
              onClick={toggle}
              className="inline-flex items-center justify-center w-9 h-9 text-tomate hover:text-forno transition-colors"
              aria-label={dark ? 'Cambiar a fondo claro' : 'Cambiar a fondo negro'}
              title={dark ? 'Fondo claro' : 'Fondo negro'}
            >
              {dark ? <Sun className="w-5 h-5" strokeWidth={2} /> : <Moon className="w-5 h-5" strokeWidth={2} />}
            </button>
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
    </header>
  )
}
