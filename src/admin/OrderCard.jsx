import { Printer, Truck, Package, Phone, MapPin, Clock } from 'lucide-react'
import { price } from '../lib/format'
import { printTicket } from './printTicket'

const FLOW = [
  { id: 'nuevo', label: 'NUEVO', next: 'horno', action: 'AL HORNO' },
  { id: 'horno', label: 'EN EL HORNO', next: 'listo', action: 'MARCAR LISTO' },
  { id: 'listo', label: 'LISTO', next: 'entregado', action: 'ENTREGADO' },
  { id: 'entregado', label: 'ENTREGADO', next: null, action: null },
  { id: 'cancelado', label: 'CANCELADO', next: null, action: null },
]

const TONE = {
  nuevo: 'border-tomate bg-tomate/5',
  horno: 'border-horno bg-horno/5',
  listo: 'border-albahaca bg-albahaca/5',
  entregado: 'border-carbon/15 bg-transparent opacity-60',
  cancelado: 'border-carbon/15 bg-transparent opacity-40',
}

const BADGE = {
  nuevo: 'bg-tomate text-crema',
  horno: 'bg-horno text-crema',
  listo: 'bg-albahaca text-crema',
  entregado: 'bg-carbon/10 text-carbon/60',
  cancelado: 'bg-carbon/10 text-carbon/50',
}

const minutesAgo = (iso) => Math.max(0, Math.round((Date.now() - new Date(iso)) / 60000))

export default function OrderCard({ order, onStatus, busy }) {
  const step = FLOW.find((s) => s.id === order.status) || FLOW[0]
  const waiting = minutesAgo(order.created_at)
  const isOpen = !['entregado', 'cancelado'].includes(order.status)

  return (
    <article className={`rounded-card border-2 p-5 transition-colors ${TONE[order.status] || TONE.nuevo}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono font-bold text-lg text-carbon">{order.ref}</span>
            <span className={`mono normal-case rounded-full px-2.5 py-1 ${BADGE[order.status]}`}>
              {step.label}
            </span>
            <span className="mono normal-case flex items-center gap-1 rounded-full border border-carbon/15 px-2.5 py-1 text-carbon/70">
              {order.mode === 'delivery'
                ? <><Truck className="w-3.5 h-3.5" /> Entrega</>
                : <><Package className="w-3.5 h-3.5" /> Recogida</>}
            </span>
          </div>
          <p className="mono normal-case text-carbon/45 mt-2 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            hace {waiting} min · {order.location_name}
          </p>
        </div>
        <span className="font-serif italic font-semibold text-2xl text-carbon whitespace-nowrap">
          {price(order.total)}
        </span>
      </div>

      <ul className="mt-4 flex flex-col gap-2 border-t border-carbon/10 pt-4">
        {(order.items || []).map((item, i) => (
          <li key={i} className="flex gap-3 text-sm">
            <span className="font-mono font-bold text-carbon">{item.qty}×</span>
            <span className="flex-1">
              <span className="font-semibold text-carbon">{item.name}</span>
              {item.size && <span className="block mono normal-case text-carbon/50">{item.size}</span>}
              {item.removed?.length > 0 && (
                <span className="mt-1 inline-block rounded-lg border-2 border-tomate px-2 py-0.5 text-xs font-extrabold uppercase text-tomate">
                  Sin {item.removed.join(' · sin ')}
                </span>
              )}
              {item.extras?.length > 0 && (
                <span className="block mono normal-case text-albahaca">+ {item.extras.join(', ')}</span>
              )}
              {item.note && (
                <span className="block text-xs font-bold text-tomate">“{item.note}”</span>
              )}
            </span>
            <span className="mono text-carbon/60">{price(item.total)}</span>
          </li>
        ))}
      </ul>

      <div className="mt-4 border-t border-carbon/10 pt-4 flex flex-col gap-1 text-sm">
        <span className="font-semibold text-carbon">{order.customer_name}</span>
        <a href={`tel:${order.customer_phone}`} className="flex items-center gap-1.5 text-carbon/70 hover:text-tomate transition-colors">
          <Phone className="w-3.5 h-3.5" /> {order.customer_phone}
        </a>
        {order.address && (
          <span className="flex items-start gap-1.5 text-carbon/70">
            <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /> {order.address}
          </span>
        )}
        {order.notes && (
          <span className="mt-1 rounded-xl bg-carbon/5 px-3 py-2 text-carbon/80">
            <strong>Notas:</strong> {order.notes}
          </span>
        )}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {step.next && (
          <button
            onClick={() => onStatus(order.id, step.next)}
            disabled={busy}
            className="btn flex-1 min-w-[10rem] bg-carbon text-crema disabled:opacity-50"
          >
            <span className="btn-layer bg-tomate" />
            <span className="btn-label">{step.action}</span>
          </button>
        )}

        <button
          onClick={() => { printTicket(order); onStatus(order.id, null, { printed: true }) }}
          className="btn border border-carbon/20 bg-transparent text-carbon px-5"
          title="Imprimir ticket"
        >
          <span className="btn-layer bg-carbon/5" />
          <span className="btn-label">
            <Printer className="w-4 h-4" />
            {order.printed_at ? 'REIMPRIMIR' : 'IMPRIMIR'}
          </span>
        </button>

        {isOpen && (
          <button
            onClick={() => onStatus(order.id, 'cancelado')}
            disabled={busy}
            className="mono normal-case px-3 text-carbon/40 hover:text-tomate transition-colors"
          >
            Cancelar
          </button>
        )}
      </div>
    </article>
  )
}
