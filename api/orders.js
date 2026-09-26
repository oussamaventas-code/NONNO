import { db, isConfigured } from './_lib/supabase.js'
import { requireSession, readSession, SCOPE_ALL } from './_lib/auth.js'
import { notifyNewOrder } from './_lib/push.js'
import { sanitizeOrder, validateOrder } from './_lib/order.js'
import { isStoreOpen } from './_lib/store.js'
import { precheck, assignSlot, SLOT_ERRORS } from './_lib/slots.js'

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
    const session = req.body?.channel ? readSession(req) : null
    if (req.body?.channel && !session) return res.status(401).json({ error: 'No autorizado' })
    const staff = Boolean(session)

    const parsed = sanitizeOrder(req.body, { staff })
    const problem = validateOrder(parsed)
    if (problem) return res.status(400).json({ error: problem })
    const { order } = parsed

    if (staff && session.scope !== SCOPE_ALL && session.scope !== order.location_id) {
      return res.status(403).json({ error: 'No puedes crear pedidos en otra sede.' })
    }

    /* La web ya avisa si la sede está cerrada, pero el servidor es
       quien de verdad lo impide: nadie se lo salta reenviando la
       petición a mano. */
    if (!staff && !(await isStoreOpen(order.location_id))) {
      return res.status(503).json({ error: 'Esta sede está cerrada ahora mismo. No se pueden hacer pedidos.' })
    }

    /* Primer filtro: si ya no cabe, ni se guarda. */
    try {
      const plan = await precheck(order.location_id, order.pizza_count)
      if (!plan.ok) return res.status(409).json({ error: SLOT_ERRORS[plan.reason] })
    } catch (err) {
      console.error('Error leyendo la carga del horno:', err)
      return res.status(500).json({ error: 'No hemos podido registrar el pedido.' })
    }

    const { data, error } = await db()
      .from('orders')
      .insert(order)
      .select('id')
      .single()

    if (error) {
      console.error('Error guardando el pedido:', error)
      return res.status(500).json({ error: 'No hemos podido registrar el pedido.' })
    }

    /* Franja definitiva, con este pedido ya dentro. Si no cabe o algo
       falla, el pedido se retira: mejor un error claro que un pedido
       sin hora en cocina. */
    let assigned
    try {
      assigned = await assignSlot(data.id, order.location_id, parsed.zone)
    } catch (err) {
      console.error('Error asignando franja:', err)
      assigned = { ok: false }
    }
    if (!assigned.ok) {
      await db().from('orders').delete().eq('id', data.id)
      return res.status(409).json({ error: SLOT_ERRORS[assigned.reason] || 'No hemos podido registrar el pedido.' })
    }
    const row = assigned.row

    /* El aviso no debe tumbar el pedido si falla. */
    try {
      await notifyNewOrder(row)
    } catch (err) {
      console.error('Error enviando la notificación:', err)
    }

    return res.status(201).json({
      id: row.id,
      ref: row.ref,
      status: row.status,
      total: row.total,
      readyAt: row.ready_at,
      etaAt: row.eta_at,
      ...(staff ? { order: row } : {}),
    })
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
