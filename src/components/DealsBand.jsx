import { PICKUP_DEALS } from '../data/menu'
import { DEALS_BAND } from '../data/content'
import { price } from '../lib/format'
import { navigate } from '../lib/router'
import { useAccount } from '../store/AccountContext'
import { LOYALTY } from '../data/loyalty'

/**
 * "Llévatelas por menos": las ofertas reales de recogida en tiques
 * troquelados sobre la franja roja. Sale de PICKUP_DEALS, así que si
 * cambia la oferta en la carta cambia aquí sola.
 */
export default function DealsBand() {
  const { status, points, openAccount } = useAccount()
  return (
    <section className="bg-tomate text-masa py-20 sm:py-24 border-y border-tomate">
      <div className="px-5 text-center">
        <p className="font-sans font-semibold uppercase tracking-[0.14em] text-sm">{DEALS_BAND.kicker}</p>
        <h2 className="mt-3 font-display font-bold text-[clamp(2.25rem,4.45vw,4rem)] leading-none">{DEALS_BAND.title}</h2>
      </div>

      <div className="mt-12 mx-auto max-w-[68rem] px-5 flex flex-col gap-8">
        {PICKUP_DEALS.map((deal) => (
          <div key={deal.category}>
            <p className="font-sans font-semibold uppercase tracking-wider text-center text-queso">{deal.label}</p>
            <ul className="mt-4 grid grid-cols-3 gap-3 sm:gap-6">
              {deal.packs.map((pack) => (
                /* La sombra va en el <li>: la máscara del troquel la recortaría */
                <li key={pack.qty} className="drop-shadow-[3px_3px_0_rgb(29,43,79)]">
                  <div className="ticket-cut bg-masa text-neon rounded-md px-2 py-5 sm:py-6 text-center">
                    <p className="font-sans font-bold uppercase text-xs sm:text-sm tracking-wider">{pack.qty} pizzas</p>
                    <p className="mt-1 font-display font-bold text-3xl sm:text-5xl leading-none">{price(pack.price)}</p>
                    <p className="mt-2 font-sans text-xs sm:text-sm text-neon/75">{price(pack.price / pack.qty)} cada una</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <p className="mt-8 mx-auto max-w-2xl px-5 text-center font-sans text-sm text-masa/85">{DEALS_BAND.note}</p>
      <div className="mt-10 flex justify-center">
        <button onClick={() => navigate('/carta')} className="btn-retro border-masa bg-tomate shadow-[3px_3px_0_0_rgb(var(--c-masa))]">
          <span className="min-w-[13.9rem] bg-masa border-masa text-neon">Pedir para recoger</span>
        </button>
      </div>

      {/* Club Nonno */}
      {status !== 'loading' && (
        <div className="mt-14 mx-auto max-w-2xl px-5">
          <button onClick={openAccount} className="w-full rounded-md border border-dashed border-masa px-5 py-4 text-center hover:bg-masa/10 transition-colors">
            <span className="block font-display italic font-bold text-2xl">{LOYALTY.name}</span>
            <span className="block mt-1 font-sans text-masa/90">
              {status === 'member'
                ? `Tienes ${points} puntos. Ver mi cuenta →`
                : `${LOYALTY.pointsPerEuro} punto por cada euro · ${LOYALTY.redeemStep} puntos = ${LOYALTY.stepValue} € de descuento. Entra con tu móvil →`}
            </span>
          </button>
        </div>
      )}
    </section>
  )
}
