import { db } from './supabase.js'
import { serviceDay } from '../../src/lib/orderNumber.js'

/* ═══════════════════════════════════════════════════════════════
   Apertura de la tienda por sede. Única fuente de verdad: la web
   solo refleja esto, y el servidor lo vuelve a comprobar al crear
   un pedido para que nadie se lo pueda saltar. Si la tabla no
   existe todavía (falta el schema.sql actualizado) o la fila no
   está, se trata como abierta para no romper instalaciones antiguas.
   ═══════════════════════════════════════════════════════════════ */

export async function getStoreStatuses() {
  /* select('*'): sin la columna dough_limit (falta supabase/masas.sql) sigue funcionando */
  const { data, error } = await db().from('store_status').select('*')
  if (error) {
    console.error('Error leyendo el estado de la tienda:', error)
    return {}
  }
  const used = await doughUsed(data.filter((r) => Number.isInteger(r.dough_limit)).map((r) => r.location_id))
  return Object.fromEntries(data.map((r) => [r.location_id, withDough(r, used[r.location_id] || 0)]))
}

/* ═══════════════════════════════════════════════════════════════
   Masas del día. Nonno pone cuántas masas tiene cada sede (p. ej. 180)
   y cada unidad de horno de un pedido (pizza, calzone, dulce) gasta
   una. Cuando se acaban, no se vende ni una más. Se cuentan los
   pedidos del día de servicio que no estén cancelados: cada noche
   vuelve a empezar solo. Sin límite (null) no se controla nada.
   ═══════════════════════════════════════════════════════════════ */

const withDough = (row, used) => {
  const limit = Number.isInteger(row.dough_limit) ? row.dough_limit : null
  return {
    location_id: row.location_id, is_open: row.is_open, updated_at: row.updated_at,
    dough_limit: limit, dough_used: limit === null ? null : used, dough_left: limit === null ? null : Math.max(0, limit - used),
  }
}

/** Masas gastadas hoy por sede: { sangonera: 42 } */
async function doughUsed(locationIds) {
  if (!locationIds.length) return {}
  const { data, error } = await db().from('orders').select('location_id, pizza_count')
    .in('location_id', locationIds).eq('service_day', serviceDay()).neq('status', 'cancelado')
  if (error) {
    console.error('Error contando las masas:', error)
    return {}
  }
  const used = {}
  for (const o of data) used[o.location_id] = (used[o.location_id] || 0) + (Number(o.pizza_count) || 0)
  return used
}

/** { limit, used, left } de una sede; limit null = sin control. */
export async function doughStatus(locationId) {
  const { data, error } = await db().from('store_status').select('*').eq('location_id', locationId).maybeSingle()
  if (error || !Number.isInteger(data?.dough_limit)) return { limit: null, used: null, left: null }
  const used = (await doughUsed([locationId]))[locationId] || 0
  return { limit: data.dough_limit, used, left: Math.max(0, data.dough_limit - used) }
}

/** Mensaje para el cliente si el pedido no cabe en las masas que quedan; null si cabe. */
export function doughProblem(dough, pizzas, { staff = false } = {}) {
  if (dough.left === null || !pizzas || pizzas <= dough.left) return null
  if (staff) {
    return `${dough.left === 0 ? 'Sin masas: hoy ya se han gastado todas' : `Solo quedan ${dough.left} masas hoy`} (${dough.used} de ${dough.limit}). La dirección puede subir el número en el panel (⚙ › Tienda).`
  }
  return dough.left === 0
    ? 'Se nos han acabado las masas de hoy: ya no podemos hacer más pizzas. ¡Te esperamos mañana!'
    : `Hoy solo nos quedan masas para ${dough.left} ${dough.left === 1 ? 'pizza' : 'pizzas'}. Quita alguna para poder pedir.`
}

/** Nonno cambia las masas del día de una sede (null = sin límite). */
export async function setDoughLimit(locationId, limit) {
  const { error } = await db().from('store_status')
    .upsert({ location_id: locationId, dough_limit: limit, updated_at: new Date().toISOString() })
  if (error) throw error
  return (await getStoreStatuses())[locationId]
}

export async function isStoreOpen(locationId) {
  const { data, error } = await db()
    .from('store_status')
    .select('is_open')
    .eq('location_id', locationId)
    .maybeSingle()

  if (error) {
    console.error('Error comprobando si la tienda está abierta:', error)
    return true
  }
  if (!data) return true
  return data.is_open === true
}

export async function setStoreOpen(locationId, isOpen) {
  const { data, error } = await db()
    .from('store_status')
    .upsert({ location_id: locationId, is_open: isOpen, updated_at: new Date().toISOString() })

  if (error) throw error
  return (await getStoreStatuses())[locationId]
}
