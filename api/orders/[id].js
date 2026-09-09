import { db, isConfigured } from '../_lib/supabase.js'
import { requireSession, SCOPE_ALL } from '../_lib/auth.js'

const STATUSES = ['nuevo', 'horno', 'listo', 'entregado', 'cancelado']

/**
 * Actualiza un pedido desde el panel: su estado en cocina y las
 * marcas de "visto" e "impreso". Solo con sesión.
 */
export default async function handler(req, res) {
  if (!isConfigured()) {
    return res.status(503).json({ error: 'Base de datos no configurada.' })
  }
  const session = requireSession(req, res)
  if (!session) return

  const { id } = req.query
  if (!id) return res.status(400).json({ error: 'Falta el identificador del pedido.' })

  if (req.method !== 'PATCH') {
    res.setHeader('Allow', 'PATCH')
    return res.status(405).json({ error: 'Método no permitido' })
  }

  const patch = {}
  const { status, printed, seen } = req.body || {}

  if (status !== undefined) {
    if (!STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Estado no válido.' })
    }
    patch.status = status
  }
  if (printed) patch.printed_at = new Date().toISOString()
  if (seen) patch.seen_at = new Date().toISOString()

  if (!Object.keys(patch).length) {
    return res.status(400).json({ error: 'Nada que actualizar.' })
  }

  let query = db().from('orders').update(patch).eq('id', id)

  /* Una sede no puede tocar los pedidos de la otra: la condición va
     en la propia consulta, así que ni existiendo el id ajeno cambia nada. */
  if (session.scope !== SCOPE_ALL) query = query.eq('location_id', session.scope)

  const { data, error } = await query.select('*').maybeSingle()

  if (error) {
    console.error('Error actualizando el pedido:', error)
    return res.status(500).json({ error: 'No hemos podido actualizar el pedido.' })
  }
  if (!data) {
    return res.status(404).json({ error: 'Ese pedido no es de esta sede.' })
  }

  return res.status(200).json({ order: data })
}
