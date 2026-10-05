import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, Check, ClipboardList, Plus, Wrench } from 'lucide-react'
import { getLocation } from '../data/locations'
import { serviceDay } from '../lib/orderNumber'
import { fetchMaintenance, saveMaintenance } from './api'

const today = () => serviceDay()
const currentMonth = () => today().slice(0, 7)
const monthLastDay = (month) => {
  const [year, number] = month.split('-').map(Number)
  return new Date(Date.UTC(year, number, 0)).toISOString().slice(0, 10)
}
const readableDate = (day) => new Date(`${day}T12:00:00`).toLocaleDateString('es-ES', {
  weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
})
const emptyForm = (location, month, id = null, date = null) => ({
  id,
  location,
  maintenanceDate: date || (month === currentMonth() ? today() : `${month}-01`),
  responsible: '',
  tasks: '',
  incident: '',
  completed: false,
})

export default function Maintenance({ locationIds, onError }) {
  const [month, setMonth] = useState(currentMonth)
  const [records, setRecords] = useState({})
  const [form, setForm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const locationsKey = useMemo(() => locationIds.join('|'), [locationIds])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await Promise.all(locationIds.map(async (id) => [id, (await fetchMaintenance(id, month)).records]))
      setRecords(Object.fromEntries(rows))
    } catch (error) {
      onError(error.message)
    } finally {
      setLoading(false)
    }
  }, [locationsKey, month]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { refresh() }, [refresh])

  const submit = async (event) => {
    event.preventDefault()
    if (!form || busy) return
    setBusy(true)
    setSaved(false)
    try {
      const { record } = await saveMaintenance(form.location, form)
      setRecords((all) => ({
        ...all,
        [form.location]: [...(all[form.location] || []).filter((row) => row.id !== record.id), record]
          .sort((a, b) => a.maintenance_date.localeCompare(b.maintenance_date)),
      }))
      setForm(null)
      setSaved(true)
    } catch (error) {
      onError(error.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="pcard flex flex-col gap-4 p-4 sm:flex-row sm:items-end sm:justify-between sm:p-5">
        <div>
          <p className="mono text-tomate">CUIDADO DE LOS LOCALES</p>
          <h2 className="mt-1 font-serif text-2xl font-bold text-carbon">Mantenimiento mensual</h2>
          <p className="mt-1 max-w-2xl text-sm text-carbon/60">Anota la fecha, quién se encarga, las tareas y cualquier incidencia de cada sede. No incluyas datos de clientes.</p>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold text-carbon">
          <CalendarDays className="h-4 w-4 text-tomate" />
          <span>Mes</span>
          <input type="month" value={month} onChange={(event) => { setMonth(event.target.value); setForm(null) }} className="pfield !w-auto !py-2" aria-label="Mes de mantenimiento" />
        </label>
      </section>

      {saved && <p role="status" className="flex items-center gap-2 rounded-md border border-albahaca/40 bg-albahaca/10 px-4 py-3 text-sm font-semibold text-albahaca"><Check className="h-4 w-4" /> Mantenimiento guardado.</p>}

      {loading ? <p className="mono py-12 text-center text-carbon/40">CARGANDO MANTENIMIENTOS…</p> : (
        <div className="grid gap-5 xl:grid-cols-2">
          {locationIds.map((locationId) => {
            const rows = records[locationId] || []
            const editing = form?.location === locationId
            return (
              <section key={locationId} className="pcard p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="mono text-tomate">SEDE</p>
                    <h3 className="mt-1 font-serif text-xl font-bold text-carbon">{getLocation(locationId)?.name || locationId}</h3>
                  </div>
                  {!editing && <button onClick={() => setForm(emptyForm(locationId, month))} className="ptab soft shrink-0"><Plus className="h-4 w-4" /> Añadir plan</button>}
                </div>

                {editing && (
                  <form onSubmit={submit} className="mt-4 flex flex-col gap-3 rounded-md border border-tomate/25 bg-masa p-3 sm:p-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="flex flex-col gap-1 text-sm font-semibold text-carbon">Fecha
                        <input required type="date" min={`${month}-01`} max={monthLastDay(month)} value={form.maintenanceDate} onChange={(event) => setForm((value) => ({ ...value, maintenanceDate: event.target.value }))} className="pfield" />
                      </label>
                      <label className="flex flex-col gap-1 text-sm font-semibold text-carbon">Responsable
                        <input required maxLength={120} value={form.responsible} onChange={(event) => setForm((value) => ({ ...value, responsible: event.target.value }))} className="pfield" placeholder="Nombre" />
                      </label>
                    </div>
                    <label className="flex flex-col gap-1 text-sm font-semibold text-carbon">Tareas
                      <textarea required maxLength={4000} rows={3} value={form.tasks} onChange={(event) => setForm((value) => ({ ...value, tasks: event.target.value }))} className="pfield resize-y" placeholder="Tareas previstas o realizadas" />
                    </label>
                    <label className="flex flex-col gap-1 text-sm font-semibold text-carbon">Incidencias <span className="font-normal text-carbon/50">(opcional)</span>
                      <textarea maxLength={2000} rows={2} value={form.incident} onChange={(event) => setForm((value) => ({ ...value, incident: event.target.value }))} className="pfield resize-y" placeholder="Anota cualquier incidencia" />
                    </label>
                    <label className="flex items-center gap-2 text-sm font-semibold text-carbon"><input type="checkbox" checked={form.completed} onChange={(event) => setForm((value) => ({ ...value, completed: event.target.checked }))} className="h-4 w-4 accent-albahaca" /> Mantenimiento realizado</label>
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => setForm(null)} className="ptab soft">Cancelar</button>
                      <button disabled={busy} className="ptab bg-tomate text-masa disabled:opacity-50">{busy ? 'Guardando…' : 'Guardar'}</button>
                    </div>
                  </form>
                )}

                {!rows.length && !editing ? <p className="mt-4 rounded-md border border-dashed border-carbon/20 p-4 text-sm text-carbon/55">No hay mantenimientos apuntados en este mes.</p> : (
                  <ul className="mt-4 flex flex-col gap-3">
                    {rows.map((row) => (
                      <li key={row.id} className="rounded-md border border-tomate/20 p-3 sm:p-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold capitalize text-carbon">{readableDate(row.maintenance_date)}</p>
                            <p className="mt-0.5 text-sm text-carbon/60">Responsable: {row.responsible}</p>
                          </div>
                          <span className={['inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold', row.completed_at ? 'bg-albahaca/10 text-albahaca' : 'bg-horno/15 text-horno'].join(' ')}>
                            {row.completed_at ? <Check className="h-3.5 w-3.5" /> : <Wrench className="h-3.5 w-3.5" />}{row.completed_at ? 'Realizado' : 'Previsto'}
                          </span>
                        </div>
                        <p className="mt-3 flex items-start gap-2 whitespace-pre-line text-sm text-carbon/80"><ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-tomate" />{row.tasks}</p>
                        {row.incident && <p className="mt-2 border-l-2 border-horno pl-3 text-sm text-carbon/70"><strong>Incidencia:</strong> {row.incident}</p>}
                        <button onClick={() => setForm({ id: row.id, location: locationId, maintenanceDate: row.maintenance_date, responsible: row.responsible, tasks: row.tasks, incident: row.incident || '', completed: Boolean(row.completed_at) })} className="mt-3 mono normal-case text-xs text-carbon/55 hover:text-tomate">Editar registro</button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
