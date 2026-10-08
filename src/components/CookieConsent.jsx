import { useEffect, useState, useRef } from 'react'
import { ArrowUpRight, ShieldCheck, Settings, Check, X } from 'lucide-react'
import { navigate } from '../lib/router'

export const COOKIE_CONSENT_KEY = 'nonno.cookie-consent.v2'
export const OPEN_COOKIE_EVENT = 'nonno:open-cookie-banner'
export const CONSENT_UPDATED_EVENT = 'nonno:cookie-consent-updated'

function PizzaSlice() {
  return (
    <svg viewBox="0 0 96 96" aria-hidden="true" className="w-12 h-12 shrink-0 drop-shadow-[2px_3px_0_rgb(var(--c-forno))]">
      <path d="M13 78 43 12c1-3 5-3 7 0l34 64c2 4-1 8-5 8H18c-5 0-7-3-5-6Z" fill="#e23e57" stroke="#1d2b4f" strokeWidth="4" strokeLinejoin="round" />
      <path d="m23 70 24-49 26 49Z" fill="#ffedaa" stroke="#1d2b4f" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="m15 78 64 0c4 0 7-4 5-8l-3-6-70 0-3 10c-1 3 2 4 7 4Z" fill="#e7a451" stroke="#1d2b4f" strokeWidth="3" />
      <circle cx="46" cy="39" r="5" fill="#e23e57" />
      <circle cx="59" cy="59" r="4.5" fill="#e23e57" />
      <circle cx="37" cy="61" r="3.5" fill="#e23e57" />
      <circle cx="52" cy="48" r="2" fill="#2f855a" />
    </svg>
  )
}

export default function CookieConsent() {
  const [isOpen, setIsOpen] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  const [analytics, setAnalytics] = useState(false)
  const [marketing, setMarketing] = useState(false)
  const modalRef = useRef(null)

  const readSavedConsent = () => {
    try {
      const raw = localStorage.getItem(COOKIE_CONSENT_KEY)
      if (!raw) return null
      return JSON.parse(raw)
    } catch {
      return null
    }
  }

  useEffect(() => {
    const existing = readSavedConsent()
    if (!existing) {
      setIsOpen(true)
    }

    const handleOpen = () => {
      const current = readSavedConsent()
      if (current) {
        setAnalytics(Boolean(current.analytics))
        setMarketing(Boolean(current.marketing))
      }
      setShowConfig(true)
      setIsOpen(true)
    }

    window.addEventListener(OPEN_COOKIE_EVENT, handleOpen)
    return () => window.removeEventListener(OPEN_COOKIE_EVENT, handleOpen)
  }, [])

  /* Bloquear el scroll de fondo mientras el banner bloqueante esté abierto */
  useEffect(() => {
    if (isOpen) {
      const original = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = original
      }
    }
  }, [isOpen])

  const saveConsent = (preferences) => {
    const consent = {
      technical: true,
      analytics: Boolean(preferences.analytics),
      marketing: Boolean(preferences.marketing),
      timestamp: new Date().toISOString(),
    }
    try {
      localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(consent))
    } catch {
      /* Modo incógnito con almacenamiento bloqueado */
    }
    window.dispatchEvent(new CustomEvent(CONSENT_UPDATED_EVENT, { detail: consent }))
    setIsOpen(false)
    setShowConfig(false)
  }

  const handleAcceptAll = () => {
    saveConsent({ analytics: true, marketing: true })
  }

  const handleRejectNonEssential = () => {
    saveConsent({ analytics: false, marketing: false })
  }

  const handleSaveCustom = () => {
    saveConsent({ analytics, marketing })
  }

  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cookie-title"
      className="fixed inset-0 z-[999] flex items-center justify-center p-3 sm:p-5 bg-carbon/70 backdrop-blur-sm transition-all"
    >
      <div
        ref={modalRef}
        className="pframe bg-crema w-full max-w-xl shadow-[6px_6px_0_0_rgb(var(--c-forno))] animate-in fade-in zoom-in-95 duration-200"
      >
        <div className="pframe-in p-5 sm:p-6">
          <div className="flex items-start gap-3.5">
            <PizzaSlice />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="mono text-xs text-tomate uppercase tracking-widest font-bold">
                  Cumplimiento RGPD & ePrivacy
                </span>
              </div>
              <h2 id="cookie-title" className="mt-1 font-display text-2xl font-black text-tomate sm:text-3xl">
                Tus preferencias de privacidad
              </h2>
            </div>
          </div>

          {!showConfig ? (
            <div className="mt-4 text-sm leading-relaxed text-carbon/85 space-y-2">
              <p>
                En <strong>La Pizza de Nonno</strong> utilizamos cookies y almacenamiento técnico estrictamente necesario para que puedas elegir tu sede, guardar los productos de tu carrito y tramitar tus pedidos.
              </p>
              <p className="text-xs text-carbon/75">
                Cumpliendo con la normativa española de la AEPD, no activamos cookies de analítica ni publicidad sin tu consentimiento previo e informado.
              </p>

              <div className="pt-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-tomate">
                <button
                  type="button"
                  onClick={() => { setIsOpen(false); navigate('/privacidad') }}
                  className="inline-flex items-center gap-1 underline underline-offset-4 hover:text-forno"
                >
                  Política de Privacidad y Cookies <ArrowUpRight className="h-3 w-3" />
                </button>
                <span>·</span>
                <button
                  type="button"
                  onClick={() => { setIsOpen(false); navigate('/terminos') }}
                  className="inline-flex items-center gap-1 underline underline-offset-4 hover:text-forno"
                >
                  Términos de Servicio <ArrowUpRight className="h-3 w-3" />
                </button>
              </div>

              {/* Botonera principal con la misma jerarquía visual conforme a AEPD */}
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={handleAcceptAll}
                  className="btn min-h-11 px-3 bg-tomate text-masa text-xs font-bold uppercase tracking-wider hover:bg-tomate/90"
                >
                  Aceptar todas
                </button>
                <button
                  type="button"
                  onClick={handleRejectNonEssential}
                  className="btn min-h-11 px-3 bg-carbon text-masa text-xs font-bold uppercase tracking-wider hover:bg-carbon/90"
                >
                  Solo necesarias
                </button>
                <button
                  type="button"
                  onClick={() => setShowConfig(true)}
                  className="btn min-h-11 px-3 border-2 border-tomate bg-crema text-tomate text-xs font-bold uppercase tracking-wider hover:bg-tomate hover:text-masa transition-colors"
                >
                  <Settings className="h-3.5 w-3.5 mr-1" /> Configurar
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <p className="text-xs text-carbon/75">
                Configura individualmente qué tipo de almacenamiento autorizas en este navegador:
              </p>

              {/* Opción 1: Técnicas (Obligatorias) */}
              <div className="rounded-lg border border-carbon/20 bg-queso/30 p-3 flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-1.5 font-bold text-xs uppercase text-tomate">
                    <ShieldCheck className="h-4 w-4" /> Cookies Técnicas y Esenciales
                  </div>
                  <p className="mt-0.5 text-xs text-carbon/80">
                    Imprescindibles para recordar tu cesta de pizzas, la sede de recogida/entrega y las sesiones del panel.
                  </p>
                </div>
                <span className="shrink-0 text-[0.65rem] font-bold uppercase tracking-wider bg-tomate/20 text-tomate px-2 py-0.5 rounded">
                  Obligatorias
                </span>
              </div>

              {/* Opción 2: Analítica */}
              <label className="rounded-lg border border-carbon/20 bg-crema p-3 flex items-start justify-between gap-3 cursor-pointer hover:bg-queso/20 transition-colors">
                <div>
                  <div className="font-bold text-xs uppercase text-carbon">
                    Cookies de Medición y Rendimiento
                  </div>
                  <p className="mt-0.5 text-xs text-carbon/70">
                    Nos permiten analizar de forma agregada las visitas para mejorar los tiempos de carga y la experiencia de pedido.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={analytics}
                  onChange={(e) => setAnalytics(e.target.checked)}
                  className="mt-1 h-5 w-5 accent-tomate rounded cursor-pointer"
                />
              </label>

              {/* Opción 3: Marketing */}
              <label className="rounded-lg border border-carbon/20 bg-crema p-3 flex items-start justify-between gap-3 cursor-pointer hover:bg-queso/20 transition-colors">
                <div>
                  <div className="font-bold text-xs uppercase text-carbon">
                    Cookies de Personalización y Ofertas
                  </div>
                  <p className="mt-0.5 text-xs text-carbon/70">
                    Permiten mostrarte promociones adaptadas a tus preferencias culinarias y las ofertas de tu sede habitual.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={marketing}
                  onChange={(e) => setMarketing(e.target.checked)}
                  className="mt-1 h-5 w-5 accent-tomate rounded cursor-pointer"
                />
              </label>

              <div className="pt-2 flex flex-wrap items-center justify-between gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowConfig(false)}
                  className="text-xs font-bold uppercase text-carbon/70 hover:text-tomate underline"
                >
                  Volver atrás
                </button>
                <button
                  type="button"
                  onClick={handleSaveCustom}
                  className="btn min-h-10 px-5 bg-tomate text-masa text-xs font-bold uppercase tracking-wider hover:bg-tomate/90"
                >
                  <Check className="h-4 w-4 mr-1" /> Guardar mi selección
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
