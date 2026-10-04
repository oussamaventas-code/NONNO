import { useCallback, useEffect, useState } from 'react'
import { Power, AlertTriangle, Eye, MapPinOff, Wallet, ChevronRight, CheckCircle2 } from 'lucide-react'
import { LOCATIONS } from '../data/locations'
import { price } from '../lib/format'
import { hourOf } from '../lib/kitchenSlots'
import { madridDay } from '../lib/stock'
import { fetchBilling, fetchCash } from './api'
import DoughControl from './DoughControl'

/* ═══════════════════════════════════════════════════════════════
   HOY — la pantalla del jefe
   Las dos sedes de un vistazo: si están abiertas, cuánto llevan
   facturado, qué hay en el horno, qué va tarde y si la caja se ha
   cerrado. Debajo, los avisos que piden hacer algo. Solo dirección.
   ═══════════════════════════════════════════════════════════════ */

const MONEY_POLL_MS = 60000
const isActive = (o) => !['entregado', 'cancelado'].includes(o.status)

export default function TodayBoard({ orders, storeStatuses, onDoughSaved, onOpenSede, onError }) {
  const [money, setMoney] = useState({})
  const [cash, setCash] = useState({})
  const [now, setNow] = useState(Date.now())

  const loadMoney = useCallback(async () => {
    const day = madridDay()
    try {
      const results = await Promise.all(LOCATIONS.map(async (l) => {
        const [bill, box] = await Promise.all([
          fetchBilling({ from: day, to: day, location: l.id }),
          fetchCash(l.id, day).catch(() => null),
        ])
        return [l.id, bill, box]
      }))
      setMoney(Object.fromEntries(results.map(([id, bill]) => [id, bill])))
      setCash(Object.fromEntries(results.map(([id, , box]) => [id, box])))
    } catch (err) {
      onError(err.message)
    }
  }, [onError])

  useEffect(() => {
    loadMoney()
    const timer = setInterval(loadMoney, MONEY_POLL_MS)
    return () => clearInterval(timer)
  }, [loadMoney])

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000)
    return () => clearInterval(timer)
  }, [])

  /* Avisos que piden que alguien haga algo, de las dos sedes */
  const active = orders.filter(isActive)
  const late = active.filter((o) => o.ready_at && ['nuevo', 'horno'].includes(o.status) && Date.parse(o.ready_at) < now)
  const unseen = active.filter((o) => o.status === 'nuevo' && !o.seen_at && now - Date.parse(o.created_at) > 2 * 60000
    && !(o.scheduled_for && Date.parse(o.ready_at) - now > 45 * 60000))
  const unverified = active.filter((o) => o.mode === 'delivery' && o.delivery_verified === false)
  const alerts = [
    ...late.map((o) => ({ key: `late-${o.id}`, Icon: AlertTriangle, tone: 'text-tomate', text: `${o.ref} (${o.location_name}) va con ${Math.round((now - Date.parse(o.ready_at)) / 60000)} min de retraso` })),
    ...unseen.map((o) => ({ key: `unseen-${o.id}`, Icon: Eye, tone: 'text-tomate', text: `${o.ref} (${o.location_name}) lleva ${Math.round((now - Date.parse(o.created_at)) / 60000)} min sin que nadie lo vea` })),
    ...unverified.map((o) => ({ key: `addr-${o.id}`, Icon: MapPinOff, tone: 'text-horno', text: `${o.ref} (${o.location_name}): dirección sin verificar, confirmar por teléfono` })),
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-5 lg:grid-cols-2">
        {LOCATIONS.map((loc) => {
          const mine = orders.filter((o) => o.location_id === loc.id)
          const count = (st) => mine.filter((o) => o.status === st).length
          const lateHere = late.filter((o) => o.location_id === loc.id).length
          const open = storeStatuses[loc.id]?.is_open === true
          const s = money[loc.id]?.summary
          const box = cash[loc.id]
          const next = mine.filter((o) => ['nuevo', 'horno'].includes(o.status) && o.ready_at && Date.parse(o.ready_at) >= now).sort((a, b) => Date.parse(a.ready_at) - Date.parse(b.ready_at))[0]
          return (
            <section key={loc.id} className={['pframe', lateHere ? '' : 'pf-navy'].join(' ')}>
              <div className="pframe-in p-5">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-sans font-extrabold uppercase text-xl text-tomate leading-tight">{loc.name}</h2>
                  <span className={[
                    'flex items-center gap-1 rounded-md px-2 py-1 text-xs font-bold uppercase tracking-wide',
                    open ? 'bg-albahaca text-masa' : 'bg-forno/10 text-carbon/60',
                  ].join(' ')}>
                    <Power className="w-3.5 h-3.5" /> {open ? 'Abierta' : 'Cerrada'}
                  </span>
                </div>

                {/* Dinero de hoy */}
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <Figure label="FACTURADO" value={s ? price(s.revenue) : '…'} big />
                  <Figure label="PEDIDOS" value={s ? s.orders : '…'} />
                  <Figure label="TICKET MEDIO" value={s ? price(s.avgTicket) : '…'} />
                </div>
                {s?.pending > 0 && (
                  <p className="mt-2 text-sm text-carbon/70">Por cobrar: <strong className="text-tomate">{price(s.pending)}</strong></p>
                )}

                {/* Cocina ahora */}
                <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                  {[
                    { label: 'En preparación', n: count('nuevo') + count('horno') },
                    { label: 'Listos', n: count('listo') },
                  ].map((k) => (
                    <div key={k.label} className="rounded-md border border-tomate/30 bg-masa py-2">
                      <p className="font-mono font-extrabold text-2xl text-carbon leading-none">{k.n}</p>
                      <p className="mt-1 text-[0.65rem] font-bold uppercase tracking-wide text-carbon/60">{k.label}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-2">
                  <DoughControl locationId={loc.id} status={storeStatuses[loc.id]} editable onSaved={onDoughSaved} onError={onError} />
                </div>

                <div className="mt-3 flex flex-col gap-1.5 text-sm">
                  {lateHere > 0 ? (
                    <p className="flex items-center gap-1.5 font-bold text-tomate"><AlertTriangle className="w-4 h-4" /> {lateHere} pedido{lateHere === 1 ? '' : 's'} con retraso</p>
                  ) : (
                    <p className="flex items-center gap-1.5 font-semibold text-albahaca"><CheckCircle2 className="w-4 h-4" /> Todo a su hora</p>
                  )}
                  {next && <p className="text-carbon/70">Próximo en salir: <strong>{next.ref}</strong> a las {hourOf(next.ready_at)}</p>}
                  <p className="flex items-center gap-1.5 text-carbon/70">
                    <Wallet className="w-4 h-4 text-tomate" />
                    {box?.closing
                      ? <>Caja cerrada a las {hourOf(box.closing.closed_at)}</>
                      : 'Caja aún sin cerrar'}
                  </p>
                </div>

                <button onClick={() => onOpenSede(loc.id)} className="ptab soft mt-4 w-full">
                  Ver la cocina de {loc.name} <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </section>
          )
        })}
      </div>

      <section className="pcard p-5">
        <p className="mono text-tomate mb-3">AVISOS AHORA</p>
        {alerts.length === 0 ? (
          <p className="flex items-center gap-2 font-semibold text-albahaca"><CheckCircle2 className="w-5 h-5" /> Nada pendiente: todo va bien.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {alerts.map((a) => (
              <li key={a.key} className={['flex items-start gap-2 text-sm font-semibold', a.tone].join(' ')}>
                <a.Icon className="w-4 h-4 mt-0.5 flex-shrink-0" /> <span className="text-carbon">{a.text}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function Figure({ label, value, big }) {
  return (
    <div className="rounded-md border border-tomate/30 bg-masa px-2 py-2">
      <p className="text-[0.6rem] font-bold uppercase tracking-wide text-tomate">{label}</p>
      <p className={['font-serif italic font-semibold text-carbon leading-tight', big ? 'text-2xl' : 'text-xl'].join(' ')}>{value}</p>
    </div>
  )
}
