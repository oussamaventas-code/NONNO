import { db, isConfigured } from './supabase.js'
import { requireSession, SCOPE_ALL } from './auth.js'
import { readMenuOverrides, loadMenu } from './menu.js'
import { getLocation } from '../../src/data/locations.js'
import { PRODUCTS, ingredientCatalog } from '../../src/data/menu.js'

/* ═══════════════════════════════════════════════════════════════
   Carta editable.

   GET  /api/menu            público (entra por api/store-status.js, ver vercel.json) → { prices, hidden, soldOut }
   POST /api/menu  (panel)
        { action: 'price',   productId, price? , portionPrices? }   solo dirección
        { action: 'hidden',  productId, hidden }                    solo dirección
        { action: 'soldOut', location, productId, soldOut }         cada sede la suya
        { action: 'ingredientOut', location, ingredient, soldOut }  cada sede el suyo
   ═══════════════════════════════════════════════════════════════ */

const trim = (v, max) => String(v ?? '').trim().slice(0, max)
const KNOWN = new Set(PRODUCTS.map((p) => p.id))
const KNOWN_INGREDIENTS = new Set(ingredientCatalog().map((i) => i.key))

/** Precio válido (0–999,99) o null si viene vacío. undefined = no válido. */
function parsePrice(v) {
  if (v === null || v === '' || v === undefined) return null
  const n = Number(String(v).replace(',', '.'))
  return Number.isFinite(n) && n >= 0 && n <= 999.99 ? Math.round(n * 100) / 100 : undefined
}

export default async function handler(req, res) {
  if (!isConfigured()) {
    /* Sin base de datos la web sigue con la carta base. */
    if (req.method === 'GET') return res.status(200).json({ prices: {}, hidden: [], soldOut: {} })
    return res.status(503).json({ error: 'El sistema todavía no está conectado a la base de datos.' })
  }

  try {
    if (req.method === 'GET') {
      res.setHeader('Cache-Control', 'public, s-maxage=10, stale-while-revalidate=30')
      return res.status(200).json(await readMenuOverrides())
    }

    if (req.method === 'POST') {
      const session = requireSession(req, res)
      if (!session) return
      const { action } = req.body || {}

      /* Ingrediente agotado: las pizzas que lo llevan se descartan solas */
      if (action === 'ingredientOut') {
        const locationId = trim(req.body?.location, 40)
        const key = trim(req.body?.ingredient, 80)
        if (!getLocation(locationId)) return res.status(400).json({ error: 'Sede no válida.' })
        if (!KNOWN_INGREDIENTS.has(key)) return res.status(400).json({ error: 'Ese ingrediente no existe.' })
        if (session.scope !== SCOPE_ALL && session.scope !== locationId) {
          return res.status(403).json({ error: 'No puedes cambiar la carta de otra sede.' })
        }
        const q = req.body?.soldOut
          ? db().from('menu_ingredient_soldout').upsert({ location_id: locationId, ingredient_key: key, updated_at: new Date().toISOString() })
          : db().from('menu_ingredient_soldout').delete().eq('location_id', locationId).eq('ingredient_key', key)
        const { error } = await q
        if (error) throw error
        await loadMenu({ force: true })
        return res.status(200).json(await readMenuOverrides())
      }

      const productId = trim(req.body?.productId, 60)
      if (!KNOWN.has(productId)) return res.status(400).json({ error: 'Ese producto no existe.' })

      if (action === 'soldOut') {
        const locationId = trim(req.body?.location, 40)
        if (!getLocation(locationId)) return res.status(400).json({ error: 'Sede no válida.' })
        if (session.scope !== SCOPE_ALL && session.scope !== locationId) {
          return res.status(403).json({ error: 'No puedes cambiar la carta de otra sede.' })
        }
        const q = req.body?.soldOut
          ? db().from('menu_soldout').upsert({ location_id: locationId, product_id: productId, updated_at: new Date().toISOString() })
          : db().from('menu_soldout').delete().eq('location_id', locationId).eq('product_id', productId)
        const { error } = await q
        if (error) throw error
        await loadMenu({ force: true })
        return res.status(200).json(await readMenuOverrides())
      }

      /* Precios y ocultar producto afectan a todas las sedes: solo dirección. */
      if (session.scope !== SCOPE_ALL) {
        return res.status(403).json({ error: 'Solo la dirección puede cambiar precios o quitar productos de la carta.' })
      }

      const { data: current, error: readError } = await db().from('menu_overrides')
        .select('product_id, price, portion_prices, hidden').eq('product_id', productId).maybeSingle()
      if (readError) throw readError
      const row = { product_id: productId, price: current?.price ?? null, portion_prices: current?.portion_prices ?? null, hidden: current?.hidden ?? false }

      if (action === 'price') {
        const base = PRODUCTS.find((p) => p.id === productId)
        if (base.portions) {
          const next = {}
          for (const portion of base.portions) {
            const v = parsePrice(req.body?.portionPrices?.[portion.id])
            if (v === undefined) return res.status(400).json({ error: 'Precio no válido.' })
            if (v !== null) next[portion.id] = v
          }
          row.portion_prices = Object.keys(next).length ? next : null
        } else {
          const v = parsePrice(req.body?.price)
          if (v === undefined) return res.status(400).json({ error: 'Precio no válido.' })
          row.price = v
        }
      } else if (action === 'hidden') {
        row.hidden = Boolean(req.body?.hidden)
      } else {
        return res.status(400).json({ error: 'Acción no válida.' })
      }

      row.updated_at = new Date().toISOString()
      const clean = row.price === null && row.portion_prices === null && !row.hidden
      const { error } = clean
        ? await db().from('menu_overrides').delete().eq('product_id', productId)
        : await db().from('menu_overrides').upsert(row)
      if (error) throw error
      await loadMenu({ force: true })
      return res.status(200).json(await readMenuOverrides())
    }
  } catch (err) {
    console.error('Error en la carta:', err)
    return res.status(500).json({ error: 'No hemos podido guardar la carta. ¿Está creada la tabla en Supabase? Mira PEDIDOS.md.' })
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).json({ error: 'Método no permitido' })
}
