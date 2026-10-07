import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Download, Printer, AlertTriangle, FileSpreadsheet } from 'lucide-react'
import { price } from '../lib/format'
import { serviceDay } from '../lib/orderNumber'
import { IVA_RATE, fiscalOf } from '../lib/fiscal'
import { getLocation } from '../data/locations'
import { fetchBilling } from './api'
import { CANCEL_LABEL } from './CancelReasons'
import { buildXlsx, downloadBlob } from '../lib/xlsx'
import {
  buildReport, reportSheets, quarterRange, monthRange, defaultQuarter, esDate, monthLabel,
} from './gestorReport'

/* ═══════════════════════════════════════════════════════════════
   PARA EL GESTOR — solo super admin
   Se elige el periodo (trimestre, mes, semana o fechas sueltas) y se
   descarga el Excel con todo lo que pide la gestoría: resumen con
   base e IVA, por mes / semana / día, el libro de facturas ticket a
   ticket y los anulados. También se puede imprimir o guardar en PDF.
   ═══════════════════════════════════════════════════════════════ */

const QUARTERS = [
  { q: 1, label: 'T1', months: 'ene – mar' },
  { q: 2, label: 'T2', months: 'abr – jun' },
  { q: 3, label: 'T3', months: 'jul – sep' },
  { q: 4, label: 'T4', months: 'oct – dic' },
]
const KINDS = [
  { id: 'trimestre', label: 'TRIMESTRE' },
  { id: 'mes', label: 'MES' },
  { id: 'semana', label: 'SEMANA' },
  { id: 'fechas', label: 'FECHAS' },
]
const FIRST_YEAR = 2025

const addDays = (day, delta) => {
  const d = new Date(`${day}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + delta)
  return d.toISOString().slice(0, 10)
}
const mondayOf = (day) => addDays(day, -((new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7))

export default function Accounting({ locationId, onError }) {
  const today = serviceDay()
  const start = defaultQuarter(today)
  const [kind, setKind] = useState('trimestre')
  const [year, setYear] = useState(start.year)
  const [quarter, setQuarter] = useState(start.q)
  const [month, setMonth] = useState(today.slice(0, 7))
  const [weekDay, setWeekDay] = useState(today)
  const [custom, setCustom] = useState({ from: `${today.slice(0, 7)}-01`, to: today })
  const [detail, setDetail] = useState('mes')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const range = kind === 'trimestre' ? quarterRange(year, quarter)
    : kind === 'mes' ? monthRange(month)
      : kind === 'semana' ? { from: mondayOf(weekDay), to: addDays(mondayOf(weekDay), 6) }
        : custom
  const title = kind === 'trimestre' ? `${quarter}T ${year}`
    : kind === 'mes' ? monthLabel(month).replace(/^./, (c) => c.toUpperCase())
      : `${esDate(range.from)} – ${esDate(range.to)}`

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchBilling({ ...range, location: locationId, tickets: true })
      .then((d) => { if (!cancelled) setData(d) })
      .catch((err) => { if (!cancelled) onError(err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [range.from, range.to, locationId]) // eslint-disable-line react-hooks/exhaustive-deps

  const report = useMemo(
    () => (data?.tickets ? buildReport(data.tickets, { from: range.from, to: range.to, locationId }) : null),
    [data, locationId], // eslint-disable-line react-hooks/exhaustive-deps
  )

  /* Mes / semana / día: el desglose que tiene sentido para el periodo */
  const details = kind === 'trimestre' || kind === 'fechas' ? ['mes', 'semana', 'dia'] : kind === 'mes' ? ['semana', 'dia'] : ['dia']
  const shownDetail = details.includes(detail) ? detail : details[0]
  const groups = report ? { mes: report.byMonth, semana: report.byWeek, dia: report.byDay }[shownDetail] : []

  const fileBase = `Nonno ${title}${locationId ? ` ${getLocation(locationId)?.name}` : ''}`.replace(/[^\w\sáéíóúñÁÉÍÓÚÑ–-]/g, '').replace(/\s+/g, ' ').trim()
  const generatedAt = new Date().toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Madrid' })

  const downloadExcel = () => {
    const blob = buildXlsx(reportSheets(report, { title, generatedAt, cancelLabel: CANCEL_LABEL }))
    downloadBlob(blob, `${fileBase}.xlsx`)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Tipo de periodo */}
      <div className="flex flex-wrap items-center gap-2">
        {KINDS.map((k) => (
          <button key={k.id} onClick={() => setKind(k.id)} className={`ptab soft ${kind === k.id ? 'is-on' : ''}`}>{k.label}</button>
        ))}
      </div>

      {/* Selector del periodo */}
      <div className="pcard p-4 sm:p-5">
        {kind === 'trimestre' && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1">
              <button onClick={() => setYear((y) => y - 1)} disabled={year <= FIRST_YEAR} className="w-10 h-10 rounded-md border border-tomate/40 flex items-center justify-center text-tomate disabled:opacity-30" aria-label="Año anterior">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="w-16 text-center font-sans font-extrabold text-xl text-carbon">{year}</span>
              <button onClick={() => setYear((y) => y + 1)} disabled={year >= Number(today.slice(0, 4))} className="w-10 h-10 rounded-md border border-tomate/40 flex items-center justify-center text-tomate disabled:opacity-30" aria-label="Año siguiente">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2 flex-1 min-w-[16rem]">
              {QUARTERS.map((q) => {
                const future = quarterRange(year, q.q).from > today
                const on = quarter === q.q
                return (
                  <button
                    key={q.q}
                    onClick={() => setQuarter(q.q)}
                    disabled={future}
                    aria-pressed={on}
                    className={[
                      'rounded-md border-2 px-2 py-2 text-center transition-colors disabled:opacity-30',
                      on ? 'border-tomate bg-tomate text-papel' : 'border-tomate/40 text-carbon hover:border-tomate',
                    ].join(' ')}
                  >
                    <span className="block font-sans font-extrabold text-lg leading-none">{q.label}</span>
                    <span className={`block mt-1 text-[0.7rem] font-semibold uppercase ${on ? 'text-papel/80' : 'text-carbon/50'}`}>{q.months}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
        {kind === 'mes' && (
          <label className="flex items-center gap-3">
            <span className="mono text-tomate">MES</span>
            <input type="month" value={month} max={today.slice(0, 7)} onChange={(e) => e.target.value && setMonth(e.target.value)} className="pfield !w-auto !py-2" />
          </label>
        )}
        {kind === 'semana' && (
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={() => setWeekDay((d) => addDays(d, -7))} className="w-10 h-10 rounded-md border border-tomate/40 flex items-center justify-center text-tomate" aria-label="Semana anterior">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-sans font-bold text-carbon">Del lunes {esDate(range.from)} al domingo {esDate(range.to)}</span>
            <button onClick={() => setWeekDay((d) => addDays(d, 7))} disabled={addDays(range.from, 7) > today} className="w-10 h-10 rounded-md border border-tomate/40 flex items-center justify-center text-tomate disabled:opacity-30" aria-label="Semana siguiente">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
        {kind === 'fechas' && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="mono text-tomate mr-1">DEL</span>
            <input type="date" value={custom.from} max={custom.to} onChange={(e) => e.target.value && setCustom((c) => ({ ...c, from: e.target.value }))} className="pfield !w-auto !py-2" />
            <span className="mono text-tomate mx-1">AL</span>
            <input type="date" value={custom.to} min={custom.from} max={today} onChange={(e) => e.target.value && setCustom((c) => ({ ...c, to: e.target.value }))} className="pfield !w-auto !py-2" />
          </div>
        )}
      </div>

      {loading || !report ? (
        <p className="mono text-carbon/40 py-16 text-center">CALCULANDO…</p>
      ) : (
        <>
          {/* Totales del periodo y descargas */}
          <section className="pframe">
            <div className="pframe-in p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="mono text-tomate">{title} · del {esDate(report.from)} al {esDate(report.to)}</p>
                  <p className="mt-2 font-serif italic font-semibold text-4xl text-carbon">{price(report.totals.total)}</p>
                  <p className="mt-1 text-sm text-carbon/60">facturado · {report.totals.tickets} ticket{report.totals.tickets === 1 ? '' : 's'}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={downloadExcel} disabled={!report.totals.tickets && !report.cancelled.length} className="btn bg-tomate text-crema disabled:opacity-40">
                    <span className="btn-layer bg-forno" />
                    <span className="btn-label inline-flex items-center gap-2"><Download className="w-4 h-4" /> DESCARGAR EXCEL</span>
                  </button>
                  <button onClick={() => printReport(report, { title, generatedAt })} disabled={!report.totals.tickets} className="inline-flex items-center gap-2 rounded-md border-2 border-tomate px-4 min-h-[44px] font-sans font-bold text-tomate hover:bg-tomate/10 disabled:opacity-40">
                    <Printer className="w-4 h-4" /> IMPRIMIR / PDF
                  </button>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-3">
                <Figure label="BASE IMPONIBLE" value={price(report.totals.base)} />
                <Figure label={`IVA ${IVA_RATE} %`} value={price(report.totals.iva)} />
                <Figure label="TOTAL" value={price(report.totals.total)} />
              </div>

              {report.sedes.length > 1 && (
                <div className="mt-5 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left mono text-tomate">
                        <th className="py-2 pr-3 font-normal">SEDE</th>
                        <th className="py-2 px-3 font-normal text-right">TICKETS</th>
                        <th className="py-2 px-3 font-normal text-right">BASE</th>
                        <th className="py-2 px-3 font-normal text-right">IVA</th>
                        <th className="py-2 pl-3 font-normal text-right">TOTAL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.sedes.map((id) => {
                        const b = report.bySede[id]
                        return (
                          <tr key={id} className="border-t border-tomate/20">
                            <td className="py-2 pr-3 font-bold text-carbon">{getLocation(id)?.name}</td>
                            <td className="py-2 px-3 text-right text-carbon/70">{b.tickets}</td>
                            <td className="py-2 px-3 text-right text-carbon/70">{price(b.base)}</td>
                            <td className="py-2 px-3 text-right text-carbon/70">{price(b.iva)}</td>
                            <td className="py-2 pl-3 text-right font-bold text-carbon">{price(b.total)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          {/* Avisos antes de mandarlo */}
          {report.totals.pending > 0 && (
            <p className="palert flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>Hay {price(report.totals.pending)} en pedidos que no están marcados como cobrados. Cuentan como facturados, pero revisa en el mostrador si hay alguno que se cobró y no se marcó antes de mandarlo al gestor.</span>
            </p>
          )}
          {!fiscalOf(report.sedes[0]) && (
            <p className="palert">Faltan los datos fiscales (razón social y CIF) en src/lib/fiscal.js.</p>
          )}

          {/* Desglose */}
          <section className="pcard p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <p className="mono text-tomate">DESGLOSE</p>
              <div className="flex gap-1.5">
                {details.map((d) => (
                  <button key={d} onClick={() => setDetail(d)} className={`ptab soft ${shownDetail === d ? 'is-on' : ''}`}>
                    {{ mes: 'POR MES', semana: 'POR SEMANA', dia: 'POR DÍA' }[d]}
                  </button>
                ))}
              </div>
            </div>
            {groups.length === 0 ? (
              <p className="text-carbon/45 text-sm py-4">Sin tickets en este periodo.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left mono text-tomate">
                      <th className="py-2 pr-3 font-normal">PERIODO</th>
                      {report.sedes.length > 1 && report.sedes.map((id) => (
                        <th key={id} className="py-2 px-3 font-normal text-right whitespace-nowrap">{getLocation(id)?.name.replace(' la Verde', '').toUpperCase()}</th>
                      ))}
                      <th className="py-2 px-3 font-normal text-right">BASE</th>
                      <th className="py-2 px-3 font-normal text-right">IVA</th>
                      <th className="py-2 pl-3 font-normal text-right">TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((g) => (
                      <tr key={g.key} className="border-t border-tomate/20">
                        <td className="py-2 pr-3 font-semibold text-carbon capitalize whitespace-nowrap">{g.label}</td>
                        {report.sedes.length > 1 && report.sedes.map((id) => (
                          <td key={id} className="py-2 px-3 text-right text-carbon/60">{g.bySede[id] ? price(g.bySede[id].total) : '—'}</td>
                        ))}
                        <td className="py-2 px-3 text-right text-carbon/70">{price(g.all.base)}</td>
                        <td className="py-2 px-3 text-right text-carbon/70">{price(g.all.iva)}</td>
                        <td className="py-2 pl-3 text-right font-bold text-carbon">{price(g.all.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <p className="flex items-start gap-2 text-sm text-carbon/60">
            <FileSpreadsheet className="w-4 h-4 mt-0.5 flex-shrink-0 text-tomate" />
            <span>
              El Excel lleva seis hojas: resumen con base e IVA por sede, por mes, por semana, por día, el libro de facturas
              (cada ticket con su número, fecha, base, IVA y total) y los pedidos anulados ({report.cancelled.length}).
              Es lo que necesita el gestor para la declaración trimestral del IVA.
            </span>
          </p>
        </>
      )}
    </div>
  )
}

function Figure({ label, value }) {
  return (
    <div className="rounded-md border border-tomate/30 p-3">
      <p className="mono text-tomate text-[0.62rem]">{label}</p>
      <p className="mt-1 font-sans font-extrabold text-lg sm:text-xl text-carbon">{value}</p>
    </div>
  )
}

/* ── Imprimir / guardar en PDF ─────────────────────────────────── */
const escHtml = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

function printReport(rep, { title, generatedAt }) {
  const fiscal = fiscalOf(rep.sedes[0])
  const name = (id) => escHtml(getLocation(id)?.name || id)
  const both = rep.sedes.length > 1
  const row = (label, b, bold) => `<tr${bold ? ' class="b"' : ''}><td>${label}</td><td class="n">${b.tickets}</td><td class="n">${price(b.base)}</td><td class="n">${price(b.iva)}</td><td class="n">${price(b.total)}</td><td class="n">${price(b.cash)}</td><td class="n">${price(b.card)}</td><td class="n">${price(b.pending)}</td></tr>`
  const table = (groups) => groups.map((g) => (both
    ? rep.sedes.filter((id) => g.bySede[id]).map((id) => row(`${escHtml(g.label)} · ${name(id)}`, g.bySede[id])).join('') + row(`${escHtml(g.label)} · Total`, g.all, true)
    : row(escHtml(g.label), g.all))).join('')
  const thead = `<thead><tr><th></th><th class="n">Tickets</th><th class="n">Base</th><th class="n">IVA ${IVA_RATE} %</th><th class="n">Total</th><th class="n">Efectivo</th><th class="n">Tarjeta</th><th class="n">Pendiente</th></tr></thead>`

  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Nonno · ${escHtml(title)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  body { font: 11px/1.4 system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #111; }
  h1 { font-size: 20px; margin: 0 0 2px; } h2 { font-size: 13px; margin: 22px 0 6px; text-transform: uppercase; letter-spacing: .06em; color: #c22; }
  .muted { color: #555; margin: 0; }
  table { width: 100%; border-collapse: collapse; } th, td { padding: 4px 6px; border-bottom: 1px solid #ddd; text-align: left; }
  th { font-size: 10px; text-transform: uppercase; color: #555; border-bottom: 1.5px solid #c22; }
  .n { text-align: right; white-space: nowrap; } .b td { font-weight: 700; background: #f7eded; }
  .big { display: flex; gap: 10px; margin-top: 14px; } .big div { flex: 1; border: 1.5px solid #c22; border-radius: 6px; padding: 8px 10px; }
  .big span { display: block; font-size: 9px; text-transform: uppercase; letter-spacing: .08em; color: #c22; } .big strong { font-size: 17px; }
  .foot { margin-top: 20px; color: #666; font-size: 10px; }
</style></head><body>
<h1>La Pizza de Nonno · ${escHtml(title)}</h1>
<p class="muted">${fiscal ? `${escHtml(fiscal.name)} · CIF ${escHtml(fiscal.nif)} · ${escHtml(fiscal.address)}` : ''}</p>
<p class="muted">Del ${esDate(rep.from)} al ${esDate(rep.to)} · ${both ? 'Sangonera la Verde y Santo Ángel' : name(rep.sedes[0])}</p>
<div class="big">
  <div><span>Base imponible</span><strong>${price(rep.totals.base)}</strong></div>
  <div><span>IVA ${IVA_RATE} %</span><strong>${price(rep.totals.iva)}</strong></div>
  <div><span>Total facturado</span><strong>${price(rep.totals.total)}</strong></div>
  <div><span>Tickets</span><strong>${rep.totals.tickets}</strong></div>
</div>
<h2>Por sede</h2>
<table>${thead}<tbody>${rep.sedes.map((id) => row(name(id), rep.bySede[id])).join('')}${both ? row('Total', rep.totals, true) : ''}</tbody></table>
<h2>Por mes</h2><table>${thead}<tbody>${table(rep.byMonth)}</tbody></table>
<h2>Por semana</h2><table>${thead}<tbody>${table(rep.byWeek)}</tbody></table>
<p class="foot">Facturas simplificadas con IVA del ${IVA_RATE} % incluido. Pedidos anulados (no facturan): ${rep.cancelled.length} · ${price(rep.cancelledTotal)}.
El detalle ticket a ticket está en el Excel (hoja "Libro de facturas"). Generado el ${escHtml(generatedAt)}.</p>
<script>window.onload = () => { window.print() }</script>
</body></html>`

  const w = window.open('', '_blank')
  if (!w) return
  w.document.open()
  w.document.write(html)
  w.document.close()
}
