import { db, isConfigured } from './supabase.js'
import { readSession, SCOPE_ALL, pinHash, createDriverCookie, clearDriverCookie, readDriverId } from './auth.js'
import { guard, clientIp } from './limiter.js'
import { settleOrderPoints } from './customer.js'
import { getLocation } from '../../src/data/locations.js'
import { serviceDay, serviceDayRange } from '../../src/lib/orderNumber.js'

/* ═══════════════════════════════════════════════════════════════
   PORTAL DEL REPARTIDOR  ·  /api/driver
   (vive en api/routes.js con ?resource=driver: Vercel Hobby admite 12 funciones)

   Repartidor (cookie del portal, entra con su PIN):
     GET                                   → yo, mis repartos de esta noche y lo que llevo cobrado
     POST { action: 'login', location, pin }
     POST { action: 'logout' }
     POST { action: 'lookup', orderId }    → el pedido del QR del ticket
     POST { action: 'lookup', ref }        → o por su número de esta noche ("07")
     POST { action: 'deliver', orderId, method? }  entregado (+ cobrado en efectivo o tarjeta)

   Panel (sesión del local o de la dirección):
     GET  ?list=sangonera                  → repartidores de la sede
     POST { action: 'save', location, id?, name, pin? }
     POST { action: 'remove', id }
   ═══════════════════════════════════════════════════════════════ */

const NO_TABLE = 'Falta activar los repartidores: ejecuta supabase/repartidores.sql en Supabase.'
const missing = (err) => ['42P01', '42703', 'PGRST204', 'PGRST205'].includes(err?.code)
const PIN = /^\d{4}$/
const METHODS = ['efectivo', 'tarjeta']

const ORDER_FIELDS = 'id, ref, created_at, status, location_id, mode, customer_name, customer_phone, address, delivery_zone, delivery_lat, delivery_lng, delivery_verified, notes, items, total, payment_status, payment_method, dispatched_at, route_id, driver_id, driver_name, eta_at, ready_at'

/** Lo que ve el repartidor de un pedido: lo justo para llevarlo y cobrarlo. */
const brief = (o) => ({
  id: o.id, ref: o.ref, status: o.status, customerName: o.customer_name, phone: o.customer_phone,
  address: o.address, zone: o.delivery_zone, lat: o.delivery_lat, lng: o.delivery_lng,
  verified: o.delivery_verified, notes: o.notes, total: Number(o.total) || 0,
  paid: o.payment_status === 'pagado', method: o.payment_method, dispatchedAt: o.dispatched_at,
  driverId: o.driver_id, driverName: o.driver_name, etaAt: o.eta_at,
  items: (o.items || []).map((i) => ({ qty: i.qty, name: i.name })),
})

async function currentDriver(req) {
  const id = readDriverId(req)
  if (!id) return null
  const { data, error } = await db().from('drivers').select('id, location_id, name').eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

export default async function driverHandler(req, res) {
  if (!isConfigured()) return res.status(503).json({ error: 'El sistema todavía no está conectado a la base de datos.' })
  res.setHeader('Cache-Control', 'no-store')
  try {
    const action = req.body?.action
    /* Gestión desde el panel */
    if ((req.method === 'GET' && req.query?.list) || ['save', 'remove'].includes(action)) return await manage(req, res)

    if (req.method === 'POST' && action === 'login') return await login(req, res)
    if (req.method === 'POST' && action === 'logout') {
      res.setHeader('Set-Cookie', clearDriverCookie())
      return res.status(200).json({ ok: true })
    }

    const driver = await currentDriver(req)
    if (req.method === 'GET') return res.status(200).json(driver ? await myNight(driver) : { driver: null })
    if (!driver) return res.status(401).json({ code: 'login', error: 'Entra con tu PIN.' })
    if (action === 'lookup') return await lookup(req, res, driver)
    if (action === 'deliver') return await deliver(req, res, driver)
    return res.status(400).json({ error: 'Acción no válida.' })
  } catch (err) {
    if (missing(err)) return res.status(503).json({ error: NO_TABLE })
    console.error('Error en el portal del repartidor:', err)
    return res.status(500).json({ error: 'Algo ha fallado. Inténtalo otra vez.' })
  }
}

async function login(req, res) {
  const locationId = String(req.body?.location || '')
  const pin = String(req.body?.pin || '')
  if (!getLocation(locationId)) return res.status(400).json({ error: 'Elige tu local.' })
  const blocked = await guard(res, [
    [`driver:ip:${clientIp(req)}`, { max: 8, window: 600, lock: 900 }],
    [`driver:loc:${locationId}`, { max: 40, window: 600, lock: 600 }],
  ])
  if (blocked) return res.status(429).json({ error: 'Demasiados intentos. Espera unos minutos o pide el PIN en el local.' })
  if (!PIN.test(pin)) return res.status(400).json({ error: 'El PIN son 4 números.' })

  const { data, error } = await db().from('drivers').select('id, location_id, name')
    .eq('location_id', locationId).eq('pin_hash', pinHash(locationId, pin)).maybeSingle()
  if (error) throw error
  if (!data) return res.status(401).json({ error: 'PIN incorrecto.' })
  res.setHeader('Set-Cookie', createDriverCookie(data.id))
  return res.status(200).json(await myNight(data))
}

/** Mis repartos de esta noche: los que llevo encima y los ya entregados, con lo cobrado. */
async function myNight(driver) {
  const start = new Date(serviceDayRange(serviceDay())[0]).toISOString()
  const { data, error } = await db().from('orders').select(ORDER_FIELDS)
    .eq('location_id', driver.location_id).eq('driver_id', driver.id)
    .neq('status', 'cancelado')
    .or(`created_at.gte."${start}",status.in.(nuevo,horno,listo)`)
    .order('created_at', { ascending: true })
    .limit(300)
  if (error) throw error
  const pending = data.filter((o) => o.status !== 'entregado')
  const done = data.filter((o) => o.status === 'entregado')
  const sum = (list) => Math.round(list.reduce((n, o) => n + (Number(o.total) || 0), 0) * 100) / 100
  const paidBy = (m) => done.filter((o) => o.payment_status === 'pagado' && (o.payment_method || 'efectivo') === m)
  return {
    driver: { id: driver.id, name: driver.name, locationId: driver.location_id, locationName: getLocation(driver.location_id)?.name },
    pending: pending.map(brief),
    done: done.map(brief).reverse(),
    totals: { cash: sum(paidBy('efectivo')), card: sum(paidBy('tarjeta')), delivered: done.length },
  }
}

async function findOrder(driver, orderId) {
  const id = String(orderId || '').trim()
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const { data, error } = await db().from('orders').select(ORDER_FIELDS).eq('id', id).eq('location_id', driver.location_id).maybeSingle()
  if (error) throw error
  return data
}

async function lookup(req, res, driver) {
  let order
  const ref = String(req.body?.ref || '').trim()
  if (ref) {
    const { data, error } = await db().from('orders').select(ORDER_FIELDS)
      .eq('location_id', driver.location_id).eq('service_day', serviceDay()).eq('ref', ref.padStart(2, '0')).maybeSingle()
    if (error) throw error
    order = data
    if (!order) return res.status(404).json({ error: `No hay ningún pedido ${ref} esta noche en tu local.` })
  } else {
    order = await findOrder(driver, req.body?.orderId)
  }
  if (!order) return res.status(404).json({ error: 'Ese ticket no es de un pedido de tu local.' })
  if (order.mode !== 'delivery') return res.status(409).json({ error: `El ${order.ref} es para recoger en el local, no de reparto.` })
  return res.status(200).json({ order: brief(order) })
}

async function deliver(req, res, driver) {
  const order = await findOrder(driver, req.body?.orderId)
  if (!order) return res.status(404).json({ error: 'Ese pedido no es de tu local.' })
  if (order.mode !== 'delivery') return res.status(409).json({ error: 'Ese pedido es para recoger en el local.' })
  if (order.status === 'cancelado') return res.status(409).json({ error: `El ${order.ref} está CANCELADO. Llama al local.` })
  if (order.status === 'entregado') return res.status(409).json({ error: `El ${order.ref} ya está entregado${order.driver_name ? ` (lo marcó ${order.driver_name})` : ''}.` })
  if (order.driver_id && order.driver_id !== driver.id) {
    return res.status(409).json({ error: `El ${order.ref} lo lleva ${order.driver_name || 'otro repartidor'}.` })
  }
  const paid = order.payment_status === 'pagado'
  const method = req.body?.method
  if (!paid && !METHODS.includes(method)) return res.status(400).json({ error: '¿Cómo ha pagado? Efectivo o tarjeta.' })

  const now = new Date().toISOString()
  const patch = {
    status: 'entregado', driver_id: driver.id, driver_name: driver.name,
    ...(order.dispatched_at ? {} : { dispatched_at: now }),
    ...(paid ? {} : { payment_status: 'pagado', payment_method: method, paid_at: now }),
  }
  /* Solo si sigue como estaba: dos toques a la vez no lo cobran dos veces */
  const { data, error } = await db().from('orders').update(patch)
    .eq('id', order.id).eq('location_id', driver.location_id).neq('status', 'entregado').neq('status', 'cancelado')
    .select('*').maybeSingle()
  if (error) throw error
  if (!data) return res.status(409).json({ error: `El ${order.ref} acaba de cambiar. Vuelve a escanearlo.` })
  await settleOrderPoints(data)
  return res.status(200).json({ order: brief(data), ...(await myNight(driver)) })
}

/* ── Panel: alta, cambio de PIN y baja de repartidores ─────────── */
async function manage(req, res) {
  const session = readSession(req)
  if (!session) return res.status(401).json({ error: 'No autorizado' })
  const can = (loc) => session.scope === SCOPE_ALL || session.scope === loc

  if (req.method === 'GET') {
    const loc = String(req.query.list)
    if (!getLocation(loc) || !can(loc)) return res.status(403).json({ error: 'No puedes ver los repartidores de esa sede.' })
    return res.status(200).json({ drivers: await listDrivers(loc) })
  }

  if (req.body.action === 'remove') {
    const { data: d, error } = await db().from('drivers').select('id, location_id').eq('id', String(req.body.id || '')).maybeSingle()
    if (error) throw error
    if (!d || !can(d.location_id)) return res.status(404).json({ error: 'Ese repartidor no es de tu sede.' })
    const { error: delError } = await db().from('drivers').delete().eq('id', d.id).eq('location_id', d.location_id)
    if (delError) throw delError
    return res.status(200).json({ drivers: await listDrivers(d.location_id) })
  }

  /* save */
  const loc = String(req.body.location || '')
  if (!getLocation(loc) || !can(loc)) return res.status(403).json({ error: 'No puedes cambiar los repartidores de esa sede.' })
  const name = String(req.body.name || '').trim().slice(0, 40)
  const pin = String(req.body.pin || '').trim()
  const id = req.body.id ? String(req.body.id) : null
  if (!name) return res.status(400).json({ error: 'Escribe el nombre del repartidor.' })
  if ((!id || pin) && !PIN.test(pin)) return res.status(400).json({ error: 'El PIN son 4 números.' })

  const row = { name, ...(pin ? { pin_hash: pinHash(loc, pin) } : {}) }
  const q = id
    ? db().from('drivers').update(row).eq('id', id).eq('location_id', loc)
    : db().from('drivers').insert({ ...row, location_id: loc })
  const { error } = await q
  if (error?.code === '23505') return res.status(409).json({ error: 'Ese PIN ya lo tiene otro repartidor de esta sede. Elige otro.' })
  if (error) throw error
  return res.status(200).json({ drivers: await listDrivers(loc) })
}

async function listDrivers(loc) {
  const { data, error } = await db().from('drivers').select('id, name, created_at').eq('location_id', loc).order('created_at')
  if (error) throw error
  return data
}
