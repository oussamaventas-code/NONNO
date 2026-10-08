import { db, isConfigured } from './supabase.js'
import { requireSession, requireSuperadmin, SCOPE_ALL } from './auth.js'
import { readMenuOverrides, loadMenu } from './menu.js'
import { getLocation } from '../../src/data/locations.js'
import { PRODUCTS, CATEGORIES, ingredientCatalog } from '../../src/data/menu.js'
import { ALLERGENS } from '../../src/data/siteContent.js'
import { PHOTO } from '../../src/data/images.js'
import { isMissingTable } from './customer.js'
import { discountFromRow, DISCOUNT_KINDS, DISCOUNT_TARGETS } from '../../src/lib/discounts.js'

/* ═══════════════════════════════════════════════════════════════
   Carta editable.

   GET  /api/menu            público (entra por api/store-status.js, ver vercel.json) → { prices, hidden, soldOut }
   POST /api/menu  (panel)
        { action: 'price',   productId, price? , portionPrices? }   solo dirección
        { action: 'hidden',  productId, hidden }                    solo dirección
        { action: 'soldOut', location, productId, soldOut }         cada sede la suya
        { action: 'ingredientOut', location, ingredient, soldOut }  cada sede el suyo
        { action: 'discountSave', discount }                       solo dirección
        { action: 'discountDelete', id }                           solo dirección
   GET  /api/menu?discounts=all  (panel, dirección) → { discounts } todos, también los apagados
   ═══════════════════════════════════════════════════════════════ */

const trim = (v, max) => String(v ?? '').trim().slice(0, max)
const KNOWN = new Set(PRODUCTS.map((p) => p.id))
const KNOWN_INGREDIENTS = new Set(ingredientCatalog().map((i) => i.key))
const KNOWN_CATEGORIES = new Set(CATEGORIES.map((c) => c.id))
const KNOWN_ALLERGENS = new Set(ALLERGENS.map((a) => a.id))
const KNOWN_IMAGES = new Set(Object.values(PHOTO))
const MENU_SCHEMA_MESSAGE = 'Falta actualizar la carta editable: ejecuta supabase/carta.sql en Supabase.'

const NO_TABLE = 'Falta crear la tabla de descuentos: ejecuta supabase/descuentos.sql en Supabase (mira PEDIDOS.md).'

/** Fecha opcional: null si viene vacía, undefined si no es válida. */
function parseDate(v) {
  if (v === null || v === undefined || v === '') return null
  const t = Date.parse(v)
  return Number.isFinite(t) ? new Date(t).toISOString() : undefined
}

/** Descuento que llega del panel → fila lista para guardar, o { error }. */
function discountRow(body) {
  const name = trim(body?.name, 60)
  if (!name) return { error: 'Ponle un nombre al descuento.' }
  const kind = DISCOUNT_KINDS.includes(body?.kind) ? body.kind : null
  if (!kind) return { error: 'Elige si es en % o en €.' }
  const value = Number(String(body?.value ?? '').replace(',', '.'))
  if (!Number.isFinite(value) || value <= 0) return { error: 'El descuento tiene que ser mayor que 0.' }
  if (kind === 'percent' && value > 90) return { error: 'Como mucho un 90 %.' }
  if (kind === 'amount' && value > 100) return { error: 'Como mucho 100 €.' }
  const target = DISCOUNT_TARGETS.includes(body?.target) ? body.target : null
  if (!target) return { error: 'Elige a qué se aplica.' }
  const known = target === 'categories' ? KNOWN_CATEGORIES : KNOWN
  const ids = target === 'all' ? [] : [...new Set((Array.isArray(body?.targetIds) ? body.targetIds : []).map((x) => trim(x, 60)))].filter((x) => known.has(x))
  if (target !== 'all' && !ids.length) return { error: target === 'categories' ? 'Elige al menos una categoría.' : 'Elige al menos un producto.' }
  const startsAt = parseDate(body?.startsAt)
  const endsAt = parseDate(body?.endsAt)
  if (startsAt === undefined || endsAt === undefined) return { error: 'Fecha no válida.' }
  if (startsAt && endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) return { error: 'La fecha de fin tiene que ser después de la de inicio.' }
  return {
    row: {
      name, kind, value: Math.round(value * 100) / 100, target, target_ids: ids,
      starts_at: startsAt, ends_at: endsAt, active: body?.active !== false, updated_at: new Date().toISOString(),
    },
  }
}

const listDiscounts = async () => {
  const { data, error } = await db().from('discounts').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return { discounts: data.map(discountFromRow) }
}

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
    if (req.method === 'GET' && req.query?.discounts === 'all') {
      const session = requireSession(req, res)
      if (!session) return
      if (session.scope !== SCOPE_ALL) return res.status(403).json({ error: 'Solo la dirección gestiona los descuentos.' })
      try {
        return res.status(200).json(await listDiscounts())
      } catch (err) {
        if (isMissingTable(err)) return res.status(200).json({ discounts: [], missingTable: true })
        throw err
      }
    }

    if (req.method === 'GET') {
      res.setHeader('Cache-Control', 'public, s-maxage=10, stale-while-revalidate=30')
      return res.status(200).json(await readMenuOverrides())
    }

    if (req.method === 'POST') {
      const session = requireSession(req, res)
      if (!session) return
      const { action } = req.body || {}

      /* Descuentos: rebajan precios en todas las sedes, solo dirección */
      if (action === 'discountSave' || action === 'discountDelete') {
        if (session.scope !== SCOPE_ALL) return res.status(403).json({ error: 'Solo la dirección gestiona los descuentos.' })
        const id = trim(req.body?.id ?? req.body?.discount?.id, 40)
        let q
        if (action === 'discountDelete') {
          if (!id) return res.status(400).json({ error: 'Falta el descuento.' })
          q = db().from('discounts').delete().eq('id', id)
        } else {
          const { row, error: invalid } = discountRow(req.body?.discount)
          if (invalid) return res.status(400).json({ error: invalid })
          q = id ? db().from('discounts').update(row).eq('id', id) : db().from('discounts').insert(row)
        }
        const { error } = await q
        if (error) {
          if (isMissingTable(error)) return res.status(503).json({ error: NO_TABLE })
          throw error
        }
        await loadMenu({ force: true })
        return res.status(200).json(await listDiscounts())
      }

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

      if (action === 'content') {
        if (!requireSuperadmin(req, res)) return
        const content = req.body?.content || {}
        const name = trim(content.name, 80)
        const description = trim(content.description, 360)
        const category = trim(content.category, 60)
        const ingredients = Array.isArray(content.ingredients)
          ? [...new Set(content.ingredients.map((x) => trim(x, 60)).filter(Boolean))].slice(0, 24)
          : null
        const allergens = Array.isArray(content.allergens)
          ? [...new Set(content.allergens.map((x) => trim(x, 60)))]
          : null
        const image = content.image === null || content.image === ''
          ? null
          : trim(content.image, 1000)
        const baseUrl = process.env.SUPABASE_URL?.replace(/\/+$/, '')
        const uploadedImage = Boolean(baseUrl && image?.startsWith(baseUrl + '/storage/v1/object/public/nonno-site-assets/'))
        const localImage = typeof image === 'string' && (
          KNOWN_IMAGES.has(image) || image.startsWith('own:') || image.startsWith('/fotos/') || image.startsWith('/ilustraciones/')
        )
        if (!name) return res.status(400).json({ error: 'Escribe un nombre para el producto.' })
        if (!KNOWN_CATEGORIES.has(category)) return res.status(400).json({ error: 'Elige una categoría válida.' })
        if (!Array.isArray(content.ingredients) || ingredients.length !== content.ingredients.filter((x) => trim(x, 60)).length || content.ingredients.length > 24) {
          return res.status(400).json({ error: 'Revisa la lista de ingredientes (máximo 24).'})
        }
        if (!Array.isArray(content.allergens) || content.allergens.some((id) => !KNOWN_ALLERGENS.has(id))) {
          return res.status(400).json({ error: 'La selección de alérgenos no es válida.' })
        }
        if (image && !uploadedImage && !localImage) {
          return res.status(400).json({ error: 'Sube la foto desde el selector de imágenes.' })
        }

        const { data: current, error: readError } = await db().from('menu_overrides')
          .select('product_id, price, portion_prices, hidden, content').eq('product_id', productId).maybeSingle()
        if (readError) {
          if (['42703', 'PGRST204'].includes(readError.code)) return res.status(503).json({ error: MENU_SCHEMA_MESSAGE })
          throw readError
        }
        const row = {
          product_id: productId,
          price: current?.price ?? null,
          portion_prices: current?.portion_prices ?? null,
          hidden: current?.hidden ?? false,
          content: {
            ...(current?.content || {}),
            name,
            description,
            category,
            ingredients,
            allergens,
            image,
          },
          updated_at: new Date().toISOString(),
        }

        if (Object.prototype.hasOwnProperty.call(req.body || {}, 'price')) {
          const base = PRODUCTS.find((p) => p.id === productId)
          if (base.portions) {
            const next = {}
            for (const portion of base.portions) {
              const value = parsePrice(req.body?.portionPrices?.[portion.id])
              if (value === undefined) return res.status(400).json({ error: 'Precio no válido.' })
              if (value !== null) next[portion.id] = value
            }
            row.price = null
            row.portion_prices = Object.keys(next).length ? next : null
          } else {
            const value = parsePrice(req.body?.price)
            if (value === undefined) return res.status(400).json({ error: 'Precio no válido.' })
            row.price = value
            row.portion_prices = null
          }
        }

        const { error } = await db().from('menu_overrides').upsert(row)
        if (error) {
          if (['42703', 'PGRST204'].includes(error.code)) return res.status(503).json({ error: MENU_SCHEMA_MESSAGE })
          throw error
        }
        await loadMenu({ force: true })
        return res.status(200).json(await readMenuOverrides())
      }

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

      let currentResult = await db().from('menu_overrides')
        .select('product_id, price, portion_prices, hidden, content').eq('product_id', productId).maybeSingle()
      let hasContentColumn = true
      if (['42703', 'PGRST204'].includes(currentResult.error?.code)) {
        hasContentColumn = false
        currentResult = await db().from('menu_overrides')
          .select('product_id, price, portion_prices, hidden').eq('product_id', productId).maybeSingle()
      }
      const { data: current, error: readError } = currentResult
      if (readError) throw readError
      const row = {
        product_id: productId,
        price: current?.price ?? null,
        portion_prices: current?.portion_prices ?? null,
        hidden: current?.hidden ?? false,
      }
      if (hasContentColumn) row.content = current?.content ?? null

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
      const clean = row.price === null && row.portion_prices === null && !row.hidden && (!hasContentColumn || !row.content)
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
