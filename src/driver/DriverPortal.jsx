import { useCallback, useEffect, useState } from 'react'
import { Banknote, CreditCard, Check, LogOut, Phone, Map as MapIcon, X, Search, Delete, Truck, AlertTriangle } from 'lucide-react'
import { LOCATIONS } from '../data/locations'
import { price } from '../lib/format'
import { hourOf } from '../lib/kitchenSlots'

/* ═══════════════════════════════════════════════════════════════
   PORTAL DEL REPARTIDOR  ·  /repartidor
   Cada repartidor entra con su PIN de 4 cifras (lo da el local). Al
   darle la salida en el mostrador ("Sale Daniel") esos pedidos le
   aparecen aquí solos; con un toque lo marca ENTREGADO y cobrado en
   EFECTIVO o con TARJETA. El mostrador y la caja lo ven al momento.
   ═══════════════════════════════════════════════════════════════ */

const POLL_MS = 15000

async function api(body) {
  const res = await fetch('/api/driver', body
    ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body) }
    : { credentials: 'same-origin' })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(data.error || 'Sin conexión. Inténtalo otra vez.'), { status: res.status, code: data.code })
  return data
}

export default function DriverPortal() {
  const [night, setNight] = useState(null) // { driver, pending, done, totals }
  const [state, setState] = useState('cargando') // cargando | fuera | dentro
  const [error, setError] = useState('')
  const [sheet, setSheet] = useState(null) // pedido abierto
  const [busy, setBusy] = useState(false)
  const [doneMsg, setDoneMsg] = useState(null)
  const [ref, setRef] = useState('')

  const openOrder = useCallback(async (q) => {
    setError(''); setBusy(true)
    try {
      const { order } = await api({ action: 'lookup', ...q })
      setSheet(order); setDoneMsg(null)
    } catch (err) {
      if (err.status === 401) setState('fuera')
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }, [])

  const load = useCallback(async () => {
    try {
      const data = await api()
      if (!data.driver) { setState('fuera'); return }
      setNight(data); setState('dentro')
    } catch (err) {
      setError(err.message)
      setState((s) => (s === 'cargando' ? 'fuera' : s))
    }
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(() => { if (document.visibilityState === 'visible') load() }, POLL_MS)
    return () => clearInterval(t)
  }, [load])

  const deliver = async (method) => {
    setBusy(true); setError('')
    try {
      const data = await api({ action: 'deliver', orderId: sheet.id, method })
      setNight(data)
      setDoneMsg({ ref: data.order.ref, total: data.order.total, method: sheet.paid ? null : method })
      setSheet(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const logout = async () => {
    await api({ action: 'logout' }).catch(() => {})
    setNight(null); setState('fuera')
  }

  if (state === 'cargando') return <Shell><p className="py-24 text-center mono text-carbon/50">ABRIENDO…</p></Shell>
  if (state === 'fuera') return <Shell><Login onIn={(data) => { setNight(data); setState('dentro'); setError(''); load() }} /></Shell>

  const { driver, pending, done, totals } = night
  return (
    <Shell
      head={(
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-sans font-extrabold uppercase text-lg text-tomate leading-tight truncate">{driver.name}</p>
            <p className="mono normal-case text-carbon/60 truncate">Reparto · {driver.locationName}</p>
          </div>
          <button onClick={logout} className="ptab soft" aria-label="Salir"><LogOut className="w-4 h-4" /> Salir</button>
        </div>
      )}
    >
      {/* Lo que lleva encima: lo que tiene que dejar en la caja al volver */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label="Efectivo encima" value={price(totals.cash)} strong />
        <Stat label="Tarjeta" value={price(totals.card)} />
        <Stat label="Entregados" value={totals.delivered} />
      </div>

      {doneMsg && (
        <div className="mt-5 rounded-md border-2 border-albahaca bg-albahaca/15 p-4 text-center">
          <Check className="w-10 h-10 mx-auto text-albahaca" strokeWidth={3} />
          <p className="mt-1 font-sans font-extrabold uppercase text-xl text-albahaca">{doneMsg.ref} entregado</p>
          <p className="text-carbon/80 font-semibold">
            {doneMsg.method ? `Cobrado ${price(doneMsg.total)} · ${doneMsg.method === 'tarjeta' ? 'tarjeta' : 'efectivo'}` : 'Ya estaba pagado'}
          </p>
        </div>
      )}

      {error && !sheet && (
        <p className="mt-5 flex items-start gap-2 rounded-md border border-tomate bg-tomate/10 px-4 py-3 font-semibold text-tomate" role="alert">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" /> {error}
        </p>
      )}

      <section className="mt-7">
        <h2 className="flex items-center gap-2 font-sans font-extrabold uppercase tracking-wide text-sm text-horno">
          <Truck className="w-4 h-4" /> Llevo ahora <span className="rounded-full border border-current px-2 text-xs leading-5">{pending.length}</span>
        </h2>
        {pending.length === 0 ? (
          <p className="mt-3 text-carbon/60">Nada asignado. Cuando el local te dé una salida, aparece aquí sola.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {pending.map((o, i) => (
              <li key={o.id} className="pcard p-4">
                <button onClick={() => { setSheet(o); setDoneMsg(null); setError('') }} className="w-full text-left">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-mono font-bold text-2xl text-carbon">{i + 1}. {o.ref}</span>
                    <span className={['font-bold', o.paid ? 'text-albahaca' : 'text-tomate'].join(' ')}>{o.paid ? 'Pagado' : `Cobrar ${price(o.total)}`}</span>
                  </div>
                  <p className="font-semibold text-carbon">{o.customerName}</p>
                  <p className="text-sm text-carbon/70">{o.address}</p>
                  {o.etaAt && <p className="mono normal-case text-carbon/50">llega hacia las {hourOf(o.etaAt)}</p>}
                </button>
                <Links o={o} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <form
        onSubmit={(e) => { e.preventDefault(); if (ref.trim()) openOrder({ ref: ref.trim() }) }}
        className="mt-7 flex gap-2"
      >
        <input
          value={ref}
          onChange={(e) => setRef(e.target.value.replace(/\D/g, '').slice(0, 4))}
          inputMode="numeric"
          placeholder="¿Otro pedido? Escribe su número"
          aria-label="Número del pedido"
          className="pfield !text-lg flex-1"
        />
        <button disabled={busy || !ref} className="ptab !min-h-[52px] px-4 disabled:opacity-40" aria-label="Buscar"><Search className="w-5 h-5" /></button>
      </form>

      {done.length > 0 && (
        <section className="mt-7">
          <h2 className="font-sans font-extrabold uppercase tracking-wide text-sm text-albahaca">Entregados esta noche</h2>
          <ul className="mt-2 flex flex-col divide-y divide-carbon/10">
            {done.map((o) => (
              <li key={o.id} className="flex items-baseline justify-between gap-2 py-2 text-sm">
                <span><strong className="font-mono">{o.ref}</strong> · {o.customerName}</span>
                <span className="text-carbon/70">{price(o.total)} · {o.method === 'tarjeta' ? 'tarjeta' : 'efectivo'}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {sheet && (
        <OrderSheet order={sheet} me={driver} busy={busy} error={error} onClose={() => { setSheet(null); setError('') }} onDeliver={deliver} />
      )}
    </Shell>
  )
}

function Shell({ head, children }) {
  return (
    <div className="min-h-screen bg-masa text-carbon">
      <header className="sticky top-0 z-20 border-b border-tomate/40 bg-masa/95 backdrop-blur px-4 py-3">
        {head || <p className="font-sans font-extrabold uppercase text-lg text-tomate">Nonno · Repartidores</p>}
      </header>
      <main className="mx-auto max-w-md px-4 pt-5 pb-16">{children}</main>
    </div>
  )
}

function Stat({ label, value, strong }) {
  return (
    <div className="rounded-md border border-tomate/30 bg-masa py-2 px-1">
      <p className={['font-mono font-extrabold leading-none', strong ? 'text-xl text-tomate' : 'text-lg text-carbon'].join(' ')}>{value}</p>
      <p className="mt-1 text-[0.65rem] font-bold uppercase tracking-wide text-carbon/60">{label}</p>
    </div>
  )
}

function Links({ o }) {
  const maps = o.lat != null
    ? `https://www.google.com/maps/dir/?api=1&destination=${o.lat},${o.lng}`
    : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(o.address || '')}`
  return (
    <div className="mt-3 flex gap-2">
      <a href={maps} target="_blank" rel="noopener noreferrer" className="ptab soft flex-1"><MapIcon className="w-4 h-4" /> Mapa</a>
      {o.phone && <a href={`tel:${o.phone}`} className="ptab soft flex-1"><Phone className="w-4 h-4" /> Llamar</a>}
    </div>
  )
}

/* ── Ficha del pedido: un toque y listo ─────────────── */
function OrderSheet({ order: o, me, busy, error, onClose, onDeliver }) {
  const otherDriver = o.driverId && o.driverId !== me.id
  const closed = o.status === 'entregado' || o.status === 'cancelado'
  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-masa">
      <div className="mx-auto max-w-md px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="mono text-tomate">PEDIDO</p>
            <p className="font-mono font-extrabold text-6xl text-carbon leading-none">{o.ref}</p>
          </div>
          <button onClick={onClose} className="w-12 h-12 rounded-md border border-tomate/60 flex items-center justify-center text-tomate" aria-label="Cerrar"><X className="w-6 h-6" /></button>
        </div>

        <p className="mt-4 font-sans font-bold text-xl text-carbon">{o.customerName}</p>
        <p className="text-carbon/80">{o.address}</p>
        {o.verified === false && <p className="mt-1 font-semibold text-horno">Dirección sin verificar: llama antes.</p>}
        {o.notes && <p className="mt-2 rounded-md border border-tomate/40 bg-queso/60 px-3 py-2 text-sm font-semibold">Nota: {o.notes}</p>}
        <p className="mt-2 text-sm text-carbon/70">{o.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}</p>
        <Links o={o} />

        <div className="mt-6 rounded-md border-2 border-tomate p-4 text-center">
          <p className="mono text-tomate">{o.paid ? 'YA PAGADO' : 'A COBRAR'}</p>
          <p className="font-serif italic font-semibold text-5xl text-carbon">{price(o.total)}</p>
        </div>

        {error && <p className="mt-4 rounded-md border border-tomate bg-tomate/10 px-4 py-3 font-semibold text-tomate" role="alert">{error}</p>}

        {o.status === 'cancelado' ? (
          <p className="mt-5 rounded-md bg-tomate px-4 py-4 text-center font-extrabold uppercase text-masa">Pedido cancelado · llama al local</p>
        ) : o.status === 'entregado' ? (
          <p className="mt-5 rounded-md bg-albahaca/20 px-4 py-4 text-center font-bold text-albahaca">Ya está entregado{o.driverName ? ` (${o.driverName})` : ''}</p>
        ) : otherDriver ? (
          <p className="mt-5 rounded-md border border-horno bg-horno/10 px-4 py-4 text-center font-bold text-carbon">Este pedido lo lleva {o.driverName}.</p>
        ) : null}

        {!closed && !otherDriver && (
          o.paid ? (
            <button onClick={() => onDeliver(null)} disabled={busy} className="btn mt-5 w-full min-h-[80px] bg-albahaca text-crema disabled:opacity-50">
              <span className="btn-layer bg-carbon" />
              <span className="btn-label text-xl"><Check className="w-7 h-7" /> ENTREGADO</span>
            </button>
          ) : (
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button onClick={() => onDeliver('efectivo')} disabled={busy} className="btn min-h-[110px] bg-albahaca text-crema disabled:opacity-50">
                <span className="btn-layer bg-carbon" />
                <span className="btn-label flex-col !gap-1 text-lg"><Banknote className="w-9 h-9" /> EFECTIVO</span>
              </button>
              <button onClick={() => onDeliver('tarjeta')} disabled={busy} className="btn min-h-[110px] bg-forno text-crema disabled:opacity-50">
                <span className="btn-layer bg-tomate" />
                <span className="btn-label flex-col !gap-1 text-lg"><CreditCard className="w-9 h-9" /> TARJETA</span>
              </button>
              <p className="col-span-2 text-center text-sm text-carbon/60">Al tocar, queda entregado y cobrado.</p>
            </div>
          )
        )}
      </div>
    </div>
  )
}

/* ── Entrar con el PIN ─────────────────────────────────────────── */
function Login({ onIn }) {
  const sedes = LOCATIONS.filter((l) => l.services?.delivery)
  const [loc, setLoc] = useState(() => {
    try { return localStorage.getItem('nonno.reparto.sede') || sedes[0]?.id } catch { return sedes[0]?.id }
  })
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = useCallback(async (value) => {
    setBusy(true); setError('')
    try {
      const data = await api({ action: 'login', location: loc, pin: value })
      try { localStorage.setItem('nonno.reparto.sede', loc) } catch { /* sin almacenamiento */ }
      onIn(data)
    } catch (err) {
      setError(err.message); setPin('')
    } finally {
      setBusy(false)
    }
  }, [loc, onIn])

  const press = (d) => {
    if (busy) return
    const next = (pin + d).slice(0, 4)
    setPin(next)
    if (next.length === 4) submit(next)
  }

  return (
    <div>
      <p className="mono text-tomate">TU LOCAL</p>
      <div className="mt-2 grid gap-2" style={{ gridTemplateColumns: `repeat(${sedes.length}, minmax(0, 1fr))` }}>
        {sedes.map((l) => (
          <button key={l.id} onClick={() => setLoc(l.id)} aria-pressed={loc === l.id} className="ptab !min-h-[52px]">{l.name}</button>
        ))}
      </div>

      <p className="mono text-tomate mt-6">TU PIN</p>
      <div className="mt-2 flex justify-center gap-3" aria-label={`${pin.length} de 4 cifras`}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={['w-12 h-14 rounded-md border-2 flex items-center justify-center text-3xl font-bold', i < pin.length ? 'border-tomate text-carbon' : 'border-carbon/20'].join(' ')}>
            {i < pin.length ? '•' : ''}
          </span>
        ))}
      </div>
      {error && <p className="mt-3 text-center font-semibold text-tomate" role="alert">{error}</p>}

      <div className="mt-5 grid grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} onClick={() => press(d)} disabled={busy} className="ptab !min-h-[64px] !text-2xl">{d}</button>
        ))}
        <span />
        <button onClick={() => press('0')} disabled={busy} className="ptab !min-h-[64px] !text-2xl">0</button>
        <button onClick={() => setPin((p) => p.slice(0, -1))} disabled={busy} className="ptab soft !min-h-[64px]" aria-label="Borrar"><Delete className="w-6 h-6" /></button>
      </div>
      <p className="mt-6 text-center text-sm text-carbon/60">El PIN te lo da el local. Si no lo tienes, pídeselo al encargado.</p>
    </div>
  )
}
