import { useRef } from 'react'
import { X } from 'lucide-react'
import { NAV_LINKS, SITE } from '../data/site'
import { useStore, useActions } from '../store/StoreContext'
import { useLockBodyScroll } from '../hooks/useLockBodyScroll'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { gsap, useGSAP, EASE, DUR } from '../lib/motion'

/**
 * Panel de navegación móvil a pantalla completa.
 * Entra con una cortina vertical (clip-path), no con un fade plano.
 */
export default function MobileNav() {
  const { ui } = useStore()
  const { toggleMobileNav } = useActions()
  const open = ui.mobileNav
  const panelRef = useRef(null)

  useLockBodyScroll(open)
  useFocusTrap(panelRef, open, () => toggleMobileNav(false))

  useGSAP(() => {
    if (!open) return
    gsap.fromTo(
      panelRef.current,
      { clipPath: 'inset(0 0 100% 0)' },
      { clipPath: 'inset(0 0 0% 0)', duration: DUR.slow, ease: EASE.curtain }
    )
    gsap.from('.mobile-nav-link', {
      y: 30,
      opacity: 0,
      stagger: 0.07,
      delay: 0.25,
      duration: 0.6,
      ease: EASE.in,
    })
  }, { dependencies: [open], scope: panelRef })

  if (!open) return null

  const scrollTo = (id) => {
    toggleMobileNav(false)
    setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 260)
  }

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label="Menú de navegación"
      className="fixed inset-0 z-[110] bg-forno text-crema flex flex-col"
    >
      <div className="shell flex items-center justify-between pt-6 pb-4">
        <span className="font-sans font-extrabold uppercase text-xs tracking-tight">
          {SITE.brand.line1} <em className="font-serif italic font-semibold">{SITE.brand.line2}</em>
        </span>
        <button
          onClick={() => toggleMobileNav(false)}
          className="inline-flex items-center justify-center w-11 h-11 rounded-full border border-crema/20"
          aria-label="Cerrar menú"
        >
          <X className="w-5 h-5" strokeWidth={1.75} />
        </button>
      </div>

      <nav className="shell flex-1 flex flex-col justify-center gap-2" aria-label="Secciones">
        {NAV_LINKS.map((link, i) => (
          <button
            key={link.id}
            onClick={() => scrollTo(link.id)}
            className="mobile-nav-link text-left py-3 border-b border-crema/10 font-serif italic text-display-sm font-semibold text-crema/95 hover:text-horno transition-colors"
          >
            <span className="mono not-italic font-sans mr-3 text-crema/40 align-top">{String(i + 1).padStart(2, '0')}</span>
            {link.label}
          </button>
        ))}
      </nav>

      <div className="shell pb-8 mono text-crema/40">
        {SITE.brand.claim}
      </div>
    </div>
  )
}
