import { randomUUID } from 'node:crypto'
import { db, isConfigured } from './_lib/supabase.js'
import { requireSession, SCOPE_ALL } from './_lib/auth.js'
import { getLocation } from '../src/data/locations.js'
import driverHandler from './_lib/driverHandler.js'
import { sendCustomerNotification } from './_lib/customerNotifications.js'

/**
 * POST /api/routes  (solo panel)
 *   { location, action: 'dispatch', ids: [...], driverId? }  sale el reparto con esos pedidos (y ese repartidor)
 *   { location, action: 'undo', routeId }          deshacer una salida marcada por error
 *
 * Al salir, los pedidos quedan fijos en su salida (ya no se reorganizan),
 * pasan a "listo" si cocina no lo había marcado.
 *
 * /api/driver (portal del repartidor) llega aquí con ?resource=driver
 * por una reescritura de vercel.json: Vercel Hobby admite 12 funciones.
 */
export default async function handler(req, res) {
  if (req.query?.resource === 'driver') return driverHandler(req, res)
  if (!isConfigured()) return res.status(503).json({ error: 'Base de datos no configurada.' })
  const session = requireSession(req, res)
  if (!session) return
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Método no permitido' })
  }

  const { location: locationId, action } = req.body || {}
  if (!getLocation(locationId)) return res.status(400).json({ error: 'Sede no válida.' })
  if (session.scope !== SCOPE_ALL && session.scope !== locationId) {
    return res.status(403).json({ error: 'No puedes tocar el reparto de otra sede.' })
  }

  try {
    if (action === 'dispatch') return await dispatch(req, res, locationId)
    if (action === 'undo') return await undo(req, res, locationId)
    return res.status(400).json({ error: 'Acción no válida.' })
  } catch (err) {
    console.error('Error en el reparto:', err)
    return res.status(500).json({ error: 'No hemos podido guardar el reparto.' })
  }
}

async function dispatch(req, res, locationId) {
  const ids = Array.isArray(req.body.ids) ? req.body.ids.slice(0, 10).map(String) : []
  if (!ids.length) return res.status(400).json({ error: 'No hay pedidos en esta salida.' })

  const { data: found, error } = await db().from('orders').select('*')
    .in('id', ids).eq('location_id', locationId).eq('mode', 'delivery')
    .is('dispatched_at', null).not('status', 'in', '(entregado,cancelado)')
  if (error) throw error
  if (found.length !== ids.length) {
    return res.status(409).json({ error: 'Algún pedido ya ha salido o ha cambiado. Actualiza y vuelve a intentarlo.' })
  }

  /* No se manda a nadie a repartir una pizza
     que todavía no está hecha: cocina tiene que haberla marcado lista
     antes de que esta salida pueda confirmarse. */
  const notReady = found.filter((o) => o.status !== 'listo')
  if (notReady.length) {
    return res.status(409).json({
      error: `${notReady.map((o) => o.ref).join(', ')} aún no está${notReady.length > 1 ? 'n' : ''} listo en cocina.`,
    })
  }

  /* Repartidor que lo lleva (opcional): sus pedidos le salen en el móvil */
  let driver = null
  if (req.body.driverId) {
    const { data: d, error: dError } = await db().from('drivers').select('id, name')
      .eq('id', String(req.body.driverId)).eq('location_id', locationId).maybeSingle()
    if (dError) throw dError
    if (!d) return res.status(400).json({ error: 'Ese repartidor no es de esta sede.' })
    driver = d
  }

  const routeId = randomUUID()
  const { data: updated, error: updError } = await db().from('orders')
    .update({ dispatched_at: new Date().toISOString(), route_id: routeId, status: 'listo', ...(driver ? { driver_id: driver.id, driver_name: driver.name } : {}) })
    .in('id', ids).select('*')
  if (updError) throw updError

  await Promise.all(updated.map((order) => sendCustomerNotification(order, 'reparto')))

  return res.status(200).json({ routeId, orders: updated })
}

async function undo(req, res, locationId) {
  const routeId = String(req.body.routeId || '')
  const run = (changes) => db().from('orders').update(changes)
    .eq('route_id', routeId).eq('location_id', locationId).neq('status', 'entregado')
    .select('*')
  let { data, error } = await run({ dispatched_at: null, route_id: null, driver_id: null, driver_name: null })
  /* Sin supabase/repartidores.sql todavía: se deshace igual */
  if (['42703', 'PGRST204'].includes(error?.code)) ({ data, error } = await run({ dispatched_at: null, route_id: null }))
  if (error) throw error
  return res.status(200).json({ orders: data })
}
