import { db, isConfigured } from './supabase.js'
import { requireSession, SCOPE_ALL } from './auth.js'
import { getLocation } from '../../src/data/locations.js'
import { serviceDay, serviceDayRange } from '../../src/lib/orderNumber.js'

/**
 * CIERRE DE CAJA
 *   GET  /api/cash?location=sangonera[&day=2026-09-29]
 *        → lo que debería haber en caja (efectivo y tarjeta) según los
 *          pedidos cobrados ese día, el cierre ya guardado (si lo hay) y
 *          los últimos cierres de la sede.
 *   POST /api/cash  { location, day, countedCash, countedCard, note }
 *        → guarda el cierre del día. Lo esperado se recalcula aquí: el
 *          navegador solo aporta lo que ha contado el empleado.
 *
 * Cada sede solo ve y cierra la suya; la dirección puede con las dos.
 * Vive dentro de api/billing.js (`?resource=cash`, ver vercel.json)
 * porque Vercel Hobby admite como máximo 12 funciones.
 */
const DAY = /^\d{4}-\d{2}-\d{2}$/
const round = (n) => Math.round((Number(n) || 0) * 100) / 100
const MISSING_TABLE = '42P01'

/* Fondo de caja: el efectivo que siempre se queda en el cajón (150 €). Lo
   esperado en efectivo al cerrar es el fondo MÁS las ventas cobradas en
   efectivo, y lo que se retira es lo contado menos el fondo. */
const CASH_FLOAT = Number(process.env.CASH_FLOAT) || 150

/**
 * Lo cobrado esa noche en la sede, por forma de pago. La noche es el
 * día de servicio (de 05:00 a 05:00): cerrar la caja a las 00:30 sigue
 * siendo la caja de esa noche. Devuelve también lo que impide cerrar
 * bien: pedidos sin cobrar y pedidos que aún no se han entregado.
 */
async function expectedFor(locationId, day) {
  const [from, to] = serviceDayRange(day)
  const read = (columns) => db()
    .from('orders')
    .select(columns)
    .eq('location_id', locationId)
    .neq('status', 'cancelado')
    .gte('created_at', new Date(from).toISOString())
    .lt('created_at', new Date(to).toISOString())
    .order('created_at', { ascending: true })
    .limit(5000)
  const BASE = 'id, ref, customer_name, mode, total, payment_status, payment_method, status'
  let { data, error } = await read(`${BASE}, driver_name`)
  /* Sin supabase/repartidores.sql todavía: sin el nombre del repartidor */
  if (['42703', 'PGRST204'].includes(error?.code)) ({ data, error } = await read(BASE))
  if (error) throw error

  const out = { cash: 0, cashDelivery: 0, card: 0, pending: 0 }
  const brief = (o) => ({ id: o.id, ref: o.ref, name: o.customer_name, mode: o.mode, status: o.status, total: round(o.total) })
  const unpaid = []
  const open = []
  const byDriver = new Map()
  for (const o of data) {
    const total = Number(o.total) || 0
    if (o.status !== 'entregado') open.push(brief(o))
    if (o.payment_status !== 'pagado') { out.pending += total; unpaid.push(brief(o)) } else if (o.payment_method === 'tarjeta') out.card += total
    else {
      out.cash += total
      /* Efectivo cobrado en la puerta: lo trae el repartidor al volver */
      if (o.mode === 'delivery') {
        out.cashDelivery += total
        const who = o.driver_name || 'Sin repartidor asignado'
        byDriver.set(who, (byDriver.get(who) || 0) + total)
      }
    }
  }
  return {
    cash: round(out.cash), cashDelivery: round(out.cashDelivery), card: round(out.card),
    pending: round(out.pending), pendingCount: unpaid.length, orders: data.length,
    unpaid, open,
    /* Lo que tiene que entregar cada repartidor al volver */
    byDriver: [...byDriver].map(([name, cash]) => ({ name, cash: round(cash) })).sort((a, b) => b.cash - a.cash),
  }
}

const money = (v) => {
  const n = Number(String(v ?? '').replace(',', '.'))
  return Number.isFinite(n) && n >= 0 && n < 100000 ? round(n) : null
}

export default async function cashHandler(req, res) {
  if (!isConfigured()) {
    return res.status(503).json({ error: 'El sistema todavía no está conectado a la base de datos.' })
  }
  const session = requireSession(req, res)
  if (!session) return

  const source = req.method === 'POST' ? (req.body || {}) : (req.query || {})
  const locationId = source.location && getLocation(source.location) ? source.location : (session.scope !== SCOPE_ALL ? session.scope : null)
  if (!locationId) return res.status(400).json({ error: 'Falta la sede.' })
  if (session.scope !== SCOPE_ALL && session.scope !== locationId) {
    return res.status(403).json({ error: 'No puedes ver la caja de otra sede.' })
  }
  const day = DAY.test(source.day || '') ? source.day : serviceDay()

  try {
    if (req.method === 'GET') {
      const expected = await expectedFor(locationId, day)
      let closing = null
      let history = []
      let tableMissing = false
      const { data, error } = await db().from('cash_closings').select('*').eq('location_id', locationId).order('day', { ascending: false }).limit(15)
      if (error) {
        if (error.code === MISSING_TABLE) tableMissing = true
        else throw error
      } else {
        history = data
        closing = data.find((c) => c.day === day) || null
      }
      res.setHeader('Cache-Control', 'no-store')
      return res.status(200).json({ location: locationId, day, float: CASH_FLOAT, expected, closing, history, tableMissing })
    }

    if (req.method === 'POST') {
      const countedCash = money(req.body?.countedCash)
      const countedCard = money(req.body?.countedCard)
      if (countedCash === null || countedCard === null) {
        return res.status(400).json({ error: 'Escribe cuánto hay contado en efectivo y en tarjeta (0 si nada).' })
      }
      const expected = await expectedFor(locationId, day)
      const row = {
        location_id: locationId,
        day,
        expected_cash: round(expected.cash + CASH_FLOAT),
        expected_card: expected.card,
        counted_cash: countedCash,
        counted_card: countedCard,
        note: String(req.body?.note ?? '').trim().slice(0, 400) || null,
        closed_by: session.scope,
        closed_at: new Date().toISOString(),
      }
      const { data, error } = await db().from('cash_closings').upsert(row, { onConflict: 'location_id,day' }).select('*').single()
      if (error) {
        if (error.code === MISSING_TABLE) {
          return res.status(409).json({ error: 'El cierre de caja aún no está activado en la base de datos (falta ejecutar supabase/fase2.sql).' })
        }
        throw error
      }
      return res.status(200).json({ closing: data })
    }
  } catch (err) {
    console.error('Error en el cierre de caja:', err)
    return res.status(500).json({ error: 'No hemos podido completar el cierre de caja.' })
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).json({ error: 'Método no permitido' })
}
