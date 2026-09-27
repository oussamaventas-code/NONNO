import { db, isConfigured } from './_lib/supabase.js'
import { requireSession, readSession, SCOPE_ALL } from './_lib/auth.js'
import { notifyNewOrder } from './_lib/push.js'
import { sanitizeOrder, validateOrder } from './_lib/order.js'
import { isStoreOpen } from './_lib/store.js'
import { precheck, assignSlot, SLOT_ERRORS } from './_lib/slots.js'
import { notifyCustomer } from './_lib/sms.js'

const reply = (row, staff) => ({
  id: row.id,
  ref: row.ref,
  status: row.status,
  total: row.total,
  readyAt: row.ready_at,
  etaAt: row.eta_at,
  ...(staff ? { order: row } : {}),
})

async function findByClientKey(key) {
  if (!key) return null
  const { data } = await db().from('orders').select('*').eq('client_key', key).maybeSingle()
  return data
}

/** Hora ISO de las últimas 12 h (nunca futura), o null. */
function validPastTime(value) {
  const t = Date.parse(value)
  if (!Number.isFinite(t) || t > Date.now() + 60000 || t < Date.now() - 12 * 3600000) return null
  return new Date(t).toISOString()
}

export default async function handler(req, res) {
  if (!isConfigured()) {
    return res.status(503).json({
      error: 'El sistema de pedidos todavía no está conectado a la base de datos.',
    })
  }

  /* ── Crear pedido ───────────────────────────────────────────────
     Público desde la web. Desde el panel (mostrador o teléfono) llega
     con `channel` y sesión: entonces no depende del interruptor de la
     web, pero sí de las franjas del horno, igual que todos. */
  if (req.method === 'POST') {
    /* Solo mostrador y teléfono son pedidos del personal. La web manda
       channel: 'web' y tiene que seguir entrando sin sesión. */
    const staffChannel = ['mostrador', 'telefono'].includes(req.body?.channel)
    const session = staffChannel ? readSession(req) : null
    if (staffChannel && !session) return res.status(401).json({ error: 'No autorizado' })
    const staff = Boolean(session)

    const parsed = sanitizeOrder(req.body, { staff })
    const problem = validateOrder(parsed)
    if (problem) return res.status(400).json({ error: problem })
    const { order } = parsed

    if (staff && session.scope !== SCOPE_ALL && session.scope !== order.location_id) {
      return res.status(403).json({ error: 'No puedes crear pedidos en otra sede.' })
    }

    /* Mismo pedido reenviado (reintento, o cola del mostrador sin
       conexión): se devuelve el que ya existe en vez de duplicarlo. */
    const existing = await findByClientKey(order.client_key)
    if (existing) return res.status(200).json(reply(existing, staff))

    /* Pedido que el mostrador tomó SIN CONEXIÓN y ya salió en papel a
       cocina: se registra aunque el horno ya no tenga hueco, porque
       ya se está haciendo. Solo el personal puede hacerlo. */
    const offlineAt = staff ? validPastTime(req.body?.offlineAt) : null
    if (offlineAt) order.created_at = offlineAt

    /* La web ya avisa si la sede está cerrada, pero el servidor es
       quien de verdad lo impide: nadie se lo salta reenviando la
       petición a mano. */
    if (!staff && !(await isStoreOpen(order.location_id))) {
      return res.status(503).json({ code: 'closed', error: 'Esta sede está cerrada ahora mismo. No se pueden hacer pedidos.' })
    }

    /* Primer filtro: si ya no cabe, ni se guarda. */
    if (!offlineAt) {
      try {
        const plan = await precheck(order.location_id, order.pizza_count)
        if (!plan.ok) return res.status(409).json({ code: 'full', error: SLOT_ERRORS[plan.reason] })
      } catch (err) {
        console.error('Error leyendo la carga del horno:', err)
        return res.status(500).json({ error: 'No hemos podido registrar el pedido.' })
      }
    }

    const { data, error } = await db()
      .from('orders')
      .insert(order)
      .select('id')
      .single()

    if (error) {
      /* Dos envíos del mismo pedido a la vez: gana uno, el otro lo recoge. */
      const dup = error.code === '23505' ? await findByClientKey(order.client_key) : null
      if (dup) return res.status(200).json(reply(dup, staff))
      console.error('Error guardando el pedido:', error)
      return res.status(500).json({ error: 'No hemos podido registrar el pedido.' })
    }

    /* Franja definitiva, con este pedido ya dentro. Si no cabe o algo
       falla, el pedido se retira: mejor un error claro que un pedido
       sin hora en cocina. Salvo los tomados sin conexión: esos se
       quedan sin franja, porque ya están en el horno. */
    let assigned
    try {
      assigned = await assignSlot(data.id, order.location_id, parsed.delivery)
    } catch (err) {
      console.error('Error asignando franja:', err)
      assigned = { ok: false }
    }
    if (!assigned.ok && offlineAt) {
      const { data: kept } = await db().from('orders').update({ oven_slots: [] }).eq('id', data.id).select('*').single()
      assigned = { ok: true, row: kept }
    }
    if (!assigned.ok) {
      await db().from('orders').delete().eq('id', data.id)
      return res.status(409).json({ code: 'full', error: SLOT_ERRORS[assigned.reason] || 'No hemos podido registrar el pedido.' })
    }
    const row = assigned.row

    /* Los avisos no deben tumbar el pedido si fallan. */
    try {
      await notifyNewOrder(row)
    } catch (err) {
      console.error('Error enviando la notificación:', err)
    }
    try {
      const sms = await notifyCustomer(db(), row, 'recibido')
      if (sms) row.sms = sms
    } catch (err) {
      console.error('Error enviando el SMS:', err)
    }

    return res.status(201).json(reply(row, staff))
  }

  /* ── Listar pedidos (solo panel) ────────────────────────────── */
  if (req.method === 'GET') {
    const session = requireSession(req, res)
    if (!session) return

    const limit = Math.min(200, Math.max(1, Number(req.query?.limit) || 60))
    const since = req.query?.since

    let query = db()
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    /* El filtro por sede sale de la SESIÓN, nunca de lo que pida el
       navegador: quien entra con la clave de una sede no puede ver la
       otra ni manipulando la petición. */
    if (session.scope !== SCOPE_ALL) query = query.eq('location_id', session.scope)

    if (since) query = query.gt('created_at', since)

    const { data, error } = await query
    if (error) {
      console.error('Error leyendo pedidos:', error)
      return res.status(500).json({ error: 'No hemos podido cargar los pedidos.' })
    }

    return res.status(200).json({ orders: data })
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).json({ error: 'Método no permitido' })
}
