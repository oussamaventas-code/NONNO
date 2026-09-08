import { SITE, NAV_LINKS } from '../data/site'
import { LOCATIONS } from '../data/locations'
import { useActions } from '../store/StoreContext'

/**
 * Footer de marca. Cuatro columnas, esquinas redondeadas arriba,
 * estado del sistema con punto verde pulsante.
 */
export default function Footer() {
  const { setLocation, openCart } = useActions()
  const year = new Date().getFullYear()

  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  const orderAt = (id) => {
    setLocation(id)
    scrollTo('menu')
  }

  return (
    <footer className="bg-forno text-crema rounded-t-[4rem] pt-16 sm:pt-20 pb-8">
      <div className="shell">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-8">
          <div>
            <p className="font-sans font-extrabold uppercase text-sm tracking-tight">
              {SITE.brand.line1}<br />
              <em className="font-serif italic font-semibold text-xl not-italic">{SITE.brand.line2}</em>
            </p>
            <p className="mt-4 text-crema/50 max-w-[16rem]">{SITE.brand.claim}</p>
          </div>

          <div>
            <p className="mono text-crema/40 mb-4">EXPLORAR</p>
            <ul className="flex flex-col gap-2.5">
              {NAV_LINKS.map((l) => (
                <li key={l.id}>
                  <button onClick={() => scrollTo(l.id)} className="text-crema/75 hover:text-horno transition-colors text-sm">
                    {l.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="mono text-crema/40 mb-4">PEDIDOS</p>
            <ul className="flex flex-col gap-2.5">
              {LOCATIONS.map((loc) => (
                <li key={loc.id}>
                  <button onClick={() => orderAt(loc.id)} className="text-crema/75 hover:text-horno transition-colors text-sm">
                    {loc.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="mono text-crema/40 mb-4">INFORMACIÓN</p>
            <ul className="flex flex-col gap-2.5">
              <li><button onClick={openCart} className="text-crema/75 hover:text-horno transition-colors text-sm">Contacto</button></li>
              <li><span className="text-crema/40 text-sm cursor-default">Privacidad</span></li>
              <li><span className="text-crema/40 text-sm cursor-default">Aviso legal</span></li>
            </ul>
          </div>
        </div>

        <div className="mt-14 pt-6 border-t border-crema/10 flex flex-wrap items-center justify-between gap-4">
          <div className="mono normal-case flex items-center gap-2 text-crema/50">
            <span className="w-2 h-2 rounded-full bg-albahaca animate-pulse-dot" />
            SISTEMA ACTIVO · PEDIDOS ONLINE · {SITE.brand.version}
          </div>
          <p className="mono normal-case text-crema/30">© {year} La Pizza de Nonno</p>
        </div>
      </div>
    </footer>
  )
}
