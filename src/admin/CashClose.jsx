import { useCallback, useEffect, useState } from 'react'
import { Banknote, CreditCard, Check, AlertTriangle, Wallet } from 'lucide-react'
import { price } from '../lib/format'
import { serviceDay } from '../lib/orderNumber'
import { hourOf } from '../lib/kitchenSlots'
import { getLocation } from '../data/locations'
import { fetchCash, saveCash } from './api'

/* ═══════════════════════════════════════════════════════════════
   CIERRE DE CAJA
   Al acabar el servicio: el panel dice cuánto debería haber en
   efectivo y en tarjeta según los pedidos cobrados, el empleado
   escribe lo que ha contado y queda guardado con la diferencia.
   La caja es de la NOCHE (día de servicio, cambia a las 05:00): cerrar
   a las 00:30 sigue siendo la caja de esa noche. Antes de cerrar dice
   qué pedidos faltan por cobrar o por entregar, con su número.
   ═══════════════════════════════════════════════════════════════ */

const num = (v) => {
  const n = Number(String(v ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}
const dayLabel = (day) =>
  new Date(`${day}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
const diffText = (d) => (Math.abs(d) < 0.005 ? 'Cuadra' : d > 0 ? `Sobran ${price(d)}` : `Faltan ${price(-d)}`)
const diffTone = (d) => (Math.abs(d) < 0.005 ? 'text-albahaca' : 'text-tomate')
const asInput = (n) => Number(n).toFixed(2).replace('.', ',')

export default function CashClose({ locationIds, onError }) {
  const [locId, setLocId] = useState(locationIds[0])
  const [day, setDay] = useState(serviceDay())
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [cash, setCash] = useState('')
  const [card, setCard] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (!locationIds.includes(locId)) setLocId(locationIds[0]) }, [locationIds, locId])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await fetchCash(locId, day)
      setData(d)
      /* Si ese día ya estaba cerrado, se enseña lo que se contó */
      setCash(d.closing ? asInput(d.closing.counted_cash) : '')
      setCard(d.closing ? asInput(d.closing.counted_card) : '')
      setNote(d.closing?.note || '')
    } catch (err) {
      onError(err.message)
    } finally {
      setLoading(false)
    }
  }, [locId, day, onError])

  useEffect(() => { load() }, [load])

  const expected = data?.expected
  /* Efectivo que debe haber en el cajón: el fondo fijo más lo cobrado en efectivo */
  const float = data?.float ?? 150
  const cashDue = expected ? Math.round((expected.cash + float) * 100) / 100 : 0
  /* El cierre guardado se hizo con otras cuentas (alguien cobró o deshizo un cobro después) */
  const stale = Boolean(data?.closing && expected) && (
    Math.abs(Number(data.closing.expected_cash) - cashDue) > 0.005
    || Math.abs(Number(data.closing.expected_card) - expected.card) > 0.005)
  const cashN = num(cash)
  const cardN = num(card)
  const ready = cash !== '' && card !== '' && cashN !== null && cardN !== null

  const save = async () => {
    setSaving(true)
    try {
      await saveCash(locId, day, { countedCash: cashN, countedCard: cardN, note })
      await load()
    } catch (err) {
      onError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      {locationIds.length > 1 && (
        <div className="flex gap-2">
          {locationIds.map((id) => (
            <button key={id} onClick={() => setLocId(id)} className={['ptab', locId === id ? 'is-on' : ''].join(' ')}>
              {getLocation(id).name}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mono text-tomate">CIERRE DE CAJA</p>
          <h2 className="font-sans font-extrabold uppercase text-xl text-tomate mt-1 first-letter:uppercase">{dayLabel(day)}</h2>
        </div>
        <input
          type="date"
          value={day}
          max={serviceDay()}
          onChange={(e) => e.target.value && setDay(e.target.value)}
          aria-label="Día del cierre"
          className="pfield !w-auto !py-2 text-sm"
        />
      </div>

      {data?.tableMissing && (
        <p className="palert">El cierre de caja aún no está activado en la base de datos (falta ejecutar supabase/fase2.sql). Puedes ver lo esperado, pero no guardar el cierre.</p>
      )}

      {loading || !expected ? (
        <p className="mono text-carbon/40 py-10 text-center">CALCULANDO…</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="pcard p-5">
              <p className="mono text-tomate flex items-center gap-1.5"><Banknote className="w-4 h-4" /> DEBE HABER EN LA CAJA</p>
              <p className="mt-1 font-serif italic font-semibold text-4xl text-carbon">{price(cashDue)}</p>
              <p className="mono normal-case text-carbon/60 mt-1">{price(float)} de fondo + {price(expected.cash)} cobrados en efectivo</p>
              {expected.cashDelivery > 0 && (
                <p className="mono normal-case text-carbon/60 mt-1">
                  De ese efectivo, <strong className="text-carbon">{price(expected.cashDelivery)}</strong> lo cobraron los repartidores: tiene que estar ya en el cajón.
                </p>
              )}
            </div>
            <div className="pcard p-5">
              <p className="mono text-tomate flex items-center gap-1.5"><CreditCard className="w-4 h-4" /> TARJETA ESPERADA</p>
              <p className="mt-1 font-serif italic font-semibold text-4xl text-carbon">{price(expected.card)}</p>
            </div>
          </div>

          {stale && (
            <p className="flex items-start gap-2 rounded-md border border-tomate bg-tomate/10 px-4 py-3 text-sm font-semibold text-tomate">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              Desde el cierre se han cobrado o cambiado pedidos: lo esperado ya no es lo que se guardó. Vuelve a contar y cierra otra vez.
            </p>
          )}

          {(expected.unpaid?.length > 0 || expected.open?.length > 0) && (
            <div className="rounded-md border border-horno bg-horno/10 px-4 py-3 text-sm text-carbon">
              <p className="flex items-start gap-2 font-semibold">
                <AlertTriangle className="w-5 h-5 text-horno flex-shrink-0" />
                Antes de cerrar, resuelve estos pedidos en Mostrador o Reparto (cóbralos, entrégalos o cancélalos si no vinieron). Mientras tanto no cuentan en la caja.
              </p>
              <ul className="mt-2 flex flex-col gap-1">
                {[...new Map([...(expected.unpaid || []), ...(expected.open || [])].map((o) => [o.id, o])).values()].map((o) => {
                  const unpaid = expected.unpaid?.some((u) => u.id === o.id)
                  const pending = [unpaid && 'sin cobrar', o.status !== 'entregado' && 'sin entregar'].filter(Boolean).join(' y ')
                  return (
                    <li key={o.id} className="flex flex-wrap items-baseline justify-between gap-x-3 border-t border-horno/30 pt-1">
                      <span><strong className="font-mono">{o.ref}</strong> · {o.name} · {o.mode === 'delivery' ? 'domicilio' : 'recoger'}</span>
                      <span className="font-semibold text-tomate">{price(o.total)} · {pending}</span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          <div className="pcard p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="mono text-tomate">LO QUE HAS CONTADO</p>
              <button
                onClick={() => { setCash(asInput(cashDue)); setCard(asInput(expected.card)) }}
                className="ptab soft"
              >
                <Check className="w-4 h-4" /> Todo cuadra
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { label: 'Efectivo en caja (con el fondo)', value: cash, set: setCash, exp: cashDue, n: cashN },
                { label: 'Tarjeta (datáfono)', value: card, set: setCard, exp: expected.card, n: cardN },
              ].map((f) => (
                <label key={f.label} className="block">
                  <span className="mono normal-case text-carbon/60 text-xs">{f.label}</span>
                  <input
                    inputMode="decimal"
                    value={f.value}
                    onChange={(e) => f.set(e.target.value)}
                    placeholder="0,00"
                    className="mt-1 pfield !text-2xl font-bold"
                  />
                  {f.value !== '' && f.n !== null && (
                    <span className={['mt-1 block text-sm font-bold', diffTone(f.n - f.exp)].join(' ')}>{diffText(f.n - f.exp)}</span>
                  )}
                </label>
              ))}
            </div>

            {cashN !== null && cash !== '' && (
              <p className={[
                'rounded-md border px-4 py-3 text-sm font-semibold',
                cashN >= float ? 'border-tomate/40 bg-queso/50 text-carbon' : 'border-tomate bg-tomate/10 text-tomate',
              ].join(' ')}>
                {cashN >= float
                  ? <>Saca <strong>{price(Math.round((cashN - float) * 100) / 100)}</strong> del cajón y deja <strong>{price(float)}</strong> de fondo para mañana.</>
                  : <>Ojo: en caja quedan menos de los {price(float)} de fondo. Faltan {price(Math.round((float - cashN) * 100) / 100)} para llegar al mínimo.</>}
              </p>
            )}

            <label className="block">
              <span className="mono normal-case text-carbon/60 text-xs">Nota (opcional): por qué sobra o falta, cambio dejado…</span>
              <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={400} className="mt-1 pfield !py-2 text-sm" />
            </label>

            <button
              onClick={save}
              disabled={!ready || saving || data.tableMissing}
              className="btn w-full bg-tomate text-crema min-h-[56px] disabled:opacity-50"
            >
              <span className="btn-layer bg-forno" />
              <span className="btn-label"><Wallet className="w-5 h-5" /> {saving ? 'GUARDANDO…' : data.closing ? 'VOLVER A CERRAR LA CAJA' : 'CERRAR CAJA'}</span>
            </button>
            {data.closing && (
              <p className="mono normal-case text-albahaca text-center">
                Cerrada a las {hourOf(data.closing.closed_at)}
              </p>
            )}
          </div>

          {data.history.length > 0 && (
            <div>
              <p className="mono text-tomate mb-2">ÚLTIMOS CIERRES</p>
              <ul className="flex flex-col gap-2">
                {data.history.map((c) => {
                  const dc = Number(c.counted_cash) - Number(c.expected_cash)
                  const dk = Number(c.counted_card) - Number(c.expected_card)
                  const ok = Math.abs(dc) < 0.005 && Math.abs(dk) < 0.005
                  return (
                    <li key={c.day} className="pcard px-4 py-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-1">
                      <button onClick={() => setDay(c.day)} className="font-sans font-bold text-carbon first-letter:uppercase hover:text-tomate">{dayLabel(c.day)}</button>
                      <span className="mono normal-case text-carbon/60">Efectivo {price(c.counted_cash)} · Tarjeta {price(c.counted_card)}</span>
                      <span className={['text-sm font-bold', ok ? 'text-albahaca' : 'text-tomate'].join(' ')}>
                        {ok ? 'Cuadra' : `Efectivo: ${diffText(dc)} · Tarjeta: ${diffText(dk)}`}
                      </span>
                      {c.note && <span className="basis-full text-xs text-carbon/60">“{c.note}”</span>}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}
