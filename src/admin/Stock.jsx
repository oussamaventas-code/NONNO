import { useCallback, useEffect, useState } from 'react'
import { ClipboardList, Printer, Copy, Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { getLocation } from '../data/locations'
import { stockSummary, formatQty, parseQty, shoppingText } from '../lib/stock'
import { fetchStock, stockAction } from './api'
import { printDocument, esc } from './printTicket'

/* ═══════════════════════════════════════════════════════════════
   CHECKLIST DE STOCK
   Al empezar el día se apunta cuánto hay de cada producto y sale
   sola la lista de la compra: objetivo − lo que hay. Se tacha lo
   comprado. Los productos y sus objetivos se editan aquí mismo.
   ═══════════════════════════════════════════════════════════════ */

const UNITS = ['kg', 'uds', 'L', 'cajas', 'paquetes', 'botes']

export default function Stock({ locationIds, onError }) {
  const [locId, setLocId] = useState(locationIds[0])
  const [day, setDay] = useState(null)
  const [items, setItems] = useState([])
  const [counts, setCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [managing, setManaging] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!locationIds.includes(locId)) setLocId(locationIds[0])
  }, [locationIds, locId])

  const load = useCallback(async () => {
    try {
      const data = await fetchStock(locId)
      setDay(data.day)
      setItems(data.items)
      setCounts(Object.fromEntries(data.counts.map((c) => [c.item_id, c])))
    } catch (err) {
      onError(err.message)
    } finally {
      setLoading(false)
    }
  }, [locId, onError])

  /* Si otra persona apunta desde otro equipo, se ve al volver a la pestaña. */
  useEffect(() => {
    setLoading(true)
    load()
    window.addEventListener('focus', load)
    return () => window.removeEventListener('focus', load)
  }, [load])

  /* Se ve al momento y se guarda detrás; si falla, se deshace. */
  const saveCount = async (itemId, patch) => {
    const before = counts[itemId]
    setCounts((prev) => ({ ...prev, [itemId]: { ...prev[itemId], item_id: itemId, ...patch } }))
    try {
      const { count } = await stockAction(locId, 'count', {
        itemId,
        ...(patch.on_hand !== undefined ? { onHand: patch.on_hand } : {}),
        ...(patch.bought !== undefined ? { bought: patch.bought } : {}),
      })
      setCounts((prev) => ({ ...prev, [itemId]: count }))
    } catch (err) {
      setCounts((prev) => ({ ...prev, [itemId]: before }))
      onError(err.message)
    }
  }

  const summary = stockSummary(items, counts)
  const location = getLocation(locId)
  const dateLabel = day
    ? new Date(`${day}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
    : ''

  const printList = () => {
    const rows = summary.shopping.map((r) => `
      <tr>
        <td class="qty">${r.bought ? '[x]' : '[ ]'}</td>
        <td><strong>${esc(r.name)}</strong></td>
        <td class="amount">${esc(formatQty(r.buy, r.unit))}</td>
      </tr>`).join('')
    printDocument('Lista de la compra', `
      <div class="center"><h1>LISTA DE LA COMPRA</h1><div>${esc(location.name)}</div><div>${esc(dateLabel)}</div></div>
      <div class="rule"></div>
      <table>${rows}</table>
      <div class="rule"></div>`)
  }

  const copyList = async () => {
    try {
      await navigator.clipboard.writeText(shoppingText(summary.shopping, { locationName: location.name, day }))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      onError('No se ha podido copiar. Usa "Imprimir".')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {locationIds.length > 1 && (
        <div className="flex gap-2">
          {locationIds.map((id) => (
            <button
              key={id}
              onClick={() => setLocId(id)}
              className={[
                'rounded-full border px-4 py-2 text-sm font-semibold',
                locId === id ? 'border-carbon bg-carbon text-crema' : 'border-carbon/15 text-carbon/60',
              ].join(' ')}
            >
              {getLocation(id).name}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mono text-tomate">STOCK DE HOY</p>
          <h2 className="font-sans font-extrabold uppercase text-xl text-carbon mt-1 first-letter:uppercase">{dateLabel}</h2>
          {!loading && (
            <p className="mono normal-case text-carbon/55 mt-1">
              {summary.counted} de {items.length} contados
              {summary.pendingToBuy > 0 && ` · ${summary.pendingToBuy} por comprar`}
            </p>
          )}
        </div>
        <button
          onClick={() => setManaging((m) => !m)}
          className="mono normal-case flex items-center gap-1.5 rounded-full border border-carbon/15 px-4 py-2 text-carbon/70 hover:border-carbon/40"
        >
          {managing ? <><Check className="w-3.5 h-3.5" /> Listo</> : <><Pencil className="w-3.5 h-3.5" /> Editar productos</>}
        </button>
      </div>

      {loading ? (
        <p className="mono text-carbon/40 py-10 text-center">CARGANDO STOCK…</p>
      ) : managing ? (
        <ItemManager locId={locId} items={items} onChange={setItems} onError={onError} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_22rem] items-start">
          {/* Recuento */}
          <ul className="flex flex-col gap-2">
            {summary.rows.length === 0 && (
              <li className="rounded-card border border-dashed border-carbon/15 p-6 text-center text-carbon/55">
                No hay productos. Pulsa "Editar productos" para añadirlos.
              </li>
            )}
            {summary.rows.map((r) => (
              <li key={r.id} className="rounded-card border border-carbon/10 bg-crema p-4 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[9rem]">
                  <p className="font-sans font-bold text-carbon">{r.name}</p>
                  <p className="mono normal-case text-carbon/50">objetivo {formatQty(r.target, r.unit)}</p>
                </div>
                <label className="flex items-center gap-2">
                  <span className="mono normal-case text-carbon/55">Hay</span>
                  <CountInput
                    key={`${r.id}:${r.onHand}`}
                    value={r.onHand}
                    unit={r.unit}
                    label={`Cantidad de ${r.name} que hay`}
                    onCommit={(onHand) => saveCount(r.id, { on_hand: onHand })}
                  />
                </label>
                <span className={[
                  'basis-full sm:basis-auto sm:min-w-[8.5rem] sm:text-right font-sans font-extrabold',
                  r.buy === null ? 'text-carbon/35 text-sm' : r.buy > 0 ? 'text-tomate' : 'text-albahaca',
                ].join(' ')}>
                  {r.buy === null ? 'Sin contar' : r.buy > 0 ? `Comprar ${formatQty(r.buy, r.unit)}` : 'Completo'}
                </span>
              </li>
            ))}
          </ul>

          {/* Lista de la compra */}
          <aside className="rounded-card bg-carbon text-crema p-5 lg:sticky lg:top-6">
            <p className="font-sans font-extrabold uppercase flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-horno" /> Lista de la compra
            </p>
            {summary.shopping.length === 0 ? (
              <p className="mt-3 text-sm text-crema/60">
                {summary.counted === items.length && items.length > 0
                  ? 'No falta nada. Todo está por encima del objetivo.'
                  : 'Apunta lo que hay de cada producto y aquí saldrá lo que hay que comprar.'}
              </p>
            ) : (
              <>
                <ul className="mt-4 flex flex-col gap-1">
                  {summary.shopping.map((r) => (
                    <li key={r.id}>
                      <label className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-crema/5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={r.bought}
                          onChange={(e) => saveCount(r.id, { bought: e.target.checked })}
                          className="w-5 h-5 accent-albahaca flex-shrink-0"
                        />
                        <span className={['flex-1', r.bought ? 'line-through text-crema/40' : ''].join(' ')}>{r.name}</span>
                        <span className={['font-bold whitespace-nowrap', r.bought ? 'text-crema/40' : 'text-horno'].join(' ')}>
                          {formatQty(r.buy, r.unit)}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex gap-2">
                  <button onClick={printList} className="flex-1 flex items-center justify-center gap-1.5 rounded-full bg-crema text-carbon px-4 py-2.5 text-sm font-semibold">
                    <Printer className="w-4 h-4" /> Imprimir
                  </button>
                  <button onClick={copyList} className="flex-1 flex items-center justify-center gap-1.5 rounded-full border border-crema/25 px-4 py-2.5 text-sm font-semibold">
                    {copied ? <><Check className="w-4 h-4" /> Copiada</> : <><Copy className="w-4 h-4" /> Copiar</>}
                  </button>
                </div>
              </>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}

/* Se guarda al salir del campo o al pulsar Intro, no en cada tecla. */
function CountInput({ value, unit, label, onCommit }) {
  const [draft, setDraft] = useState(value === null ? '' : String(value).replace('.', ','))
  const [invalid, setInvalid] = useState(false)

  const commit = () => {
    const qty = parseQty(draft)
    if (draft.trim() !== '' && qty === null) { setInvalid(true); return }
    setInvalid(false)
    if (qty !== (value === null ? null : Number(value))) onCommit(qty)
  }

  return (
    <span className="flex items-center gap-1.5">
      <input
        inputMode="decimal"
        value={draft}
        aria-label={label}
        aria-invalid={invalid}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
        placeholder="—"
        className={[
          'w-24 rounded-xl border bg-white/70 px-3 py-2.5 text-right text-lg font-semibold text-carbon outline-none',
          invalid ? 'border-tomate' : 'border-carbon/15 focus:border-tomate',
        ].join(' ')}
      />
      <span className="mono normal-case text-carbon/55 w-14">{unit}</span>
    </span>
  )
}

/* Alta, cambio y baja de productos con su objetivo diario. */
function ItemManager({ locId, items, onChange, onError }) {
  const [adding, setAdding] = useState(false)

  const save = async (item) => {
    const { item: saved } = await stockAction(locId, 'saveItem', item)
    onChange(item.id ? items.map((i) => (i.id === saved.id ? saved : i)) : [...items, saved])
  }

  const remove = async (item) => {
    if (!window.confirm(`¿Quitar "${item.name}" de la lista? Se borra también su historial.`)) return
    try {
      await stockAction(locId, 'deleteItem', { id: item.id })
      onChange(items.filter((i) => i.id !== item.id))
    } catch (err) {
      onError(err.message)
    }
  }

  return (
    <div className="flex flex-col gap-2 max-w-2xl">
      <p className="text-sm text-carbon/60">
        El objetivo es lo que tiene que haber cada día al empezar. La compra se calcula sola: objetivo − lo que hay.
      </p>
      {items.map((item) => (
        <ItemRow key={item.id} item={item} onSave={save} onDelete={() => remove(item)} onError={onError} />
      ))}
      {adding ? (
        <ItemRow
          item={{ name: '', unit: 'kg', target: '' }}
          onSave={async (item) => { await save(item); setAdding(false) }}
          onDelete={() => setAdding(false)}
          onError={onError}
          isNew
        />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="mt-2 self-start flex items-center gap-1.5 rounded-full bg-carbon text-crema px-4 py-2.5 text-sm font-semibold"
        >
          <Plus className="w-4 h-4" /> Añadir producto
        </button>
      )}
    </div>
  )
}

function ItemRow({ item, onSave, onDelete, onError, isNew = false }) {
  const [name, setName] = useState(item.name)
  const [unit, setUnit] = useState(item.unit)
  const [target, setTarget] = useState(item.target === '' ? '' : String(item.target).replace('.', ','))
  const [saving, setSaving] = useState(false)
  const dirty = isNew || name !== item.name || unit !== item.unit || parseQty(target) !== Number(item.target)

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave({ id: item.id, name, unit, target })
    } catch (err) {
      onError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="rounded-card border border-carbon/10 bg-crema p-3 flex flex-wrap items-end gap-2">
      <label className="flex-1 min-w-[10rem]">
        <span className="mono normal-case text-xs text-carbon/50">Producto</span>
        <input value={name} onChange={(e) => setName(e.target.value)} autoFocus={isNew} maxLength={60}
          className="mt-1 w-full rounded-xl border border-carbon/15 bg-white/70 px-3 py-2 text-sm outline-none focus:border-tomate" />
      </label>
      <label className="w-24">
        <span className="mono normal-case text-xs text-carbon/50">Objetivo</span>
        <input value={target} onChange={(e) => setTarget(e.target.value)} inputMode="decimal"
          className="mt-1 w-full rounded-xl border border-carbon/15 bg-white/70 px-3 py-2 text-sm text-right outline-none focus:border-tomate" />
      </label>
      <label className="w-28">
        <span className="mono normal-case text-xs text-carbon/50">Unidad</span>
        <input value={unit} onChange={(e) => setUnit(e.target.value)} list="stock-units" maxLength={12}
          className="mt-1 w-full rounded-xl border border-carbon/15 bg-white/70 px-3 py-2 text-sm outline-none focus:border-tomate" />
      </label>
      <datalist id="stock-units">{UNITS.map((u) => <option key={u} value={u} />)}</datalist>
      <button type="submit" disabled={!dirty || saving}
        className="rounded-full bg-albahaca text-crema px-4 py-2 text-sm font-semibold disabled:opacity-30">
        {saving ? '…' : 'Guardar'}
      </button>
      <button type="button" onClick={onDelete} aria-label={isNew ? 'Cancelar' : `Quitar ${item.name}`}
        className="w-9 h-9 rounded-full flex items-center justify-center text-carbon/40 hover:text-tomate hover:bg-tomate/5">
        {isNew ? <X className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
      </button>
    </form>
  )
}
