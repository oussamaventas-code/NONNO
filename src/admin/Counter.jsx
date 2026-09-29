import { useState } from 'react'
import { Plus, Phone, Printer, Pencil, Euro, Truck, Package, Store, Clock, PackageCheck } from 'lucide-react'
import { price } from '../lib/format'
import { hourOf } from '../lib/kitchenSlots'
import { updateOrder } from './api'
import { printReceipt } from './printTicket'
import OrderEditor from './OrderEditor'
import ChargeDialog from './ChargeDialog'
import SmsStatus from './SmsStatus'

/* ═══════════════════════════════════════════════════════════════
   TPV DEL MOSTRADOR
   Todos los pedidos de la sede (web, mostrador y teléfono) con lo
   que falta por cobrar. Desde aquí se crean pedidos nuevos, se
   editan, se cobran y se imprime el ticket del cliente.
   ═══════════════════════════════════════════════════════════════ */

const FILTERS = [
  { id: 'cobrar', label: 'POR COBRAR' },
  { id: 'activos', label: 'ACTIVOS' },
  { id: 'hoy', label: 'TODOS HOY' },
]

const STATUS = {
  nuevo: { label: 'Nuevo', tone: 'bg-tomate text-crema' },
  horno: { label: 'En el horno', tone: 'bg-horno text-crema' },
  listo: { label: 'Listo', tone: 'bg-albahaca text-crema' },
  entregado: { label: 'Entregado', tone: 'bg-forno/15 text-carbon/70' },
  cancelado: { label: 'Cancelado', tone: 'bg-forno/10 text-carbon/60' },
}

const CHANNEL = {
  web: { label: 'Web', Icon: null },
  mostrador: { label: 'Mostrador', Icon: Store },
  telefono: { label: 'Teléfono', Icon: Phone },
}

const isActive = (o) => !['entregado', 'cancelado'].includes(o.status)
const isToday = (o) => new Date(o.created_at).toDateString() === new Date().toDateString()
/* Pendiente de cobro: de hoy, no cancelado y sin marcar como pagado
   (incluye los ya entregados que se quedaron sin cobrar). */
const owes = (o) => isToday(o) && o.status !== 'cancelado' && o.payment_status !== 'pagado'

export default function Counter({ orders, locationIds, defaultLocationId, onSaved, onError }) {
  const [filter, setFilter] = useState('cobrar')
  const [editor, setEditor] = useState(null) // { order?, channel }
  const [charging, setCharging] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const visible = orders
    .filter((o) => {
      if (filter === 'cobrar') return owes(o)
      if (filter === 'activos') return isActive(o)
      return isToday(o)
    })
    .sort((a, b) => Date.parse(a.ready_at || a.created_at) - Date.parse(b.ready_at || b.created_at))

  const porCobrar = orders
    .filter(owes)
    .reduce((sum, o) => sum + Number(o.total || 0), 0)
  const cobradoHoy = orders
    .filter((o) => isToday(o) && o.payment_status === 'pagado' && o.status !== 'cancelado')
    .reduce((acc, o) => {
      acc[o.payment_method === 'tarjeta' ? 'tarjeta' : 'efectivo'] += Number(o.total || 0)
      return acc
    }, { efectivo: 0, tarjeta: 0 })

  const patch = async (order, body) => {
    setBusyId(order.id)
    try {
      const { order: updated } = await updateOrder(order.id, body)
      onSaved(updated)
      return updated
    } catch (err) {
      onError(err.message)
      return null
    } finally {
      setBusyId(null)
    }
  }

  const confirmCharge = async (method, printIt) => {
    const updated = await patch(charging, { paymentStatus: 'pagado', paymentMethod: method })
    if (updated) {
      setCharging(null)
      if (printIt) printReceipt(updated)
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        <button onClick={() => setEditor({ channel: 'mostrador' })} className="btn bg-tomate text-crema px-6">
          <span className="btn-layer bg-horno" />
          <span className="btn-label"><Plus className="w-4 h-4" strokeWidth={2.5} /> NUEVO PEDIDO</span>
        </button>
        <button onClick={() => setEditor({ channel: 'telefono' })} className="btn bg-carbon text-crema px-6">
          <span className="btn-layer bg-tomate" />
          <span className="btn-label"><Phone className="w-4 h-4" /> PEDIDO POR TELÉFONO</span>
        </button>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2">
        <span className="mono normal-case text-carbon/60">
          Por cobrar: <strong className="text-tomate">{price(porCobrar)}</strong>
        </span>
        <span className="mono normal-case text-carbon/60">
          Cobrado hoy: <strong className="text-carbon">{price(cobradoHoy.efectivo)}</strong> efectivo ·{' '}
          <strong className="text-carbon">{price(cobradoHoy.tarjeta)}</strong> tarjeta
        </span>
      </div>

      <div className="mt-4 hide-scrollbar flex gap-2 overflow-x-auto">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={[
              'ptab soft',
              filter === f.id ? 'is-on' : '',
            ].join(' ')}
          >
            {f.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="py-16 text-center font-serif italic font-semibold text-lg text-tomate">
          {filter === 'cobrar' ? 'Nada pendiente de cobro.' : 'No hay pedidos aquí.'}
        </p>
      ) : (
        <ul className="mt-5 flex flex-col gap-3">
          {visible.map((o) => {
            const st = STATUS[o.status] || STATUS.nuevo
            const ch = CHANNEL[o.channel] || CHANNEL.web
            const paid = o.payment_status === 'pagado'
            /* Pedido tomado sin conexión, aún en la cola de este equipo:
               solo se puede reimprimir hasta que llegue al sistema. */
            const local = Boolean(o.offline)
            const editable = !local && isActive(o) && (o.items || []).every((i) => i.id)
            const busy = busyId === o.id
            return (
              <li key={o.id} className="pcard p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-bold text-lg text-carbon">{o.ref}</span>
                      <span className={`pchip !border-transparent ${st.tone}`}>{st.label}</span>
                      <span className="pchip">
                        {ch.Icon && <ch.Icon className="w-3.5 h-3.5" />} {ch.label}
                      </span>
                      <span className="pchip">
                        {o.mode === 'delivery'
                          ? <><Truck className="w-3.5 h-3.5" /> {o.delivery_zone || 'Entrega'}</>
                          : <><Package className="w-3.5 h-3.5" /> Recoge</>}
                      </span>
                      {o.edited_at && <span className="pchip !border-horno !text-horno bg-horno/10">Modificado</span>}
                      {local && <span className="pchip !border-transparent bg-forno !text-masa">SIN ENVIAR · en papel</span>}
                    </div>
                    <p className="mt-2 font-semibold text-carbon">
                      {o.customer_name}{o.customer_phone ? ` · ${o.customer_phone}` : ''}
                    </p>
                    <p className="mt-0.5 text-sm text-carbon/60 line-clamp-2">
                      {(o.items || []).map((i) => `${i.qty}× ${i.name}`).join(', ')}
                    </p>
                    {o.ready_at && isActive(o) && (
                      <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-carbon">
                        <Clock className="w-3.5 h-3.5" />
                        {o.mode === 'delivery' && o.eta_at ? `Sale ${hourOf(o.ready_at)} · llega ${hourOf(o.eta_at)}` : `Listo a las ${hourOf(o.ready_at)}`}
                      </p>
                    )}
                    {!local && (
                      <div className="mt-2"><SmsStatus order={o} onUpdated={onSaved} onError={onError} /></div>
                    )}
                  </div>

                  <div className="text-right">
                    <p className="font-serif italic font-semibold text-3xl text-tomate">{price(o.total)}</p>
                    <p className={['mono normal-case mt-1', paid ? 'text-albahaca' : 'text-tomate'].join(' ')}>
                      {paid ? `Pagado · ${o.payment_method || 'efectivo'}` : 'Falta por pagar'}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {!local && !paid && o.status !== 'cancelado' && (
                    <button onClick={() => setCharging(o)} disabled={busy} className="btn bg-albahaca text-crema px-5 disabled:opacity-50">
                      <span className="btn-layer bg-carbon" />
                      <span className="btn-label"><Euro className="w-4 h-4" /> COBRAR</span>
                    </button>
                  )}
                  {!local && isActive(o) && (
                    <button onClick={() => patch(o, { status: 'entregado' })} disabled={busy} className="btn bg-carbon text-crema px-5 disabled:opacity-50">
                      <span className="btn-layer bg-tomate" />
                      <span className="btn-label"><PackageCheck className="w-4 h-4" /> ENTREGADO</span>
                    </button>
                  )}
                  {editable && (
                    <button onClick={() => setEditor({ order: o })} disabled={busy} className="btn border border-tomate bg-transparent text-tomate px-5">
                      <span className="btn-layer bg-tomate/10" />
                      <span className="btn-label"><Pencil className="w-4 h-4" /> EDITAR</span>
                    </button>
                  )}
                  <button onClick={() => printReceipt(o)} className="btn border border-tomate bg-transparent text-tomate px-5">
                    <span className="btn-layer bg-tomate/10" />
                    <span className="btn-label"><Printer className="w-4 h-4" /> TICKET</span>
                  </button>
                  {!local && paid && (
                    <button
                      onClick={() => patch(o, { paymentStatus: 'pendiente' })}
                      disabled={busy}
                      className="mono normal-case px-3 text-carbon/40 hover:text-tomate transition-colors"
                    >
                      Deshacer cobro
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {editor && (
        <OrderEditor
          order={editor.order}
          defaultChannel={editor.channel}
          locationIds={locationIds}
          defaultLocationId={defaultLocationId}
          onClose={() => setEditor(null)}
          onSaved={(order, { isNew }) => {
            onSaved(order, { isNew })
            setEditor(null)
          }}
        />
      )}

      {charging && (
        <ChargeDialog
          order={charging}
          busy={busyId === charging.id}
          onClose={() => setCharging(null)}
          onConfirm={confirmCharge}
        />
      )}
    </div>
  )
}
