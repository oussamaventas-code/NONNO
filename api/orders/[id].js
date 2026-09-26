import { db, isConfigured } from '../_lib/supabase.js'
import { requireSession, SCOPE_ALL } from '../_lib/auth.js'
import { sanitizeOrder, validateOrder, PAYMENT_METHODS } from '../_lib/order.js'
import { assignSlot, SLOT_ERRORS } from '../_lib/slots.js'

const STATUSES = ['nuevo', 'horno', 'listo', 'entregado', 'cancelado']
const PAYMENT_STATUSES = ['pendiente', 'pagado']

/* Campos que cambia una edición desde el mostrador. Se guardan los
   de antes para poder deshacerla si el horno no tiene hueco. */
const EDITABLE = [
  'mode', 'customer_name', 'customer_phone', 'address', 'delivery_zone', 'notes',
  'items', 'item_count', 'pizza_count', 'subtotal', 'discount', 'deals', 'delivery_fee', 'total',
  'oven_slots', 'ready_at', 'eta_at', 'edited_at', 'printed_at',
]
const pick = (obj, keys) => Object.fromEntries(keys.map((k) => [k, obj[k] ?? null]))

/**
 * Actualiza un pedido desde el panel: estado en cocina, marcas de
 * visto/impreso, cobro, o edición completa del contenido. Solo con sesión.
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

  /* Una sede no puede tocar los pedidos de la otra: la condición va
     en la propia consulta, así que ni existiendo el id ajeno cambia nada. */
  const scoped = (query) => (session.scope !== SCOPE_ALL ? query.eq('location_id', session.scope) : query)

  if (req.body?.edit) return editOrder(req, res, id, scoped)

  const patch = {}
  const { status, printed, seen, paymentStatus, paymentMethod } = req.body || {}

  if (status !== undefined) {
    if (!STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Estado no válido.' })
    }
    patch.status = status
  }
  if (printed) patch.printed_at = new Date().toISOString()
  if (seen) patch.seen_at = new Date().toISOString()
  if (paymentStatus !== undefined) {
    if (!PAYMENT_STATUSES.includes(paymentStatus)) {
      return res.status(400).json({ error: 'Estado de pago no válido.' })
    }
    patch.payment_status = paymentStatus
    patch.payment_method = paymentStatus === 'pagado'
      ? (PAYMENT_METHODS.includes(paymentMethod) ? paymentMethod : 'efectivo')
      : null
    patch.paid_at = paymentStatus === 'pagado' ? new Date().toISOString() : null
  }

  if (!Object.keys(patch).length) {
    return res.status(400).json({ error: 'Nada que actualizar.' })
  }

  const { data, error } = await scoped(db().from('orders').update(patch).eq('id', id))
    .select('*')
    .maybeSingle()

  if (error) {
    console.error('Error actualizando el pedido:', error)
    return res.status(500).json({ error: 'No hemos podido actualizar el pedido.' })
  }
  if (!data) {
    return res.status(404).json({ error: 'Ese pedido no es de esta sede.' })
  }

  return res.status(200).json({ order: data })
}

/**
 * Edición desde el mostrador: se recalcula todo con la carta (precios,
 * oferta, envío) y se vuelve a asignar franja. Si con los cambios ya
 * no cabe en el horno, el pedido se queda como estaba.
 */
async function editOrder(req, res, id, scoped) {
  const { data: current, error: readError } = await scoped(db().from('orders').select('*').eq('id', id)).maybeSingle()
  if (readError) {
    console.error('Error leyendo el pedido:', readError)
    return res.status(500).json({ error: 'No hemos podido actualizar el pedido.' })
  }
  if (!current) return res.status(404).json({ error: 'Ese pedido no es de esta sede.' })
  if (['entregado', 'cancelado'].includes(current.status)) {
    return res.status(409).json({ error: 'Un pedido entregado o cancelado no se puede editar.' })
  }

  const edit = req.body.edit
  const parsed = sanitizeOrder(
    { ...edit, ref: current.ref, location: { id: current.location_id }, channel: current.channel },
    { staff: true },
  )
  parsed.order.channel = current.channel
  const problem = validateOrder(parsed)
  if (problem) return res.status(400).json({ error: problem })

  const now = new Date().toISOString()
  const patch = {
    ...pick(parsed.order, EDITABLE),
    oven_slots: null,
    ready_at: null,
    eta_at: null,
    edited_at: now,
    /* Cocina tiene que volver a imprimir la comanda nueva */
    printed_at: null,
  }

  const { error: updateError } = await db().from('orders').update(patch).eq('id', id)
  if (updateError) {
    console.error('Error editando el pedido:', updateError)
    return res.status(500).json({ error: 'No hemos podido actualizar el pedido.' })
  }

  let assigned
  try {
    assigned = await assignSlot(id, current.location_id, parsed.zone)
  } catch (err) {
    console.error('Error reasignando franja:', err)
    assigned = { ok: false }
  }

  if (!assigned.ok) {
    await db().from('orders').update(pick(current, EDITABLE)).eq('id', id)
    return res.status(409).json({
      error: `${SLOT_ERRORS[assigned.reason] || 'No hemos podido actualizar el pedido.'} El pedido se queda como estaba.`,
    })
  }

  return res.status(200).json({ order: assigned.row })
}
