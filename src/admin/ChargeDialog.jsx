import { useState } from 'react'
import { X, Banknote, CreditCard } from 'lucide-react'
import { price } from '../lib/format'

const QUICK = [5, 10, 20, 50]

/**
 * Cobro en el mostrador. En efectivo calcula el cambio; la web no
 * procesa pagos: esto solo deja apuntado que está cobrado y cómo.
 */
export default function ChargeDialog({ order, busy, onClose, onConfirm }) {
  const total = Number(order.total)
  const [method, setMethod] = useState('efectivo')
  const [given, setGiven] = useState('')
  const [printIt, setPrintIt] = useState(true)

  const givenNum = Number(String(given).replace(',', '.')) || 0
  const change = Math.round((givenNum - total) * 100) / 100
  const short = method === 'efectivo' && given !== '' && change < 0

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <button className="absolute inset-0 bg-forno/60" onClick={onClose} aria-label="Cerrar" />
      <div role="dialog" aria-modal="true" aria-labelledby="charge-title" className="relative w-full sm:max-w-md bg-crema rounded-t-block sm:rounded-block p-6 shadow-float">
        <div className="flex items-start justify-between">
          <div>
            <p className="mono text-carbon/50">{order.ref} · {order.customer_name}</p>
            <h2 id="charge-title" className="font-sans font-extrabold uppercase text-xl text-carbon mt-1">Cobrar</h2>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full flex items-center justify-center text-carbon/60 hover:bg-carbon/5" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="mt-4 font-serif italic font-semibold text-5xl text-carbon">{price(total)}</p>

        <div className="mt-5 grid grid-cols-2 gap-2">
          {[
            { id: 'efectivo', label: 'Efectivo', Icon: Banknote },
            { id: 'tarjeta', label: 'Tarjeta', Icon: CreditCard },
          ].map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setMethod(id)}
              className={[
                'flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 font-semibold',
                method === id ? 'border-carbon bg-carbon text-crema' : 'border-carbon/15 text-carbon/70',
              ].join(' ')}
            >
              <Icon className="w-5 h-5" /> {label}
            </button>
          ))}
        </div>

        {method === 'efectivo' && (
          <div className="mt-5">
            <label className="mono text-carbon/50" htmlFor="charge-given">ENTREGA EL CLIENTE</label>
            <input
              id="charge-given"
              inputMode="decimal"
              value={given}
              onChange={(e) => setGiven(e.target.value)}
              placeholder={price(total)}
              className="mt-1 w-full rounded-2xl border border-carbon/15 bg-white/70 px-4 py-3 text-2xl font-semibold text-carbon outline-none focus:border-tomate"
            />
            <div className="mt-2 grid grid-cols-5 gap-2">
              <button onClick={() => setGiven(String(total))} className="rounded-xl border border-carbon/15 py-2 text-sm font-semibold">Justo</button>
              {QUICK.filter((q) => q >= total || q === 50).map((q) => (
                <button key={q} onClick={() => setGiven(String(q))} className="rounded-xl border border-carbon/15 py-2 text-sm font-semibold">{q} €</button>
              ))}
            </div>
            {given !== '' && (
              <p className={['mt-4 text-lg font-bold', short ? 'text-tomate' : 'text-albahaca'].join(' ')}>
                {short ? `Faltan ${price(-change)}` : `Cambio: ${price(change)}`}
              </p>
            )}
          </div>
        )}

        <label className="mt-5 flex items-center gap-2 text-sm font-semibold text-carbon">
          <input type="checkbox" checked={printIt} onChange={(e) => setPrintIt(e.target.checked)} className="w-5 h-5 accent-albahaca" />
          Imprimir ticket para el cliente
        </label>

        <button
          onClick={() => onConfirm(method, printIt)}
          disabled={busy || short}
          className="btn mt-5 w-full bg-albahaca text-crema disabled:opacity-50"
        >
          <span className="btn-layer bg-carbon" />
          <span className="btn-label">{busy ? 'GUARDANDO…' : `COBRADO · ${price(total)}`}</span>
        </button>
      </div>
    </div>
  )
}
