import { db } from './supabase.js'
import { isMissingTable } from './customer.js'
import { overridesFromRows } from '../../src/lib/menuOverrides.js'
import { setMenuOverrides } from '../../src/data/menu.js'

/* Carga las correcciones de la carta (precios, ocultos, agotados) y
   las aplica al módulo de la carta de ESTA ejecución. Así el servidor
   recalcula cada pedido con los mismos precios que ve el cliente.

   Sin las tablas creadas (o sin base de datos) se queda la carta base:
   nada se rompe, solo no hay correcciones. */

const TTL_MS = 15000
let loadedAt = 0
let inflight = null
const missingColumn = (error) => ['42703', 'PGRST204'].includes(error?.code)

export async function readMenuOverrides() {
  let o = await db().from('menu_overrides').select('product_id, price, portion_prices, hidden, content')
  let hasContent = true
  if (missingColumn(o.error)) {
    hasContent = false
    o = await db().from('menu_overrides').select('product_id, price, portion_prices, hidden')
  }
  const [s, i, d] = await Promise.all([
    db().from('menu_soldout').select('location_id, product_id'),
    db().from('menu_ingredient_soldout').select('location_id, ingredient_key'),
    db().from('discounts').select('*').eq('active', true),
  ])
  /* Sin la tabla de descuentos (supabase/descuentos.sql) todo sigue igual */
  if (d.error && !isMissingTable(d.error)) throw d.error
  const discountRows = d.error ? [] : d.data
  for (const r of [o, s]) {
    if (r.error) {
      if (isMissingTable(r.error)) return overridesFromRows([], [], i.error ? [] : i.data, discountRows)
      throw r.error
    }
  }
  /* Si aún no se ha creado la tabla de ingredientes, el resto sigue funcionando */
  if (i.error && !isMissingTable(i.error)) throw i.error
  return overridesFromRows(
    hasContent ? o.data : o.data.map((row) => ({ ...row, content: null })),
    s.data,
    i.error ? [] : i.data,
    discountRows
  )
}

/**
 * @param {{ force?: boolean }} opts  force: al guardar un pedido se lee siempre fresco
 */
export async function loadMenu({ force = false } = {}) {
  if (!force && Date.now() - loadedAt < TTL_MS) return
  inflight ||= readMenuOverrides()
    .then((next) => { setMenuOverrides(next); loadedAt = Date.now() })
    .catch((err) => { console.error('No se pudo leer la carta editable:', err) })
    .finally(() => { inflight = null })
  await inflight
}
