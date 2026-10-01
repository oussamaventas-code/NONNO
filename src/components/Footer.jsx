import { MapPin } from 'lucide-react'
import { LOCATIONS } from '../data/locations'
import { useActions } from '../store/StoreContext'
import { navigate } from '../lib/router'

/**
 * Footer bajo la franja de cuadros: a la izquierda la llamada a pedir,
 * a la derecha dos columnas de enlaces y los teléfonos de cada sede;
 * abajo el nombre de la casa y la barra del copyright.
 */
export default function Footer() {
  const { setLocation, openCart } = useActions()
  const year = new Date().getFullYear()

  const orderAt = (id) => {
    setLocation(id)
    openCart()
  }

  const link = 'font-sans font-semibold uppercase text-base text-masa hover:text-forno transition-colors text-left'

  return (
    <footer>
      <div className="checker" aria-hidden="true" />
      <div className="neon-banda">
        <div className="px-5 pt-20 pb-16 grid lg:grid-cols-[minmax(0,38.5rem)_auto] lg:justify-between gap-14">
          <div>
            <p className="font-sans font-medium uppercase text-lg">Pide online para recoger o a domicilio</p>
            <button onClick={() => navigate('/carta')} className="btn-retro mt-8 border-masa bg-tomate shadow-[3px_3px_0_0_rgb(var(--c-masa))]">
              <span className="w-[15.5rem] bg-papel border-papel text-tomate">Haz tu pedido</span>
            </button>
          </div>

          <div className="grid grid-cols-[auto_1fr] lg:grid-cols-[auto_auto] gap-x-10 lg:gap-x-16 gap-y-6">
            <ul className="flex flex-col gap-5">
              <li><button onClick={() => navigate('/carta')} className={link}>Pedidos</button></li>
              <li><button onClick={() => navigate('/carta')} className={link}>Carta</button></li>
            </ul>
            {/* Las dos sedes en la misma columna, alineadas, con su pin */}
            <ul className="flex flex-col gap-5">
              {LOCATIONS.map((loc) => (
                <li key={loc.id} className="flex items-start gap-2">
                  <MapPin className="w-5 h-5 mt-0.5 flex-shrink-0" aria-hidden="true" />
                  <div className="flex flex-col gap-1">
                    <button onClick={() => orderAt(loc.id)} className={`${link} lg:whitespace-nowrap`}>{loc.name}</button>
                    {loc.phones?.map((p) => (
                      <a key={p} href={`tel:+34${p.replace(/\s/g, '')}`} className="font-sans font-semibold text-base hover:text-forno">{p}</a>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <p className="font-display italic font-bold text-5xl leading-none">La Pizza de Nonno</p>
        </div>

        <div className="border-t border-masa h-11 px-5 flex items-center font-sans font-semibold text-sm">
          Copyright © {year} La Pizza de Nonno
        </div>
      </div>
    </footer>
  )
}
