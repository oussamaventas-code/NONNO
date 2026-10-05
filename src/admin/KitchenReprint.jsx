import { useState } from 'react'
import { Printer, Search, X, Check } from 'lucide-react'
import { hourOf } from '../lib/kitchenSlots'
import { isThisServiceDay } from '../lib/orderNumber'
import { printTicket } from './printTicket'

/* ═══════════════════════════════════════════════════════════════
   COCINA — solo reimprimir
   Las comandas salen solas en la impresora de cocina y los pizzeros
   trabajan con el papel. Esta pantalla solo sirve para volver a sacar
   una que haya salido mal o se haya manchado: buscar el número y un
   botón grande. Nada más.
   ═══════════════════════════════════════════════════════════════ */

const byNewest = (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)

export default function KitchenReprint({ orders }) {
  const [search, setSearch] = useState('')
  const [done, setDone] = useState(null) // id recién reimpreso

  const digits = search.replace(/\D/g, '')
  const list = orders
    .filter((o) => isThisServiceDay(o) && o.status !== 'cancelado' && !o.offline)
    .filter((o) => !digits || String(o.ref || '').replace(/\D/g, '').endsWith(digits))
    .sort(byNewest)

  const reprint = async (o) => {
    await printTicket(o)
    setDone(o.id)
    setTimeout(() => setDone((id) => (id === o.id ? null : id)), 4000)
  }

  return (
    <div className="mx-auto max-w-3xl flex flex-col gap-4">
      <p className="rounded-lg bg-carbon px-4 py-3 text-masa text-[1.05rem] leading-snug">
        Las comandas salen solas en la impresora. Aquí solo se vuelve a imprimir una que haya salido mal o se haya manchado.
      </p>

      <label className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-carbon/50" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          inputMode="numeric"
          placeholder="Número del pedido"
          aria-label="Número del pedido"
          className="pfield !min-h-[60px] !pl-14 !pr-12 !text-xl !border-2 !border-carbon/70"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-carbon/60" aria-label="Borrar">
            <X className="w-6 h-6" />
          </button>
        )}
      </label>

      <p className="font-mono text-sm font-semibold text-carbon/70">PEDIDOS DE ESTA NOCHE · LOS ÚLTIMOS ARRIBA</p>
      {list.length === 0 && (
        <p className="rounded-md border border-dashed border-carbon/30 py-8 text-center text-carbon/60">
          {search ? 'Ningún pedido con ese número.' : 'Todavía no hay pedidos esta noche.'}
        </p>
      )}
      {list.map((o) => (
        <div key={o.id} className="pcard pc-navy flex items-center gap-4 py-2.5 pl-4 pr-3">
          <span className="w-20 flex-shrink-0 font-mono text-3xl font-bold text-carbon">{o.ref}</span>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-lg text-carbon truncate">
              {o.customer_name} · {o.mode === 'delivery' ? 'DOMICILIO' : 'RECOGER'}
            </p>
            <p className="text-carbon/70 truncate">{(o.items || []).map((i) => `${i.qty} ${i.name}`).join(' · ')}</p>
          </div>
          {o.ready_at && <span className="hidden sm:block font-mono font-semibold text-carbon">{hourOf(o.ready_at)}</span>}
          <button onClick={() => reprint(o)} className={['pbig flex-shrink-0 !min-h-[56px]', done === o.id ? 'bg-albahaca' : 'bg-tomate'].join(' ')}>
            {done === o.id ? <><Check className="w-5 h-5" /> Enviada</> : <><Printer className="w-5 h-5" /> Reimprimir</>}
          </button>
        </div>
      ))}
    </div>
  )
}
