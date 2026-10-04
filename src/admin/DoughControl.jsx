import { useEffect, useState } from 'react'
import { setDoughLimit } from './api'

/* ═══════════════════════════════════════════════════════════════
   MASAS DEL DÍA de una sede. Nonno pone cuántas masas hay (p. ej. 180)
   y cada pizza, calzone o dulce que entra gasta una. Al llegar a 0 la
   web y el mostrador dejan de vender pizzas. Cada noche vuelve a
   empezar solo con el mismo número. Solo la dirección lo cambia.
   ═══════════════════════════════════════════════════════════════ */

export default function DoughControl({ locationId, status, editable, onSaved, onError }) {
  const limit = status?.dough_limit ?? null
  const used = status?.dough_used ?? 0
  const left = status?.dough_left ?? null
  const [draft, setDraft] = useState(limit === null ? '' : String(limit))
  const [busy, setBusy] = useState(false)

  useEffect(() => { setDraft(limit === null ? '' : String(limit)) }, [limit])

  const save = async (value) => {
    setBusy(true)
    try {
      const { status: next } = await setDoughLimit(locationId, value)
      onSaved(locationId, next)
    } catch (err) {
      onError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const submit = (e) => {
    e.preventDefault()
    const clean = draft.trim()
    if (clean === '') return save(null)
    const n = Number(clean)
    if (!Number.isInteger(n) || n < 0) return onError('Escribe un número de masas entero.')
    save(n)
  }

  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0
  const tone = left === 0 ? 'bg-tomate' : left !== null && left <= Math.max(10, limit * 0.1) ? 'bg-horno' : 'bg-albahaca'

  return (
    <div className="rounded-md border border-tomate/30 bg-masa p-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-carbon/60">Masas hoy</p>
        {limit === null ? (
          <p className="text-sm text-carbon/60">Sin límite</p>
        ) : (
          <p className={['font-mono font-extrabold', left === 0 ? 'text-tomate' : 'text-carbon'].join(' ')}>
            {left === 0 ? 'AGOTADAS' : `Quedan ${left}`}
            <span className="font-normal text-carbon/50 text-xs"> · {used}/{limit}</span>
          </p>
        )}
      </div>
      {limit !== null && (
        <div className="mt-2 h-2 rounded-full bg-carbon/10 overflow-hidden" role="progressbar" aria-valuenow={used} aria-valuemin={0} aria-valuemax={limit} aria-label="Masas gastadas">
          <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
        </div>
      )}
      {editable && (
        <form onSubmit={submit} className="mt-2 flex items-center gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value.replace(/\D/g, ''))}
            inputMode="numeric"
            placeholder="Sin límite"
            aria-label="Masas del día"
            className="pfield !py-1.5 text-sm w-24 text-right"
          />
          <button disabled={busy || draft === (limit === null ? '' : String(limit))} className="ptab soft !py-1.5 disabled:opacity-40">
            {busy ? 'Guardando…' : 'Guardar'}
          </button>
        </form>
      )}
    </div>
  )
}
