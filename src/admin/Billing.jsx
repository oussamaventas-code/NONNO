import { useEffect, useState } from 'react'
import { Euro, Package, Truck, Globe, Store, Phone, Banknote, CreditCard, Clock3 } from 'lucide-react'
import { price } from '../lib/format'
import { madridDay } from '../lib/stock'
import { fetchBilling } from './api'
import { CANCEL_LABEL } from './CancelReasons'

/* ═══════════════════════════════════════════════════════════════
   FACTURACIÓN — solo dirección
   Informe de verdad contra la base de datos (no los últimos pedidos
   cargados): por rango de fechas, con desglose por día, sede, modo,
   canal y forma de pago. "Facturación" = pedidos no cancelados,
   estén cobrados o no; por eso también se ve cobrado / pendiente.
   ═══════════════════════════════════════════════════════════════ */

const addDays = (day, delta) => {
  const d = new Date(`${day}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + delta)
  return d.toISOString().slice(0, 10)
}
const startOfWeek = (day) => addDays(day, -((new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7))
const startOfMonth = (day) => `${day.slice(0, 7)}-01`
const longDay = (day) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })

const PRESETS = (today) => ({
  hoy: { label: 'HOY', from: today, to: today },
  ayer: { label: 'AYER', from: addDays(today, -1), to: addDays(today, -1) },
  semana: { label: 'ESTA SEMANA', from: startOfWeek(today), to: today },
  mes: { label: 'ESTE MES', from: startOfMonth(today), to: today },
})

export default function Billing({ locationId, onError }) {
  const today = madridDay()
  const [preset, setPreset] = useState('hoy')
  const [custom, setCustom] = useState({ from: today, to: today })
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const range = preset === 'custom' ? custom : PRESETS(today)[preset]

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchBilling({ ...range, location: locationId })
      .then((d) => { if (!cancelled) setData(d) })
      .catch((err) => { if (!cancelled) onError(err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [range.from, range.to, locationId]) // eslint-disable-line react-hooks/exhaustive-deps

  const maxDay = data ? Math.max(1, ...data.byDay.map((d) => d.revenue)) : 1

  return (
    <div className="flex flex-col gap-6">
      {/* Rango de fechas */}
      <div className="flex flex-wrap items-center gap-2">
        {Object.entries(PRESETS(today)).map(([id, p]) => (
          <button
            key={id}
            onClick={() => setPreset(id)}
            className={[
              'ptab soft',
              preset === id ? 'is-on' : '',
            ].join(' ')}
          >
            {p.label}
          </button>
        ))}
        <button
          onClick={() => setPreset('custom')}
          className={[
            'ptab soft',
            preset === 'custom' ? 'is-on' : '',
          ].join(' ')}
        >
          PERSONALIZADO
        </button>
        {preset === 'custom' && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={custom.from}
              max={custom.to}
              onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
              className="pfield !w-auto !py-2 text-sm"
            />
            <span className="text-carbon/40">—</span>
            <input
              type="date"
              value={custom.to}
              min={custom.from}
              max={today}
              onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
              className="pfield !w-auto !py-2 text-sm"
            />
          </div>
        )}
      </div>

      {loading || !data ? (
        <p className="mono text-carbon/40 py-16 text-center">CALCULANDO…</p>
      ) : (
        <>
          {/* Resumen */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <Stat label="FACTURACIÓN" value={price(data.summary.revenue)} tone="text-carbon" big />
            <Stat label="PEDIDOS" value={data.summary.orders} tone="text-carbon" />
            <Stat label="TICKET MEDIO" value={price(data.summary.avgTicket)} tone="text-carbon" />
            <Stat label="COBRADO" value={price(data.summary.collected)} tone="text-albahaca" />
            <Stat
              label="PENDIENTE DE COBRO"
              value={price(data.summary.pending)}
              tone={data.summary.pending > 0 ? 'text-tomate' : 'text-carbon/40'}
            />
            <Stat label="ENVÍOS + OFERTAS" value={`+${price(data.summary.deliveryFee)} / −${price(data.summary.discount)}`} tone="text-carbon/70" small />
          </div>

          {/* Por día */}
          <section className="pcard p-5">
            <p className="mono text-tomate mb-4">POR DÍA</p>
            {data.byDay.length === 0 ? (
              <p className="text-carbon/45 text-sm py-4">Sin pedidos en este rango.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {data.byDay.map((d) => (
                  <div key={d.day} className="flex items-center gap-3">
                    <span className="mono normal-case text-carbon/55 w-24 flex-shrink-0 capitalize">{longDay(d.day)}</span>
                    <div className="flex-1 h-6 rounded-md border border-tomate/40 bg-tomate/5 overflow-hidden">
                      <div className="h-full bg-tomate" style={{ width: `${Math.max(3, (d.revenue / maxDay) * 100)}%` }} />
                    </div>
                    <span className="font-sans font-bold text-carbon w-24 text-right">{price(d.revenue)}</span>
                    <span className="mono normal-case text-carbon/40 w-16 text-right">{d.orders} ped.</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Cajas descuadradas del rango: lo primero que tiene que ver el jefe */}
          {data.closings?.some((c) => Math.abs(c.diff) >= 0.01) && (
            <section className="rounded-md border-2 border-tomate bg-tomate/10 p-4">
              <p className="mono text-tomate mb-2">CAJAS DESCUADRADAS</p>
              <ul className="flex flex-col gap-1 text-sm">
                {data.closings.filter((c) => Math.abs(c.diff) >= 0.01).map((c) => (
                  <li key={c.day + c.locationId} className="flex flex-wrap gap-x-3">
                    <span className="font-bold text-carbon capitalize">{longDay(c.day)} · {c.name}</span>
                    <span className="font-bold text-tomate">{c.diff > 0 ? 'Sobran' : 'Faltan'} {price(Math.abs(c.diff))}</span>
                    {c.note && <span className="text-carbon/60">“{c.note}”</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="grid gap-5 lg:grid-cols-2">
            {/* Lo que más se vende */}
            {data.topProducts?.length > 0 && (
              <section className="pcard p-5 lg:row-span-2">
                <p className="mono text-tomate mb-4">LO MÁS VENDIDO</p>
                <ol className="flex flex-col gap-2.5">
                  {data.topProducts.map((p, i) => (
                    <li key={p.id} className="flex items-center gap-3">
                      <span className="w-6 text-right font-mono font-bold text-tomate">{i + 1}</span>
                      <span className="flex-1 min-w-0">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-sm font-semibold text-carbon">{p.name}</span>
                          <span className="mono normal-case text-carbon/60 whitespace-nowrap">{p.qty} uds · {price(p.revenue)}</span>
                        </span>
                        <span className="mt-1 block h-2 rounded-sm bg-tomate/10 overflow-hidden">
                          <span className="block h-full bg-tomate" style={{ width: `${Math.max(4, (p.qty / data.topProducts[0].qty) * 100)}%` }} />
                        </span>
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {/* Cancelaciones y por qué */}
            {data.cancellations && (
              <section className="pcard p-5">
                <p className="mono text-tomate mb-3">CANCELADOS</p>
                {data.cancellations.orders === 0 ? (
                  <p className="text-sm text-albahaca font-semibold">Ningún pedido cancelado en este rango.</p>
                ) : (
                  <>
                    <p className="text-sm text-carbon">
                      <strong className="text-tomate text-lg">{data.cancellations.orders}</strong> pedido{data.cancellations.orders === 1 ? '' : 's'} · {price(data.cancellations.lost)} que no se han vendido
                    </p>
                    <ul className="mt-3 flex flex-col gap-1.5">
                      {data.cancellations.byReason.map((r) => (
                        <li key={r.reason} className="flex items-center justify-between text-sm">
                          <span className="text-carbon/80">{CANCEL_LABEL[r.reason] || 'Sin motivo apuntado'}</span>
                          <span className="font-bold text-carbon">{r.orders}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </section>
            )}

            {/* Por sede: solo si se están viendo las dos */}
            {!locationId && data.byLocation.length > 0 && (
              <Breakdown title="POR SEDE" rows={data.byLocation.map((l) => ({ key: l.locationId, label: l.name, ...l }))} />
            )}

            <Breakdown
              title="RECOGIDA / ENTREGA"
              rows={[
                { key: 'pickup', label: 'Recogida', Icon: Package, ...data.byMode.pickup },
                { key: 'delivery', label: 'Entrega', Icon: Truck, ...data.byMode.delivery },
              ]}
            />

            <Breakdown
              title="DE DÓNDE VIENE EL PEDIDO"
              rows={[
                { key: 'web', label: 'Web', Icon: Globe, ...data.byChannel.web },
                { key: 'mostrador', label: 'Mostrador', Icon: Store, ...data.byChannel.mostrador },
                { key: 'telefono', label: 'Teléfono', Icon: Phone, ...data.byChannel.telefono },
              ]}
            />

            <Breakdown
              title="COBRADO — FORMA DE PAGO"
              rows={[
                { key: 'efectivo', label: 'Efectivo', Icon: Banknote, ...data.byPayment.efectivo },
                { key: 'tarjeta', label: 'Tarjeta', Icon: CreditCard, ...data.byPayment.tarjeta },
              ]}
              footnote="Solo pedidos ya marcados como pagados."
            />
          </div>
        </>
      )}
    </div>
  )
}

function Stat({ label, value, tone, big, small }) {
  return (
    <div className="pcard p-4">
      <p className="mono text-tomate text-[0.65rem]">{label}</p>
      <p className={[big ? 'text-2xl' : small ? 'text-sm' : 'text-xl', 'font-serif italic font-semibold mt-1', tone].join(' ')}>
        {value}
      </p>
    </div>
  )
}

function Breakdown({ title, rows, footnote }) {
  const total = rows.reduce((sum, r) => sum + r.revenue, 0) || 1
  return (
    <section className="pcard p-5">
      <p className="mono text-tomate mb-4 flex items-center gap-1.5">
        <Euro className="w-3.5 h-3.5" /> {title}
      </p>
      <div className="flex flex-col gap-3">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center gap-3">
            {r.Icon && <r.Icon className="w-4 h-4 text-carbon/40 flex-shrink-0" />}
            <span className="text-sm text-carbon flex-1">{r.label}</span>
            <span className="mono normal-case text-carbon/45">{r.orders} ped.</span>
            <span className="font-sans font-bold text-carbon w-20 text-right">{price(r.revenue)}</span>
            <span className="mono normal-case text-carbon/35 w-10 text-right">{Math.round((r.revenue / total) * 100)}%</span>
          </div>
        ))}
        {rows.every((r) => r.orders === 0) && (
          <p className="flex items-center gap-1.5 text-carbon/45 text-sm"><Clock3 className="w-3.5 h-3.5" /> Sin datos en este rango.</p>
        )}
      </div>
      {footnote && <p className="mt-3 text-xs text-carbon/40">{footnote}</p>}
    </section>
  )
}
