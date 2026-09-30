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
      <div className="bg-tomate text-masa">
        <div className="px-5 pt-20 pb-16 grid lg:grid-cols-[38.5rem_1fr] gap-14">
          <div>
            <p className="font-sans font-medium uppercase text-lg">Pide online y recoge tu pizza recién hecha en tu sede</p>
            <button onClick={() => navigate('/carta')} className="btn-retro mt-8 border-masa bg-tomate shadow-[3px_3px_0_0_rgb(var(--c-masa))]">
              <span className="w-[15.5rem] bg-papel border-papel text-tomate">Haz tu pedido</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-x-10 gap-y-6 lg:justify-self-end lg:w-[25rem]">
            <ul className="flex flex-col gap-5">
              <li><button onClick={() => navigate('/carta')} className={link}>Pedidos</button></li>
              <li><button onClick={() => navigate('/carta')} className={link}>Carta</button></li>
            </ul>
            {LOCATIONS.map((loc, i) => (
              <div key={loc.id} className={['flex flex-col gap-1', i === 1 ? 'lg:items-end lg:text-right' : ''].join(' ')}>
                <button onClick={() => orderAt(loc.id)} className={link}>{loc.name}</button>
                {loc.phones?.map((p) => (
                  <a key={p} href={`tel:+34${p.replace(/\s/g, '')}`} className="font-sans font-semibold text-base hover:text-forno">{p}</a>
                ))}
              </div>
            ))}
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
