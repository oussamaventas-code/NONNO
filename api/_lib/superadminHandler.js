import { randomUUID } from 'node:crypto'
import { db, isConfigured } from './supabase.js'
import { requireSuperadmin } from './auth.js'
import { DEFAULT_SITE_CONTENT, ALLERGENS, mergeSiteContent } from '../../src/data/siteContent.js'
import { PHOTO } from '../../src/data/images.js'
import { LOCATIONS } from '../../src/data/locations.js'

const TABLE = 'site_content'
const BUCKET = 'nonno-site-assets'
const LOCATION_IDS = new Set(LOCATIONS.map((location) => location.id))
const IMAGE_IDS = new Set(Object.values(PHOTO))
const ALLERGEN_IDS = new Set(ALLERGENS.map((allergen) => allergen.id))
const MAX_IMAGE_BYTES = 3 * 1024 * 1024

const missingSetup = (error) =>
  ['42P01', 'PGRST205'].includes(error?.code)
  || String(error?.message || '').includes(TABLE)

const boundedText = (value, max) => String(value ?? '').trim().slice(0, max)

function allowedImageUrl(value) {
  if (value === null || value === '') return true
  if (typeof value !== 'string' || value.length > 1000) return false
  if (value.startsWith('/fotos/') || value.startsWith('/ilustraciones/')) return true
  const base = process.env.SUPABASE_URL?.replace(/\/+$/, '')
  return Boolean(base && value.startsWith(base + '/storage/v1/object/public/' + BUCKET + '/'))
}

function httpsUrl(value, max = 500) {
  const text = boundedText(value, max)
  if (!text) return ''
  try {
    const url = new URL(text)
    return url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

function sanitizeContent(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { error: 'Contenido no válido.' }
  const content = mergeSiteContent(value)
  const images = {}
  for (const id of IMAGE_IDS) {
    const url = content.images?.[id]
    if (url === undefined || url === null || url === '') continue
    if (!allowedImageUrl(url)) return { error: 'Una foto no pertenece a la biblioteca de Nonno.' }
    images[id] = url
  }

  const logos = {}
  for (const key of ['main', 'favicon']) {
    const url = content.logos?.[key]
    if (url === null || url === '') { logos[key] = null; continue }
    if (!allowedImageUrl(url)) return { error: 'El logo no pertenece a la biblioteca de Nonno.' }
    logos[key] = url
  }

  const locations = {}
  for (const id of LOCATION_IDS) {
    const location = content.locations?.[id] || {}
    const mapsUrl = httpsUrl(location.mapsUrl)
    if (mapsUrl === null) return { error: 'El enlace de Google Maps debe empezar por https://.' }
    const lat = location.lat === '' || location.lat == null ? null : Number(location.lat)
    const lng = location.lng === '' || location.lng == null ? null : Number(location.lng)
    if ((lat === null) !== (lng === null)) return { error: 'Rellena la latitud y la longitud, o deja ambas vacías.' }
    if (lat !== null && (!Number.isFinite(lat) || lat < -90 || lat > 90)) return { error: 'La latitud no es válida.' }
    if (lng !== null && (!Number.isFinite(lng) || lng < -180 || lng > 180)) return { error: 'La longitud no es válida.' }
    locations[id] = {
      address: boundedText(location.address, 180),
      mapsUrl,
      lat,
      lng,
      hours: boundedText(location.hours, 180),
    }
  }

  const allergenRows = Array.isArray(content.allergens) ? content.allergens : []
  if (allergenRows.length !== ALLERGEN_IDS.size) return { error: 'La lista debe incluir los ocho alérgenos configurados.' }
  const seen = new Set()
  const allergens = []
  for (const row of allergenRows) {
    if (!ALLERGEN_IDS.has(row?.id) || seen.has(row.id)) return { error: 'La lista de alérgenos no es válida.' }
    seen.add(row.id)
    const name = boundedText(row.name, 80)
    if (!name) return { error: 'Cada alérgeno necesita un nombre.' }
    allergens.push({
      id: row.id,
      name,
      presence: boundedText(row.presence, 100),
      details: boundedText(row.details, 360),
    })
  }

  const privacy = content.privacy || {}
  const email = boundedText(privacy.email, 160)
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'El correo de privacidad no es válido.' }

  return {
    content: {
      ...DEFAULT_SITE_CONTENT,
      images,
      logos,
      locations,
      allergens,
      privacy: {
        controllerName: boundedText(privacy.controllerName, 160),
        legalId: boundedText(privacy.legalId, 40),
        address: boundedText(privacy.address, 180),
        email,
        legalBasis: boundedText(privacy.legalBasis, 500),
        recipients: boundedText(privacy.recipients, 500),
        retention: boundedText(privacy.retention, 240),
        extraText: boundedText(privacy.extraText, 2400),
      },
    },
  }
}

async function readContent() {
  if (!isConfigured()) return { content: DEFAULT_SITE_CONTENT, setupRequired: true }
  const { data, error } = await db().from(TABLE).select('content').eq('id', 'main').maybeSingle()
  if (error) {
    if (missingSetup(error)) return { content: DEFAULT_SITE_CONTENT, setupRequired: true }
    throw error
  }
  return { content: mergeSiteContent(data?.content), setupRequired: false }
}

function siteManifest(content) {
  const customIcon = content?.logos?.favicon
  const icons = customIcon
    ? [192, 512].map((size) => ({ src: customIcon, sizes: `${size}x${size}`, purpose: 'any' }))
    : [
        { src: '/app/icono-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/app/icono-512.png', sizes: '512x512', type: 'image/png' },
      ]
  return {
    name: 'La Pizza de Nonno',
    short_name: 'Nonno',
    description: 'Pide tu pizza y sigue tu pedido.',
    lang: 'es',
    start_url: '/?app=1',
    scope: '/',
    display: 'standalone',
    background_color: '#0C0C0C',
    theme_color: '#0C0C0C',
    icons,
  }
}

function sniffImage(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' }
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return { ext: 'png', mime: 'image/png' }
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return { ext: 'webp', mime: 'image/webp' }
  if (buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'ftyp' && /avif|avis/.test(buffer.toString('ascii', 8, 16))) return { ext: 'avif', mime: 'image/avif' }
  return null
}

async function uploadImage(req, res) {
  const grant = requireSuperadmin(req, res)
  if (!grant) return
  if (!isConfigured()) return res.status(503).json({ error: 'Falta conectar el almacenamiento de Nonno.' })
  const encoded = String(req.body?.base64 || '')
  if (!encoded || encoded.length > Math.ceil(MAX_IMAGE_BYTES * 4 / 3) + 8) {
    return res.status(413).json({ error: 'La imagen debe pesar 3 MB o menos.' })
  }
  const buffer = Buffer.from(encoded, 'base64')
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) return res.status(413).json({ error: 'La imagen debe pesar 3 MB o menos.' })
  const type = sniffImage(buffer)
  if (!type || req.body?.mimeType !== type.mime) return res.status(415).json({ error: 'Usa una imagen JPG, PNG, WebP o AVIF válida.' })

  const path = Date.now().toString(36) + '-' + randomUUID() + '.' + type.ext
  const { data, error } = await db().storage.from(BUCKET).upload(path, buffer, {
    contentType: type.mime,
    cacheControl: '31536000',
    upsert: false,
  })
  if (error) {
    if (error.message?.toLowerCase().includes('bucket')) {
      return res.status(503).json({ error: 'Falta crear la biblioteca de imágenes. Aplica supabase/superadmin.sql.' })
    }
    console.error('Error guardando imagen del sitio:', error)
    return res.status(500).json({ error: 'No hemos podido guardar la imagen.' })
  }
  const { data: urlData } = db().storage.from(BUCKET).getPublicUrl(data.path)
  return res.status(200).json({ url: urlData.publicUrl })
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const editor = req.query?.admin === '1'
    const manifest = req.query?.manifest === '1'
    if (editor && !requireSuperadmin(req, res)) return
    try {
      const result = await readContent()
      res.setHeader('Cache-Control', editor ? 'private, no-store' : 'public, s-maxage=20, stale-while-revalidate=60')
      if (manifest) {
        res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8')
        return res.status(200).send(JSON.stringify(siteManifest(result.content)))
      }
      return res.status(200).json({
        ...result,
        ...(editor ? { databaseConfigured: isConfigured() } : {}),
      })
    } catch (error) {
      console.error('Error leyendo el contenido del sitio:', error)
      return res.status(500).json({ error: 'No hemos podido cargar la configuración.' })
    }
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'Método no permitido.' })
  }

  const grant = requireSuperadmin(req, res)
  if (!grant) return
  if (req.body?.action === 'upload') return uploadImage(req, res)
  if (req.body?.action !== 'save') return res.status(400).json({ error: 'Acción no válida.' })
  if (!isConfigured()) return res.status(503).json({ error: 'Falta conectar la base de datos de Nonno.' })

  const clean = sanitizeContent(req.body?.content)
  if (clean.error) return res.status(400).json({ error: clean.error })
  const { error } = await db().from(TABLE).upsert({
    id: 'main',
    content: clean.content,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' })
  if (error) {
    if (missingSetup(error)) return res.status(503).json({ error: 'Falta aplicar supabase/superadmin.sql en Supabase.' })
    console.error('Error guardando el contenido del sitio:', error)
    return res.status(500).json({ error: 'No hemos podido guardar los cambios.' })
  }
  return res.status(200).json({ content: clean.content, saved: true })
}
