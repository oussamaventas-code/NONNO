import { useRef } from 'react'
import { X } from 'lucide-react'
import { NAV_LINKS, SITE } from '../data/site'
import { useStore, useActions } from '../store/StoreContext'
import { useLockBodyScroll } from '../hooks/useLockBodyScroll'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { gsap, useGSAP, EASE, DUR, revealFrom, guard } from '../lib/motion'
import { followLink } from '../lib/router'
import { useAccount } from '../store/AccountContext'
import { logoSrc } from '../data/siteContent'

/**
 * Panel de navegación móvil a pantalla completa.
 * Entra con una cortina vertical (clip-path), no con un fade plano.
 */
export default function MobileNav() {
  const { ui } = useStore()
  const { toggleMobileNav } = useActions()
  const { status, points, openAccount } = useAccount()
  const open = ui.mobileNav
  const panelRef = useRef(null)

  useLockBodyScroll(open)
  useFocusTrap(panelRef, open, () => toggleMobileNav(false))

  useGSAP(() => {
    if (!open) return
    guard(gsap.fromTo(
      panelRef.current,
      { clipPath: 'inset(0 0 100% 0)' },
      { clipPath: 'inset(0 0 0% 0)', duration: DUR.slow, ease: EASE.curtain }
    ))
    revealFrom('.mobile-nav-link', {
      y: 30,
      opacity: 0,
      stagger: 0.07,
      delay: 0.25,
      duration: 0.6,
      ease: EASE.in,
    })
  }, { dependencies: [open], scope: panelRef })

  if (!open) return null

  const go = (link) => {
    toggleMobileNav(false)
    setTimeout(() => followLink(link), 260)
  }

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label="Menú de navegación"
      className="fixed inset-0 z-[110] bg-masa text-tomate flex flex-col"
    >
      <div className="shell flex items-center justify-between pt-6 pb-4">
        <img src={logoSrc()} alt="La Pizza de Nonno" className="h-14 w-14 rounded-full object-cover border-[3px] border-tomate" />
        <button
          onClick={() => toggleMobileNav(false)}
          className="inline-flex items-center justify-center w-11 h-11 rounded-lg border-2 border-tomate"
          aria-label="Cerrar menú"
        >
          <X className="w-5 h-5" strokeWidth={1.75} />
        </button>
      </div>

      <nav className="shell flex-1 flex flex-col justify-center gap-2" aria-label="Secciones">
        {NAV_LINKS.filter((l) => l.href).map((link, i) => (
          <button
            key={link.label}
            onClick={() => go(link)}
            className="mobile-nav-link text-left py-3 border-b-2 border-dashed border-tomate/30 font-display italic font-extrabold text-display-sm text-tomate hover:text-forno transition-colors"
          >
            <span className="mono not-italic font-sans mr-3 text-tomate/50 align-top">{String(i + 1).padStart(2, '0')}</span>
            {link.label}
          </button>
        ))}
        {status !== 'loading' && (
          <button
            onClick={() => { toggleMobileNav(false); openAccount() }}
            className="mobile-nav-link text-left py-3 border-b-2 border-dashed border-tomate/30 font-display italic font-extrabold text-display-sm text-tomate hover:text-forno transition-colors"
          >
            <span className="mono not-italic font-sans mr-3 text-tomate/50 align-top">{String(NAV_LINKS.length + 1).padStart(2, '0')}</span>
            {status === 'member' ? `Mi cuenta · ${points} pts` : 'Mi cuenta'}
          </button>
        )}
      </nav>

      <div className="checker" aria-hidden="true" />
      <div className="shell py-6 font-sans font-bold uppercase tracking-[0.12em] text-xs text-tomate/70">
        {SITE.brand.claim}
      </div>
    </div>
  )
}
