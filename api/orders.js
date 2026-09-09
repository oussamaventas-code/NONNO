import { db, isConfigured } from './_lib/supabase.js'
import { requireSession } from './_lib/auth.js'
import { notifyNewOrder } from './_lib/push.js'
import { sanitizeOrder, validateOrder } from './_lib/order.js'

export default async function handler(req, res) {
  if (!isConfigured()) {
    return res.status(503).json({
      error: 'El sistema de pedidos todavía no está conectado a la base de datos.',
    })
  }

  /* ── Crear pedido (público: lo llama la web del cliente) ────── */
  if (req.method === 'POST') {
    const order = sanitizeOrder(req.body)
    const problem = validateOrder(order)
    if (problem) return res.status(400).json({ error: problem })

    const { data, error } = await db()
      .from('orders')
      .insert(order)
      .select('id, ref, created_at, status')
      .single()

    if (error) {
      console.error('Error guardando el pedido:', error)
      return res.status(500).json({ error: 'No hemos podido registrar el pedido.' })
    }

    /* El aviso no debe tumbar el pedido si falla. */
    try {
      await notifyNewOrder({ ...order, id: data.id })
    } catch (err) {
      console.error('Error enviando la notificación:', err)
    }

    return res.status(201).json({ id: data.id, ref: data.ref, status: data.status })
  }

  /* ── Listar pedidos (solo panel) ────────────────────────────── */
  if (req.method === 'GET') {
    if (requireSession(req, res)) return

    const limit = Math.min(200, Math.max(1, Number(req.query?.limit) || 60))
    const since = req.query?.since

    let query = db()
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

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
