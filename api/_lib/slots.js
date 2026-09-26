import { db, isConfigured } from './supabase.js'
import { buildLoad, planOrder } from '../../src/lib/kitchenSlots.js'
import { getLocation } from '../../src/data/locations.js'

/* Pedidos que ocupan horno: los de las últimas 12 h de esa sede que
   no estén cancelados. Un día de servicio (19–23 h) cabe de sobra. */
export async function activeOrders(locationId) {
  if (!isConfigured()) return []
  const since = new Date(Date.now() - 12 * 3600 * 1000).toISOString()
  const { data, error } = await db()
    .from('orders')
    .select('id, created_at, pizza_count, oven_slots')
    .eq('location_id', locationId)
    .neq('status', 'cancelado')
    .gte('created_at', since)
  if (error) throw error
  return data
}

export async function kitchenLoad(locationId, kitchen) {
  return buildLoad(await activeOrders(locationId), kitchen)
}

export const SLOT_ERRORS = {
  full: 'Estamos a tope: ya no nos caben más pizzas hasta el cierre.',
  'after-hours': 'La cocina ya ha cerrado por hoy. Abrimos de 19:00 a 23:00.',
}

/** ¿Cabría ahora un pedido de N unidades de horno? Sin guardar nada. */
export async function precheck(locationId, pizzas) {
  const kitchen = getLocation(locationId).kitchen
  const { load } = await kitchenLoad(locationId, kitchen)
  return planOrder({ nowMs: Date.now(), kitchen, load, pizzas })
}

/**
 * Asigna franja a un pedido ya guardado con oven_slots = null.
 * Se calcula con todos los pedidos de la sede dentro, incluidos los
 * que entran a la vez: se reparten por orden de llegada, así que el
 * tope de pizzas por franja se respeta siempre.
 * @returns {Promise<{ ok: true, row: object } | { ok: false, reason?: string }>}
 */
export async function assignSlot(orderId, locationId, zone) {
  const kitchen = getLocation(locationId).kitchen
  const { plans } = await kitchenLoad(locationId, kitchen)
  const plan = plans.get(orderId)
  if (!plan?.ok) return { ok: false, reason: plan?.reason }

  const readyAt = new Date(plan.readyAt)
  const etaAt = zone ? new Date(plan.readyAt + zone.minutes * 60000) : readyAt
  const { data, error } = await db()
    .from('orders')
    .update({ oven_slots: plan.slots, ready_at: readyAt.toISOString(), eta_at: etaAt.toISOString() })
    .eq('id', orderId)
    .select('*')
    .single()
  if (error) throw error
  return { ok: true, row: data }
}
