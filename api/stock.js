import { db, isConfigured } from './_lib/supabase.js'
import { requireSession, SCOPE_ALL } from './_lib/auth.js'
import { getLocation } from '../src/data/locations.js'
import { madridDay, parseQty } from '../src/lib/stock.js'

/* ═══════════════════════════════════════════════════════════════
   Checklist de stock (solo panel).

   GET  /api/stock?location=sangonera[&day=2026-09-27]
        → productos de la sede + recuento de ese día (hoy por defecto)
   POST /api/stock  { location, action, ... }
        action 'count'      { itemId, onHand?, bought? }  apunta el recuento de hoy
        action 'saveItem'   { id?, name, unit, target }   crea o cambia un producto
        action 'deleteItem' { id }
   ═══════════════════════════════════════════════════════════════ */

const DAY = /^\d{4}-\d{2}-\d{2}$/
const trim = (v, max) => String(v ?? '').trim().slice(0, max)

export default async function handler(req, res) {
  if (!isConfigured()) {
    return res.status(503).json({ error: 'El sistema todavía no está conectado a la base de datos.' })
  }
  const session = requireSession(req, res)
  if (!session) return

  const locationId = trim(req.method === 'GET' ? req.query?.location : req.body?.location, 40)
  if (!getLocation(locationId)) return res.status(400).json({ error: 'Sede no válida.' })
  if (session.scope !== SCOPE_ALL && session.scope !== locationId) {
    return res.status(403).json({ error: 'No puedes ver el stock de otra sede.' })
  }

  try {
    if (req.method === 'GET') {
      const day = DAY.test(req.query?.day || '') ? req.query.day : madridDay()
      const [items, counts] = await Promise.all([
        db().from('stock_items').select('id, name, unit, target, position')
          .eq('location_id', locationId).order('position').order('created_at'),
        db().from('stock_counts').select('item_id, on_hand, bought, updated_at')
          .eq('location_id', locationId).eq('day', day),
      ])
      if (items.error) throw items.error
      if (counts.error) throw counts.error
      return res.status(200).json({ day, items: items.data, counts: counts.data })
    }

    if (req.method === 'POST') {
      const { action } = req.body || {}
      if (action === 'count') return await saveCount(req, res, locationId)
      if (action === 'saveItem') return await saveItem(req, res, locationId)
      if (action === 'deleteItem') return await deleteItem(req, res, locationId)
      return res.status(400).json({ error: 'Acción no válida.' })
    }
  } catch (err) {
    console.error('Error en stock:', err)
    return res.status(500).json({ error: 'No hemos podido guardar el stock.' })
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).json({ error: 'Método no permitido' })
}

/** El producto tiene que ser de esta sede: nadie apunta en la lista de otra. */
async function ownItem(locationId, id) {
  const { data, error } = await db().from('stock_items').select('id')
    .eq('id', id).eq('location_id', locationId).maybeSingle()
  if (error) throw error
  return Boolean(data)
}

/* El recuento siempre es de HOY: no se reescribe el histórico. */
async function saveCount(req, res, locationId) {
  const { itemId, onHand, bought } = req.body
  if (!(await ownItem(locationId, itemId))) return res.status(404).json({ error: 'Ese producto no es de esta sede.' })

  const row = { location_id: locationId, day: madridDay(), item_id: itemId, updated_at: new Date().toISOString() }
  if (onHand !== undefined) {
    const qty = parseQty(onHand)
    if (onHand !== null && onHand !== '' && qty === null) return res.status(400).json({ error: 'Cantidad no válida.' })
    row.on_hand = qty
  }
  if (bought !== undefined) row.bought = Boolean(bought)

  const { data, error } = await db().from('stock_counts')
    .upsert(row, { onConflict: 'location_id,day,item_id' })
    .select('item_id, on_hand, bought, updated_at').single()
  if (error) throw error
  return res.status(200).json({ count: data })
}

async function saveItem(req, res, locationId) {
  const { id } = req.body
  const name = trim(req.body.name, 60)
  const unit = trim(req.body.unit, 12) || 'kg'
  const target = parseQty(req.body.target)
  if (!name) return res.status(400).json({ error: 'Falta el nombre del producto.' })
  if (target === null) return res.status(400).json({ error: 'El objetivo tiene que ser un número.' })

  if (id) {
    if (!(await ownItem(locationId, id))) return res.status(404).json({ error: 'Ese producto no es de esta sede.' })
    const { data, error } = await db().from('stock_items').update({ name, unit, target })
      .eq('id', id).select('id, name, unit, target, position').single()
    if (error) throw error
    return res.status(200).json({ item: data })
  }

  const { count } = await db().from('stock_items').select('id', { count: 'exact', head: true }).eq('location_id', locationId)
  const { data, error } = await db().from('stock_items')
    .insert({ location_id: locationId, name, unit, target, position: count || 0 })
    .select('id, name, unit, target, position').single()
  if (error) throw error
  return res.status(201).json({ item: data })
}

async function deleteItem(req, res, locationId) {
  const { id } = req.body
  if (!(await ownItem(locationId, id))) return res.status(404).json({ error: 'Ese producto no es de esta sede.' })
  const { error } = await db().from('stock_items').delete().eq('id', id)
  if (error) throw error
  return res.status(200).json({ deleted: id })
}
