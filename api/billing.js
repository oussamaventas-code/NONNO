import { db, isConfigured } from './_lib/supabase.js'
import { requireSession, SCOPE_ALL } from './_lib/auth.js'
import { getLocation } from '../src/data/locations.js'
import { madridDay } from '../src/lib/stock.js'
import { madridTime } from '../src/lib/kitchenSlots.js'

/**
 * GET /api/billing?from=2026-09-01&to=2026-09-27[&location=sangonera]
 *
 * Solo la dirección (sesión con las dos sedes) puede verlo: es dinero,
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

/** Instante 00:00 en Madrid del día `dateStr` (YYYY-MM-DD). */
const dayStartMs = (dateStr) => madridTime(Date.parse(`${dateStr}T12:00:00Z`), '00:00')

/**
 * Agregación pura, sin red: fácil de probar. `rows` son filas de
 * `orders` ya filtradas por fecha/sede/no-cancelados.
 */
export function aggregateBilling(rows) {
  const summary = { orders: 0, revenue: 0, subtotal: 0, discount: 0, deliveryFee: 0, collected: 0, pending: 0 }
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

    const day = madridDay(Date.parse(o.created_at))
    if (!byDay.has(day)) byDay.set(day, bucket())
    add(byDay.get(day), total)

    if (!byLocation.has(o.location_id)) byLocation.set(o.location_id, bucket())
    add(byLocation.get(o.location_id), total)

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
  }
}

export default async function handler(req, res) {
  if (!isConfigured()) {
    return res.status(503).json({ error: 'El sistema todavía no está conectado a la base de datos.' })
  }
  const session = requireSession(req, res)
  if (!session) return
  if (session.scope !== SCOPE_ALL) {
    return res.status(403).json({ error: 'La facturación solo la puede ver la dirección.' })
  }
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Método no permitido' })
  }

  const today = madridDay()
  const from = DAY.test(req.query?.from || '') ? req.query.from : today
  const to = DAY.test(req.query?.to || '') ? req.query.to : today
  if (from > to) return res.status(400).json({ error: 'El rango de fechas no es válido.' })

  const locationId = req.query?.location && getLocation(req.query.location) ? req.query.location : null

  let query = db()
    .from('orders')
    .select('created_at, location_id, mode, channel, payment_status, payment_method, subtotal, discount, delivery_fee, total')
    .gte('created_at', new Date(dayStartMs(from)).toISOString())
    .lt('created_at', new Date(dayStartMs(to) + 24 * 3600 * 1000).toISOString())
    .neq('status', 'cancelado')
    .order('created_at', { ascending: true })
    .limit(10000)
  if (locationId) query = query.eq('location_id', locationId)

  const { data, error } = await query
  if (error) {
    console.error('Error calculando la facturación:', error)
    return res.status(500).json({ error: 'No hemos podido calcular la facturación.' })
  }

  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).json({ from, to, location: locationId, ...aggregateBilling(data) })
}
