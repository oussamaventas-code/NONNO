import { useEffect, useMemo, useState } from 'react'
import { Plus, Percent, Euro, Pencil, Trash2, X, Search, Check, CalendarClock, Tag } from 'lucide-react'
import { CATEGORIES, allProducts } from '../data/menu'
import { discounted, discountLabel, appliesTo } from '../lib/discounts'
import { price } from '../lib/format'
import { fetchDiscounts, saveDiscount, deleteDiscount } from './api'

/* ═══════════════════════════════════════════════════════════════
   DESCUENTOS (solo dirección)
   Se crean aquí y rebajan el precio en la web, el mostrador y al
   cobrar. Un descuento: nombre, % o €, a qué se aplica (toda la carta,
   categorías o productos) y cuándo (ya, o entre dos fechas). Se puede
   apagar y encender con un toque sin borrarlo.
   ═══════════════════════════════════════════════════════════════ */

const QUICK = { percent: [10, 15, 20, 25, 50], amount: [1, 2, 3, 5] }

const EMPTY = { id: null, name: '', kind: 'percent', value: '', target: 'all', targetIds: [], startsAt: '', endsAt: '', active: true, withDates: false }

/* datetime-local ⇄ ISO, en la hora del móvil */
const toLocalInput = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null)
const when = (iso) => new Date(iso).toLocaleString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/** Precio de carta, sin el descuento que ya tenga en vigor. */
const cartaPrice = (p) => p.priceBefore ?? p.price

function statusOf(d, now = Date.now()) {
  if (!d.active) return { label: 'Apagado', tone: 'text-carbon/60 border-carbon/30' }
  if (d.endsAt && Date.parse(d.endsAt) <= now) return { label: 'Terminado', tone: 'text-carbon/60 border-carbon/30' }
  if (d.startsAt && Date.parse(d.startsAt) > now) return { label: `Empieza ${when(d.startsAt)}`, tone: 'text-horno border-horno' }
  return { label: 'En marcha', tone: 'text-albahaca border-albahaca' }
}

function targetText(d) {
  if (d.target === 'all') return 'Toda la carta'
  if (d.target === 'categories') {
    return d.targetIds.map((id) => CATEGORIES.find((c) => c.id === id)?.label.toLowerCase() || id).join(', ')
  }
  const names = d.targetIds.map((id) => allProducts().find((p) => p.id === id)?.name || id)
  return names.length > 3 ? `${names.slice(0, 3).join(', ')} y ${names.length - 3} más` : names.join(', ')
}

export default function Discounts({ onError, onChanged }) {
  const [list, setList] = useState(null)
  const [missingTable, setMissingTable] = useState(false)
  const [editing, setEditing] = useState(null)
  const [busy, setBusy] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  const apply = (data) => {
    setList(data.discounts || [])
    setMissingTable(Boolean(data.missingTable))
  }

  useEffect(() => {
    fetchDiscounts().then(apply).catch((err) => { onError(err.message); setList([]) })
  }, [onError])

  const run = async (key, fn) => {
    setBusy(key)
    try {
      apply(await fn())
      onChanged?.()
      return true
    } catch (err) {
      onError(err.message)
      return false
    } finally {
      setBusy(null)
    }
  }

  const toggle = (d) => run(`toggle:${d.id}`, () => saveDiscount({ ...d, active: !d.active }))
  const remove = (d) => run(`delete:${d.id}`, () => deleteDiscount(d.id)).then(() => setConfirmDelete(null))

  if (editing) {
    return (
      <DiscountEditor
        initial={editing}
        saving={busy === 'save'}
        onCancel={() => setEditing(null)}
        onSave={async (d) => { if (await run('save', () => saveDiscount(d))) setEditing(null) }}
      />
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-sans font-extrabold uppercase text-2xl text-tomate leading-none">Descuentos</h2>
          <p className="mt-1.5 text-sm text-carbon/60">Rebajan el precio en la web, en el mostrador y al cobrar.</p>
        </div>
      </div>

      <button
        onClick={() => setEditing(EMPTY)}
        disabled={missingTable}
        className="btn bg-tomate w-full mt-5 min-h-[60px] !text-base disabled:opacity-40"
      >
        <span className="btn-layer bg-forno" />
        <span className="btn-label"><Plus className="w-5 h-5" /> CREAR DESCUENTO</span>
      </button>

      {missingTable && (
        <p className="palert mt-4">Para usar los descuentos, ejecuta una vez <strong>supabase/descuentos.sql</strong> en Supabase (SQL Editor → New query → pegar → Run).</p>
      )}

      {list === null ? (
        <p className="mono text-carbon/40 py-12 text-center">CARGANDO…</p>
      ) : list.length === 0 ? (
        !missingTable && (
          <p className="mt-6 rounded-md border border-dashed border-tomate/40 py-10 px-4 text-center text-carbon/60">
            Todavía no hay descuentos. Crea uno y la web lo aplica al momento.
          </p>
        )
      ) : (
        <ul className="mt-6 flex flex-col gap-4">
          {list.map((d) => {
            const st = statusOf(d)
            return (
              <li key={d.id} className="pcard p-4">
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 rounded-lg bg-[rgb(255_228_60)] text-[#0C0C0C] font-sans font-extrabold text-xl px-3 py-2 leading-none">
                    {discountLabel(d)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-sans font-extrabold uppercase text-lg text-carbon leading-tight break-words">{d.name}</p>
                    <p className="mt-0.5 text-sm text-carbon/70 break-words">{targetText(d)}</p>
                    <span className={`mt-2 inline-block rounded-full border px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide ${st.tone}`}>{st.label}</span>
                    {d.endsAt && Date.parse(d.endsAt) > Date.now() && (
                      <p className="mt-1 mono normal-case text-carbon/50">hasta {when(d.endsAt)}</p>
                    )}
                  </div>
                </div>

                {confirmDelete === d.id ? (
                  <div className="mt-4 rounded-md border border-tomate bg-tomate/10 p-3">
                    <p className="text-sm font-bold text-carbon">¿Borrar «{d.name}»? Los precios vuelven a los de la carta.</p>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <button onClick={() => remove(d)} disabled={busy === `delete:${d.id}`} className="ptab !min-h-[44px] !bg-tomate !border-tomate !text-masa">Sí, borrar</button>
                      <button onClick={() => setConfirmDelete(null)} className="ptab !min-h-[44px]">No</button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 grid grid-cols-[1fr_auto_auto] gap-2">
                    <button
                      onClick={() => toggle(d)}
                      disabled={busy === `toggle:${d.id}`}
                      aria-pressed={d.active}
                      className={['ptab !min-h-[48px] disabled:opacity-50', d.active ? '!bg-albahaca !border-albahaca !text-masa' : ''].join(' ')}
                    >
                      {d.active ? 'ENCENDIDO' : 'APAGADO'}
                    </button>
                    <button onClick={() => setEditing({ ...d, withDates: Boolean(d.startsAt || d.endsAt) })} className="ptab !min-h-[48px] !px-4" aria-label={`Editar ${d.name}`}>
                      <Pencil className="w-5 h-5" />
                    </button>
                    <button onClick={() => setConfirmDelete(d.id)} className="ptab !min-h-[48px] !px-4" aria-label={`Borrar ${d.name}`}>
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/* ── Formulario: de arriba abajo, una decisión por bloque ─────── */
function DiscountEditor({ initial, saving, onCancel, onSave }) {
  const [d, setD] = useState(() => ({
    ...initial,
    value: initial.value === '' ? '' : String(initial.value).replace('.', ','),
    startsAt: toLocalInput(initial.startsAt),
    endsAt: toLocalInput(initial.endsAt),
  }))
  const [query, setQuery] = useState('')
  const set = (patch) => setD((cur) => ({ ...cur, ...patch }))

  const value = Number(String(d.value).replace(',', '.'))
  const valid = d.name.trim() && value > 0 && (d.target === 'all' || d.targetIds.length > 0)

  const products = allProducts()
  const toggleId = (id) => set({ targetIds: d.targetIds.includes(id) ? d.targetIds.filter((x) => x !== id) : [...d.targetIds, id] })

  /* Cómo quedan los precios: lo último que se ve antes de guardar */
  const preview = useMemo(() => {
    if (!(value > 0)) return []
    const rule = { kind: d.kind, value, target: d.target, targetIds: d.targetIds }
    return products
      .filter((p) => appliesTo(rule, p))
      .map((p) => ({ id: p.id, name: p.name, before: cartaPrice(p), after: discounted(cartaPrice(p), rule) }))
  }, [value, d.kind, d.target, d.targetIds, products])

  const found = query.trim()
    ? products.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()))
    : products

  const submit = () => onSave({
    id: d.id,
    name: d.name.trim(),
    kind: d.kind,
    value,
    target: d.target,
    targetIds: d.target === 'all' ? [] : d.targetIds,
    startsAt: d.withDates ? fromLocalInput(d.startsAt) : null,
    endsAt: d.withDates ? fromLocalInput(d.endsAt) : null,
    active: d.active,
  })

  const step = 'mono text-tomate mb-2 block'

  return (
    <div className="max-w-2xl mx-auto pb-24 md:pb-0">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-sans font-extrabold uppercase text-2xl text-tomate leading-none">{d.id ? 'Editar descuento' : 'Nuevo descuento'}</h2>
        <button onClick={onCancel} className="ptab !px-3" aria-label="Cancelar"><X className="w-5 h-5" /></button>
      </div>

      {/* 1. Nombre */}
      <label className="block mt-6">
        <span className={step}>1 · NOMBRE</span>
        <input
          value={d.name}
          onChange={(e) => set({ name: e.target.value })}
          maxLength={60}
          placeholder="Ej.: Martes de pizza"
          className="pfield text-lg"
        />
        <span className="mt-1 block mono normal-case text-carbon/50">Lo ve el cliente junto al precio.</span>
      </label>

      {/* 2. Cuánto */}
      <div className="mt-6">
        <span className={step}>2 · ¿CUÁNTO?</span>
        <div className="grid grid-cols-2 gap-2">
          {[{ id: 'percent', label: 'Porcentaje', Icon: Percent }, { id: 'amount', label: 'Euros', Icon: Euro }].map(({ id, label, Icon }) => (
            <button key={id} onClick={() => set({ kind: id, value: '' })} aria-pressed={d.kind === id} className="ptab !min-h-[48px]">
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <input
            value={d.value}
            onChange={(e) => set({ value: e.target.value.replace(/[^\d.,]/g, '') })}
            inputMode="decimal"
            placeholder="0"
            aria-label="Cantidad del descuento"
            className="pfield !w-32 text-3xl font-extrabold text-center"
          />
          <span className="font-sans font-extrabold text-3xl text-carbon">{d.kind === 'percent' ? '%' : '€'}</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {QUICK[d.kind].map((q) => (
            <button key={q} onClick={() => set({ value: String(q) })} aria-pressed={value === q} className="ptab soft !min-h-[40px]">
              {d.kind === 'percent' ? `${q} %` : `${q} €`}
            </button>
          ))}
        </div>
      </div>

      {/* 3. A qué */}
      <div className="mt-6">
        <span className={step}>3 · ¿A QUÉ SE APLICA?</span>
        <div className="grid grid-cols-3 gap-2">
          {[{ id: 'all', label: 'Toda la carta' }, { id: 'categories', label: 'Categorías' }, { id: 'products', label: 'Productos' }].map((t) => (
            <button key={t.id} onClick={() => set({ target: t.id, targetIds: [] })} aria-pressed={d.target === t.id} className="ptab !min-h-[48px] !px-1 !text-[0.7rem]">
              {t.label}
            </button>
          ))}
        </div>

        {d.target === 'categories' && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            {CATEGORIES.map((c) => (
              <button key={c.id} onClick={() => toggleId(c.id)} aria-pressed={d.targetIds.includes(c.id)} className="ptab soft !min-h-[48px] !justify-start text-left">
                {d.targetIds.includes(c.id) ? <Check className="w-4 h-4 flex-shrink-0" /> : <span className="w-4 flex-shrink-0" />}
                {c.label}
              </button>
            ))}
          </div>
        )}

        {d.target === 'products' && (
          <div className="mt-3">
            <label className="relative block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-carbon/40" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar producto" className="pfield !pl-9" />
            </label>
            {d.targetIds.length > 0 && (
              <p className="mt-2 mono normal-case text-carbon/60">{d.targetIds.length} elegido{d.targetIds.length > 1 ? 's' : ''}</p>
            )}
            <div className="mt-2 max-h-80 overflow-y-auto rounded-md border border-tomate/30 divide-y divide-tomate/15">
              {found.map((p) => {
                const on = d.targetIds.includes(p.id)
                return (
                  <button key={p.id} onClick={() => toggleId(p.id)} aria-pressed={on} className="flex w-full items-center gap-3 px-3 py-3 text-left">
                    <span className={['w-6 h-6 flex-shrink-0 rounded-md border-2 flex items-center justify-center', on ? 'border-albahaca bg-albahaca text-masa' : 'border-carbon/30'].join(' ')}>
                      {on && <Check className="w-4 h-4" />}
                    </span>
                    <span className="flex-1 min-w-0 font-semibold text-carbon truncate">{p.name}</span>
                    <span className="mono normal-case text-carbon/50">{price(cartaPrice(p))}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* 4. Cuándo */}
      <div className="mt-6">
        <span className={step}>4 · ¿CUÁNDO?</span>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => set({ withDates: false })} aria-pressed={!d.withDates} className="ptab !min-h-[48px]">Desde ya</button>
          <button onClick={() => set({ withDates: true })} aria-pressed={d.withDates} className="ptab !min-h-[48px]"><CalendarClock className="w-4 h-4" /> Con fechas</button>
        </div>
        {d.withDates && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block min-w-0">
              <span className="mono normal-case text-carbon/60">Empieza (vacío = ya)</span>
              <input type="datetime-local" value={d.startsAt} onChange={(e) => set({ startsAt: e.target.value })} className="pfield mt-1 w-full min-w-0" />
            </label>
            <label className="block min-w-0">
              <span className="mono normal-case text-carbon/60">Termina (vacío = sin fin)</span>
              <input type="datetime-local" value={d.endsAt} onChange={(e) => set({ endsAt: e.target.value })} className="pfield mt-1 w-full min-w-0" />
            </label>
          </div>
        )}
      </div>

      {/* Cómo queda */}
      {preview.length > 0 && (
        <div className="mt-6 pcard p-4">
          <p className="flex items-center gap-2 mono text-tomate"><Tag className="w-4 h-4" /> ASÍ QUEDA · {preview.length} producto{preview.length > 1 ? 's' : ''}</p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {preview.slice(0, 5).map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate text-carbon">{p.name}</span>
                <span className="flex-shrink-0 whitespace-nowrap">
                  <span className="line-through text-carbon/45 mr-2">{price(p.before)}</span>
                  <strong className="text-carbon">{price(p.after)}</strong>
                </span>
              </li>
            ))}
          </ul>
          {preview.length > 5 && <p className="mt-1.5 mono normal-case text-carbon/50">y {preview.length - 5} más</p>}
        </div>
      )}

      {/* Guardar: fijo abajo en el móvil, siempre a mano */}
      <div className="fixed md:static inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 bg-masa/95 md:bg-transparent border-t border-tomate/40 md:border-0 px-4 py-3 md:px-0 md:mt-6">
        <button onClick={submit} disabled={!valid || saving} className="btn bg-albahaca w-full min-h-[56px] !text-base disabled:opacity-40">
          <span className="btn-layer bg-forno" />
          <span className="btn-label"><Check className="w-5 h-5" /> {saving ? 'GUARDANDO…' : d.id ? 'GUARDAR CAMBIOS' : 'CREAR DESCUENTO'}</span>
        </button>
      </div>
    </div>
  )
}
