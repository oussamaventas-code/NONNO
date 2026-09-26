import { db } from './supabase.js'

/* ═══════════════════════════════════════════════════════════════
   Apertura de la tienda por sede. Única fuente de verdad: la web
   solo refleja esto, y el servidor lo vuelve a comprobar al crear
   un pedido para que nadie se lo pueda saltar. Si la tabla no
   existe todavía (falta el schema.sql actualizado) o la fila no
   está, se trata como abierta para no romper instalaciones antiguas.
   ═══════════════════════════════════════════════════════════════ */

export async function getStoreStatuses() {
  const { data, error } = await db().from('store_status').select('location_id, is_open, updated_at')
  if (error) {
    console.error('Error leyendo el estado de la tienda:', error)
    return {}
  }
  return Object.fromEntries(data.map((r) => [r.location_id, r]))
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
    .select('location_id, is_open, updated_at')
    .single()

  if (error) throw error
  return data
}
