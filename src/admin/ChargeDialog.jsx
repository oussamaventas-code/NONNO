import { useState } from 'react'
import { X, Banknote, CreditCard } from 'lucide-react'
import { price } from '../lib/format'

const QUICK = [5, 10, 20, 50]

/**
 * Cobro en el mostrador. En efectivo calcula el cambio; la web no
 * procesa pagos: esto solo deja apuntado que está cobrado y cómo.
 */
export default function ChargeDialog({ order, deliver = false, busy, onClose, onConfirm }) {
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
      <div role="dialog" aria-modal="true" aria-labelledby="charge-title" className="pframe relative w-full sm:max-w-md !rounded-b-none sm:!rounded-b-lg max-h-[95vh] overflow-y-auto">
        <div className="pframe-in p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="mono text-tomate">{order.ref} · {order.customer_name}{deliver ? ' · se marca entregado' : ''}</p>
              <h2 id="charge-title" className="font-sans font-extrabold uppercase text-xl text-tomate mt-1">Cobrar</h2>
            </div>
            <button onClick={onClose} className="w-10 h-10 rounded-md border border-tomate/50 flex items-center justify-center text-tomate hover:bg-tomate/10" aria-label="Cerrar">
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="mt-4 font-serif italic font-semibold text-5xl text-tomate">{price(total)}</p>

          {/* Lo habitual, en un toque: cobrar y listo */}
          <div className="mt-5 grid grid-cols-2 gap-2">
            <button
              onClick={() => onConfirm('tarjeta', printIt)}
              disabled={busy}
              className="btn bg-forno text-crema min-h-[64px] disabled:opacity-50"
            >
              <span className="btn-layer bg-tomate" />
              <span className="btn-label flex-col !gap-1"><CreditCard className="w-6 h-6" /> TARJETA</span>
            </button>
            <button
              onClick={() => onConfirm('efectivo', printIt)}
              disabled={busy}
              className="btn bg-albahaca text-crema min-h-[64px] disabled:opacity-50"
            >
              <span className="btn-layer bg-forno" />
              <span className="btn-label flex-col !gap-1"><Banknote className="w-6 h-6" /> EFECTIVO JUSTO</span>
            </button>
          </div>
          <p className="mono normal-case text-carbon/50 mt-4 text-center">¿Paga con más? Calcula el cambio:</p>

          <div className="mt-5 grid grid-cols-2 gap-2">
            {[
              { id: 'efectivo', label: 'Efectivo', Icon: Banknote },
              { id: 'tarjeta', label: 'Tarjeta', Icon: CreditCard },
            ].map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setMethod(id)}
                className={[
                  'flex items-center justify-center gap-2 rounded-md border px-4 py-3 font-semibold uppercase tracking-wide text-sm',
                  method === id ? 'border-tomate bg-tomate text-masa' : 'border-tomate/50 text-tomate',
                ].join(' ')}
              >
                <Icon className="w-5 h-5" /> {label}
              </button>
            ))}
          </div>

          {method === 'efectivo' && (
            <div className="mt-5">
              <label className="mono text-tomate" htmlFor="charge-given">ENTREGA EL CLIENTE</label>
              <input
                id="charge-given"
                inputMode="decimal"
                value={given}
                onChange={(e) => setGiven(e.target.value)}
                placeholder={price(total)}
                className="pfield mt-1 !text-2xl font-semibold"
              />
              <div className="mt-2 grid grid-cols-5 gap-2">
                <button onClick={() => setGiven(String(total))} className="ptab soft">Justo</button>
                {QUICK.filter((q) => q >= total || q === 50).slice(0, 4).map((q) => (
                  <button key={q} onClick={() => setGiven(String(q))} className="ptab soft">{q} €</button>
                ))}
              </div>
              {given !== '' && (
                <p className={['mt-4 rounded-md px-4 py-3 text-center font-extrabold', short ? 'bg-tomate/10 text-tomate text-xl' : 'bg-albahaca/15 text-albahaca text-3xl'].join(' ')}>
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
    </div>
  )
}
