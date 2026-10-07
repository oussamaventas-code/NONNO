import { vatOf, IVA_RATE, fiscalOf } from '../lib/fiscal.js'
import { getLocation, LOCATIONS } from '../data/locations.js'

/* ═══════════════════════════════════════════════════════════════
   INFORME PARA EL GESTOR (super admin)

   A partir de los tickets de un rango (api/billing?export=1) calcula
   lo que pide la gestoría para el trimestre: base imponible, IVA del
   10 % y total, por sede y por mes / semana / día, y el libro de
   facturas emitidas ticket a ticket. Sin red ni React: se prueba solo.

   La base y el IVA se calculan ticket a ticket (como van impresos) y
   luego se suman, para que el libro y el resumen cuadren al céntimo.
   ═══════════════════════════════════════════════════════════════ */

const r2 = (n) => Math.round(n * 100) / 100

/* ── Periodos ──────────────────────────────────────────────────── */
const pad = (n) => String(n).padStart(2, '0')
const lastDayOfMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate()

/** T1..T4 de un año: { from, to } en días "2026-01-01". */
export const quarterRange = (year, q) => {
  const m1 = (q - 1) * 3 + 1
  const m3 = m1 + 2
  return { from: `${year}-${pad(m1)}-01`, to: `${year}-${pad(m3)}-${pad(lastDayOfMonth(year, m3))}` }
}
export const monthRange = (ym) => {
  const [y, m] = ym.split('-').map(Number)
  return { from: `${ym}-01`, to: `${ym}-${pad(lastDayOfMonth(y, m))}` }
}
export const quarterOf = (day) => Math.floor((Number(day.slice(5, 7)) - 1) / 3) + 1

/**
 * Trimestre que toca mirar hoy: del 1 al 20 del mes siguiente al cierre
 * de un trimestre es plazo de presentar el anterior, así que se abre
 * ese; el resto del tiempo, el que está en curso.
 */
export function defaultQuarter(today) {
  const y = Number(today.slice(0, 4))
  const m = Number(today.slice(5, 7))
  const d = Number(today.slice(8, 10))
  const q = quarterOf(today)
  if ((m - 1) % 3 === 0 && d <= 20) return q === 1 ? { year: y - 1, q: 4 } : { year: y, q: q - 1 }
  return { year: y, q }
}

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
export const monthLabel = (ym) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`
export const esDate = (day) => `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}`

/* Semana ISO (lunes a domingo): "2026-S41" y el lunes en que empieza */
function isoWeek(day) {
  const d = new Date(`${day}T12:00:00Z`)
  const dow = (d.getUTCDay() + 6) % 7
  const monday = new Date(d); monday.setUTCDate(d.getUTCDate() - dow)
  const thursday = new Date(monday); thursday.setUTCDate(monday.getUTCDate() + 3)
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((thursday - yearStart) / 86400000 + 1) / 7)
  const sunday = new Date(monday); sunday.setUTCDate(monday.getUTCDate() + 6)
  return {
    key: `${thursday.getUTCFullYear()}-S${pad(week)}`,
    label: `Semana ${week} · ${esDate(monday.toISOString().slice(0, 10)).slice(0, 5)}–${esDate(sunday.toISOString().slice(0, 10))}`,
  }
}

/* ── Agregados ─────────────────────────────────────────────────── */
const empty = () => ({ tickets: 0, base: 0, iva: 0, total: 0, cash: 0, card: 0, pending: 0, deliveryFee: 0, discount: 0 })
function add(b, t) {
  b.tickets += 1
  b.base += t.base
  b.iva += t.iva
  b.total += t.total
  if (!t.paid) b.pending += t.total
  else if (t.paymentMethod === 'tarjeta') b.card += t.total
  else b.cash += t.total
  b.deliveryFee += t.deliveryFee || 0
  b.discount += t.discount || 0
}
const fix = (b) => Object.fromEntries(Object.entries(b).map(([k, v]) => [k, k === 'tickets' ? v : r2(v)]))

const sedeName = (id) => getLocation(id)?.name || id

/** Tickets enriquecidos con su base e IVA, separados en válidos y anulados. */
export function prepareTickets(tickets) {
  const withVat = tickets.map((t) => ({ ...t, ...vatOf(t.total), time: new Date(t.createdAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' }) }))
  return {
    valid: withVat.filter((t) => t.status !== 'cancelado'),
    cancelled: withVat.filter((t) => t.status === 'cancelado'),
  }
}

/** Agrupa por periodo y sede: [{ key, label, bySede: {id: totals}, all: totals }] */
function groupBy(valid, keyOf) {
  const map = new Map()
  for (const t of valid) {
    const { key, label } = keyOf(t)
    if (!map.has(key)) map.set(key, { key, label, bySede: {}, all: empty() })
    const g = map.get(key)
    g.bySede[t.locationId] ||= empty()
    add(g.bySede[t.locationId], t)
    add(g.all, t)
  }
  return [...map.values()]
    .sort((a, b) => (a.key < b.key ? -1 : 1))
    .map((g) => ({ ...g, all: fix(g.all), bySede: Object.fromEntries(Object.entries(g.bySede).map(([k, v]) => [k, fix(v)])) }))
}

export function buildReport(tickets, { from, to, locationId = null }) {
  const { valid, cancelled } = prepareTickets(tickets)
  const sedes = locationId ? [locationId] : LOCATIONS.map((l) => l.id)

  const totals = empty()
  const bySede = Object.fromEntries(sedes.map((id) => [id, empty()]))
  for (const t of valid) {
    add(totals, t)
    bySede[t.locationId] ||= empty()
    add(bySede[t.locationId], t)
  }

  return {
    from,
    to,
    locationId,
    sedes,
    totals: fix(totals),
    bySede: Object.fromEntries(Object.entries(bySede).map(([k, v]) => [k, fix(v)])),
    byMonth: groupBy(valid, (t) => ({ key: t.day.slice(0, 7), label: monthLabel(t.day.slice(0, 7)) })),
    byWeek: groupBy(valid, (t) => isoWeek(t.day)),
    byDay: groupBy(valid, (t) => ({ key: t.day, label: esDate(t.day) })),
    valid: [...valid].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)),
    cancelled,
    cancelledTotal: r2(cancelled.reduce((n, t) => n + t.total, 0)),
  }
}

/* ── Excel ─────────────────────────────────────────────────────── */
const CHANNEL = { web: 'Web', mostrador: 'Mostrador', telefono: 'Teléfono' }
const MODE = { pickup: 'Recogida', delivery: 'Entrega' }
const eur = (v) => ({ v, s: 'eur' })
const eurB = (v) => ({ v, s: 'eurBold' })
const head = (labels) => labels.map((v) => ({ v, s: 'head' }))

const PERIOD_HEAD = ['Periodo', 'Sede', 'Tickets', 'Base imponible', `IVA ${IVA_RATE} %`, 'Total', 'Efectivo', 'Tarjeta', 'Pendiente de cobro']
const totalsRow = (label, sede, b, bold = false) => [
  bold ? { v: label, s: 'bold' } : label, bold ? { v: sede, s: 'bold' } : sede,
  b.tickets, (bold ? eurB : eur)(b.base), (bold ? eurB : eur)(b.iva), (bold ? eurB : eur)(b.total),
  eur(b.cash), eur(b.card), eur(b.pending),
]
function periodRows(groups, sedes) {
  const rows = [head(PERIOD_HEAD)]
  for (const g of groups) {
    if (sedes.length > 1) {
      for (const id of sedes) if (g.bySede[id]) rows.push(totalsRow(g.label, sedeName(id), g.bySede[id]))
      rows.push(totalsRow(g.label, 'Las dos sedes', g.all, true))
    } else {
      rows.push(totalsRow(g.label, sedeName(sedes[0]), g.all))
    }
  }
  return rows
}
const PERIOD_WIDTHS = [30, 20, 9, 15, 13, 14, 13, 13, 17]

/** Hojas del Excel para el gestor. `cancelLabel`: motivo → texto. */
export function reportSheets(rep, { title, generatedAt, cancelLabel = {} }) {
  const fiscal = fiscalOf(rep.sedes[0])
  const sedeText = rep.sedes.length > 1 ? 'Sangonera la Verde y Santo Ángel' : sedeName(rep.sedes[0])

  const resumen = [
    [{ v: `La Pizza de Nonno · ${title}`, s: 'title' }],
    [fiscal ? `${fiscal.name} · CIF ${fiscal.nif} · ${fiscal.address}` : 'Datos fiscales sin configurar'],
    [`Periodo: del ${esDate(rep.from)} al ${esDate(rep.to)} · ${sedeText}`],
    [`Facturas simplificadas. IVA del ${IVA_RATE} % incluido en los precios. Generado el ${generatedAt}.`],
    [],
    head(['Sede', 'Tickets', 'Base imponible', `IVA ${IVA_RATE} %`, 'Total facturado', 'Cobrado efectivo', 'Cobrado tarjeta', 'Pendiente de cobro', 'Gastos de envío', 'Descuentos']),
    ...rep.sedes.map((id) => {
      const b = rep.bySede[id]
      return [sedeName(id), b.tickets, eur(b.base), eur(b.iva), eur(b.total), eur(b.cash), eur(b.card), eur(b.pending), eur(b.deliveryFee), eur(b.discount)]
    }),
    ...(rep.sedes.length > 1
      ? [[{ v: 'TOTAL', s: 'bold' }, rep.totals.tickets, eurB(rep.totals.base), eurB(rep.totals.iva), eurB(rep.totals.total), eurB(rep.totals.cash), eurB(rep.totals.card), eurB(rep.totals.pending), eurB(rep.totals.deliveryFee), eurB(rep.totals.discount)]]
      : []),
    [],
    [`Pedidos anulados (no facturan): ${rep.cancelled.length} · ${rep.cancelledTotal.toFixed(2).replace('.', ',')} €`],
    ['Los gastos de envío ya van incluidos en el total; los descuentos ya están restados.'],
  ]

  const libro = [
    head(['Nº factura', 'Fecha', 'Hora', 'Sede', 'Canal', 'Recogida / entrega', 'Forma de pago', 'Cobrado', 'Base imponible', `IVA ${IVA_RATE} %`, 'Total']),
    ...rep.valid.map((t) => [
      t.invoice, esDate(t.day), t.time, sedeName(t.locationId), CHANNEL[t.channel] || t.channel || '',
      MODE[t.mode] || t.mode || '', t.paid ? (t.paymentMethod === 'tarjeta' ? 'Tarjeta' : 'Efectivo') : '', t.paid ? 'Sí' : 'No',
      eur(t.base), eur(t.iva), eur(t.total),
    ]),
    [],
    [{ v: 'TOTAL', s: 'bold' }, '', '', '', '', '', '', '', eurB(rep.totals.base), eurB(rep.totals.iva), eurB(rep.totals.total)],
  ]

  const anulados = [
    head(['Nº pedido', 'Fecha', 'Hora', 'Sede', 'Motivo', 'Importe']),
    ...rep.cancelled.map((t) => [t.invoice, esDate(t.day), t.time, sedeName(t.locationId), cancelLabel[t.cancelReason] || 'Sin motivo apuntado', eur(t.total)]),
  ]

  return [
    { name: 'Resumen', rows: resumen, widths: [22, 9, 15, 13, 15, 16, 15, 17, 15, 12] },
    { name: 'Por mes', rows: periodRows(rep.byMonth, rep.sedes), widths: PERIOD_WIDTHS, freeze: 1 },
    { name: 'Por semana', rows: periodRows(rep.byWeek, rep.sedes), widths: PERIOD_WIDTHS, freeze: 1 },
    { name: 'Por día', rows: periodRows(rep.byDay, rep.sedes), widths: PERIOD_WIDTHS, freeze: 1 },
    { name: 'Libro de facturas', rows: libro, widths: [26, 11, 7, 19, 11, 17, 14, 9, 15, 12, 12], freeze: 1 },
    { name: 'Anulados', rows: anulados, widths: [26, 11, 7, 19, 26, 12], freeze: 1 },
  ]
}
