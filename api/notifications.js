import { db, isConfigured } from './_lib/supabase.js'
import { requireSession, SCOPE_ALL } from './_lib/auth.js'
import { guard, clientIp } from './_lib/limiter.js'
import { getLocation } from '../src/data/locations.js'
import {
  CUSTOMER_EVENTS, customerNotificationConfig, notificationDatabaseReady,
  sendCustomerNotification, sendTestSms,
} from './_lib/customerNotifications.js'

export default async function handler(req, res) {
  if (!isConfigured()) return res.status(503).json({ error: 'Base de datos no configurada.' })
  const session = requireSession(req, res)
  if (!session) return
  res.setHeader('Cache-Control', 'no-store')

  try {
    if (req.method === 'GET') {
      return res.status(200).json({ ...customerNotificationConfig(), databaseReady: await notificationDatabaseReady() })
    }
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST')
      return res.status(405).json({ error: 'Método no permitido.' })
    }

    const { action } = req.body || {}
    if (action === 'test') {
      if (session.scope !== SCOPE_ALL) return res.status(403).json({ error: 'Solo dirección puede enviar pruebas.' })
      const locationId = String(req.body.location || '')
      if (!getLocation(locationId)) return res.status(400).json({ error: 'Sede no válida.' })
      const blocked = await guard(res, [[`sms:test:${locationId}:${clientIp(req)}`, { max: 3, window: 900, lock: 900 }]])
      if (blocked) return res.status(429).json({ error: 'Se han enviado varias pruebas. Espera unos minutos.' })
      const sent = await sendTestSms(req.body.phone)
      return res.status(200).json({ sent: true, channel: sent.channel })
    }

    if (action === 'retry') {
      const event = String(req.body.event || '')
      const id = String(req.body.orderId || '')
      if (!CUSTOMER_EVENTS.includes(event) || !/^[0-9a-f-]{36}$/i.test(id)) {
        return res.status(400).json({ error: 'Aviso no válido.' })
      }
      let orderQuery = db().from('orders').select('*').eq('id', id)
      if (session.scope !== SCOPE_ALL) orderQuery = orderQuery.eq('location_id', session.scope)
      const { data: order, error } = await orderQuery.maybeSingle()
      if (error) throw error
      if (!order) {
        return res.status(404).json({ error: 'Ese pedido no es de esta sede.' })
      }
      if (['enviado', 'enviando'].includes(order.sms?.[event]?.status)) {
        return res.status(409).json({ error: 'Ese aviso ya se envió o se está intentando enviar.' })
      }
      await sendCustomerNotification(order, event)
      let latestQuery = db().from('orders').select('sms').eq('id', id)
      if (session.scope !== SCOPE_ALL) latestQuery = latestQuery.eq('location_id', session.scope)
      const { data: latest, error: latestError } = await latestQuery.maybeSingle()
      if (latestError) throw latestError
      return res.status(200).json({ notification: latest?.sms?.[event] || null })
    }

    return res.status(400).json({ error: 'Acción no válida.' })
  } catch (error) {
    console.error('Error en /api/notifications:', error?.code || error?.name || 'error')
    if (error?.message?.startsWith('Configura SMS')) return res.status(503).json({ error: error.message })
    if (['42P01', '42703', 'PGRST202', 'PGRST204'].includes(error?.code)) {
      return res.status(503).json({ error: 'Falta activar el registro de avisos: ejecuta supabase/notificaciones-cliente.sql en Supabase.' })
    }
    return res.status(500).json({ error: 'No hemos podido enviar el aviso.' })
  }
}
