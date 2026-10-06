import { useState } from 'react'
import { X, Banknote, CreditCard } from 'lucide-react'
import { price } from '../lib/format'

/** Billetes con los que puede pagar: el total redondeado a 5, 10, 20, 50 y 100 (sin repetir). */
const notesFor = (total) => [...new Set([5, 10, 20, 50, 100].map((n) => Math.ceil((total + 0.001) / n) * n))]
  .filter((n) => n > total).slice(0, 4)

/**
 * Cobro en el mostrador. En efectivo calcula el cambio; la web no
 * procesa pagos: esto solo deja apuntado que está cobrado y cómo.
 */
export default function ChargeDialog({ order, deliver = false, busy, onClose, onConfirm }) {
  const total = Number(order.total)
  const [given, setGiven] = useState('')
  const [printIt, setPrintIt] = useState(true)

  const givenNum = Number(String(given).replace(',', '.')) || 0
  const change = Math.round((givenNum - total) * 100) / 100
  const short = given !== '' && change < 0
  const notes = notesFor(total)

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

          <label className="mt-4 flex items-center gap-2 text-sm font-semibold text-carbon">
            <input type="checkbox" checked={printIt} onChange={(e) => setPrintIt(e.target.checked)} className="w-5 h-5 accent-albahaca" />
            Imprimir ticket para el cliente
          </label>

          {/* Tarjeta: un toque y listo */}
          <button
            onClick={() => onConfirm('tarjeta', printIt)}
            disabled={busy}
            className="btn mt-4 w-full bg-forno text-crema min-h-[60px] disabled:opacity-50"
          >
            <span className="btn-layer bg-tomate" />
            <span className="btn-label"><CreditCard className="w-6 h-6" /> {busy ? 'GUARDANDO…' : `TARJETA · ${price(total)}`}</span>
          </button>

          {/* Efectivo: si no se escribe nada, es el importe justo */}
          <div className="mt-5 rounded-md border border-albahaca/40 p-4">
            <label className="mono text-albahaca" htmlFor="charge-given">EFECTIVO · ¿CON CUÁNTO PAGA?</label>
            <input
              id="charge-given"
              inputMode="decimal"
              value={given}
              onChange={(e) => setGiven(e.target.value)}
              placeholder={`Justo (${price(total)})`}
              className="pfield mt-1 !text-2xl font-semibold"
            />
            {notes.length > 0 && (
              <div className="mt-2 flex gap-2">
                {notes.map((q) => (
                  <button key={q} onClick={() => setGiven(String(q))} className="ptab soft flex-1">{q} €</button>
                ))}
              </div>
            )}
            {given !== '' && (
              <p className={['mt-3 rounded-md px-4 py-3 text-center font-extrabold', short ? 'bg-tomate/10 text-tomate text-xl' : 'bg-albahaca/15 text-albahaca text-3xl'].join(' ')}>
                {short ? `Faltan ${price(-change)}` : `Cambio: ${price(change)}`}
              </p>
            )}
            <button
              onClick={() => onConfirm('efectivo', printIt)}
              disabled={busy || short}
              className="btn mt-3 w-full bg-albahaca text-crema min-h-[60px] disabled:opacity-50"
            >
              <span className="btn-layer bg-forno" />
              <span className="btn-label"><Banknote className="w-6 h-6" /> {busy ? 'GUARDANDO…' : given === '' ? `EFECTIVO JUSTO · ${price(total)}` : 'COBRADO EN EFECTIVO'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
