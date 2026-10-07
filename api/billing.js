import { db, isConfigured } from './_lib/supabase.js'
import { requireSession, SCOPE_ALL } from './_lib/auth.js'
import { getLocation } from '../src/data/locations.js'
import { serviceDay, serviceDayRange, invoiceNumber } from '../src/lib/orderNumber.js'
import cashHandler from './_lib/cashHandler.js'

/**
 * GET /api/billing?from=2026-09-01&to=2026-09-27[&location=sangonera][&export=1]
 *
 * Con export=1 trae también cada ticket (libro de facturas emitidas)
 * para la descarga del gestor.
 *
 * Solo el super admin (sesión con las dos sedes) puede verlo: es dinero,
 * no algo que necesite ver el mostrador de un local. from/to son días
 * de servicio en hora de Madrid, ambos incluidos. Sin parámetros,
 * el día de hoy.
 *
 * "Facturación" = pedidos no cancelados del rango, se hayan cobrado
 * ya o no (igual que el aviso rápido de "hoy" del panel). Por eso se
 * desglosa también cobrado / pendiente de cobro.
 */
const DAY = /^\d{4}-\d{2}-\d{2}$/
const round = (n) => Math.round((Number(n) || 0) * 100) / 100
const bucket = () => ({ orders: 0, revenue: 0 })
const add = (b, total) => { b.orders += 1; b.revenue += Number(total) || 0 }
const rounded = (b) => ({ orders: b.orders, revenue: round(b.revenue) })


/**
 * Agregación pura, sin red: fácil de probar. `rows` son filas de
 * `orders` ya filtradas por fecha/sede/no-cancelados.
 */
export function aggregateBilling(allRows) {
  /* Los cancelados no facturan: van a su propio bloque con el motivo */
  const rows = allRows.filter((o) => o.status !== 'cancelado')
  const cancelled = allRows.filter((o) => o.status === 'cancelado')
  const summary = { orders: 0, revenue: 0, subtotal: 0, discount: 0, deliveryFee: 0, collected: 0, pending: 0 }
  const products = new Map()
  const byDay = new Map()
  const byLocation = new Map()
  const byMode = { pickup: bucket(), delivery: bucket() }
  const byChannel = { web: bucket(), mostrador: bucket(), telefono: bucket() }
  const byPayment = { efectivo: bucket(), tarjeta: bucket() }

  for (const o of rows) {
    const total = Number(o.total) || 0
    summary.orders += 1
    summary.revenue += total
    summary.subtotal += Number(o.subtotal) || 0
    summary.discount += Number(o.discount) || 0
    summary.deliveryFee += Number(o.delivery_fee) || 0
    if (o.payment_status === 'pagado') summary.collected += total
    else summary.pending += total

    /* Día de servicio (cambia a las 05:00): lo de las 00:30 es de esa noche */
    const day = o.service_day || serviceDay(Date.parse(o.created_at))
    if (!byDay.has(day)) byDay.set(day, bucket())
    add(byDay.get(day), total)

    if (!byLocation.has(o.location_id)) byLocation.set(o.location_id, bucket())
    add(byLocation.get(o.location_id), total)

    for (const it of o.items || []) {
      const key = it.id || it.name
      if (!key) continue
      const p = products.get(key) || { id: key, name: it.name || key, qty: 0, revenue: 0 }
      p.qty += Number(it.qty) || 0
      p.revenue += Number(it.total) || 0
      products.set(key, p)
    }

    if (byMode[o.mode]) add(byMode[o.mode], total)
    if (byChannel[o.channel]) add(byChannel[o.channel], total)
    if (o.payment_status === 'pagado') {
      const method = byPayment[o.payment_method] ? o.payment_method : 'efectivo'
      add(byPayment[method], total)
    }
  }

  return {
    summary: {
      orders: summary.orders,
      revenue: round(summary.revenue),
      subtotal: round(summary.subtotal),
      discount: round(summary.discount),
      deliveryFee: round(summary.deliveryFee),
      collected: round(summary.collected),
      pending: round(summary.pending),
      avgTicket: round(summary.orders ? summary.revenue / summary.orders : 0),
    },
    byDay: [...byDay.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([day, b]) => ({ day, ...rounded(b) })),
    byLocation: [...byLocation.entries()]
      .map(([id, b]) => ({ locationId: id, name: getLocation(id)?.name || id, ...rounded(b) }))
      .sort((a, b) => b.revenue - a.revenue),
    byMode: { pickup: rounded(byMode.pickup), delivery: rounded(byMode.delivery) },
    byChannel: { web: rounded(byChannel.web), mostrador: rounded(byChannel.mostrador), telefono: rounded(byChannel.telefono) },
    byPayment: { efectivo: rounded(byPayment.efectivo), tarjeta: rounded(byPayment.tarjeta) },
    topProducts: [...products.values()]
      .sort((a, b) => b.qty - a.qty || b.revenue - a.revenue)
      .slice(0, 15)
      .map((p) => ({ ...p, revenue: round(p.revenue) })),
    cancellations: {
      orders: cancelled.length,
      lost: round(cancelled.reduce((n, o) => n + (Number(o.total) || 0), 0)),
      byReason: Object.entries(cancelled.reduce((acc, o) => {
        const k = o.cancel_reason || 'sin-motivo'
        acc[k] = (acc[k] || 0) + 1
        return acc
      }, {})).map(([reason, orders]) => ({ reason, orders })).sort((a, b) => b.orders - a.orders),
    },
  }
}

export default async function handler(req, res) {
  /* /api/cash (cierre de caja) llega aquí con `?resource=cash` por una
     reescritura de vercel.json: Vercel Hobby admite solo 12 funciones. */
  if (req.query?.resource === 'cash') return cashHandler(req, res)

  if (!isConfigured()) {
    return res.status(503).json({ error: 'El sistema todavía no está conectado a la base de datos.' })
  }
  const session = requireSession(req, res)
  if (!session) return
  if (session.scope !== SCOPE_ALL) {
    return res.status(403).json({ error: 'La facturación solo la puede ver el super admin.' })
  }
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Método no permitido' })
  }

  const today = serviceDay()
  const from = DAY.test(req.query?.from || '') ? req.query.from : today
  const to = DAY.test(req.query?.to || '') ? req.query.to : today
  if (from > to) return res.status(400).json({ error: 'El rango de fechas no es válido.' })

  const locationId = req.query?.location && getLocation(req.query.location) ? req.query.location : null

  /* Para el gestor (?export=1) hacen falta además el número y la hora
     de cada ticket: el libro de facturas emitidas. */
  const wantsTickets = req.query?.export === '1'
  const BASE = 'created_at, status, location_id, mode, channel, payment_status, payment_method, subtotal, discount, delivery_fee, total, items'
    + (wantsTickets ? ', ref, service_day' : '')
  /* Supabase devuelve como mucho 1000 filas por consulta: un trimestre
     de las dos sedes pasa de eso, así que se pide por páginas. */
  const PAGE = 1000
  const run = async (columns) => {
    const rows = []
    for (let start = 0; start < 50000; start += PAGE) {
      let query = db()
        .from('orders')
        .select(columns)
        .gte('created_at', new Date(serviceDayRange(from)[0]).toISOString())
        .lt('created_at', new Date(serviceDayRange(to)[1]).toISOString())
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(start, start + PAGE - 1)
      if (locationId) query = query.eq('location_id', locationId)
      const { data, error } = await query
      if (error) return { data: null, error }
      rows.push(...data)
      if (data.length < PAGE) break
    }
    return { data: rows, error: null }
  }
  let { data, error } = await run(`${BASE}, cancel_reason`)
  /* Sin la columna del motivo (supabase/fase2.sql): se sigue sin él */
  if (error?.code === '42703') ({ data, error } = await run(BASE))
  /* Ni el día de servicio (supabase/numero-pedido.sql): se calcula de la hora */
  if (error?.code === '42703') ({ data, error } = await run(BASE.replace(', service_day', '')))
  if (error) {
    console.error('Error calculando la facturación:', error)
    return res.status(500).json({ error: 'No hemos podido calcular la facturación.' })
  }

  /* Cierres de caja del rango (si la tabla existe): para ver descuadres */
  let closings = []
  let cq = db().from('cash_closings').select('*').gte('day', from).lte('day', to).order('day', { ascending: false })
  if (locationId) cq = cq.eq('location_id', locationId)
  const { data: cash, error: cashError } = await cq
  if (!cashError) {
    closings = cash.map((c) => ({
      day: c.day,
      locationId: c.location_id,
      name: getLocation(c.location_id)?.name || c.location_id,
      diff: round(Number(c.counted_cash) - Number(c.expected_cash) + Number(c.counted_card) - Number(c.expected_card)),
      note: c.note,
    }))
  }

  res.setHeader('Cache-Control', 'no-store')
  const tickets = wantsTickets
    ? data.map((o) => ({
      ref: o.ref,
      invoice: invoiceNumber(o),
      day: o.service_day || serviceDay(Date.parse(o.created_at)),
      createdAt: o.created_at,
      locationId: o.location_id,
      status: o.status,
      cancelReason: o.cancel_reason || null,
      mode: o.mode,
      channel: o.channel,
      paid: o.payment_status === 'pagado',
      paymentMethod: o.payment_method || null,
      subtotal: round(o.subtotal),
      discount: round(o.discount),
      deliveryFee: round(o.delivery_fee),
      total: round(o.total),
    }))
    : undefined

  return res.status(200).json({ from, to, location: locationId, ...aggregateBilling(data), closings, tickets })
}
