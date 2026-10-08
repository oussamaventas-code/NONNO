import { getLocation } from '../src/data/locations.js'
import { loadSiteConfiguration } from './_lib/siteConfig.js'
import { deliveryQuote } from '../src/lib/delivery.js'

/* ═══════════════════════════════════════════════════════════════
   Localizar la dirección de entrega (OpenStreetMap / Nominatim).

   GET /api/geocode?location=sangonera&q=Calle Mayor 5
       → busca la dirección escrita
   GET /api/geocode?location=sangonera&lat=37.93&lng=-1.21
       → ubicación del móvil: devuelve la dirección de ese punto

   Siempre responde también el presupuesto de envío de ese punto.
   Si Nominatim no responde, devuelve { ok:false, reason:'unavailable' }
   y la web pasa al plan B (elegir el tramo a mano).

   Normas de uso de Nominatim: identificarse, máximo 1 petición por
   segundo y guardar en caché. NOMINATIM_EMAIL (opcional) da un
   contacto por si hay algún problema.
   ═══════════════════════════════════════════════════════════════ */

const BASE = 'https://nominatim.openstreetmap.org'
const UA = 'LaPizzaDeNonno/1.0 (+https://github.com/oussamaventas-code/NONNO)'
const cache = new Map()
let last = 0

async function nominatim(path, params) {
  const url = new URL(`${BASE}/${path}`)
  Object.entries({ format: 'jsonv2', 'accept-language': 'es', ...params }).forEach(([k, v]) => url.searchParams.set(k, v))
  if (process.env.NOMINATIM_EMAIL) url.searchParams.set('email', process.env.NOMINATIM_EMAIL)
  const key = url.toString()
  if (cache.has(key)) return cache.get(key)

  const wait = last + 1100 - Date.now()
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  last = Date.now()

  const res = await fetch(key, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(6000) })
  if (!res.ok) throw new Error(`Nominatim ${res.status}`)
  const data = await res.json()
  if (cache.size > 500) cache.clear()
  cache.set(key, data)
  return data
}

/** "Calle Mayor, 5, Sangonera la Verde" */
function shortAddress(a = {}, fallback = '') {
  const street = [a.road || a.pedestrian || a.footway, a.house_number].filter(Boolean).join(', ')
  const town = a.village || a.town || a.suburb || a.city_district || a.city
  return [street, town].filter(Boolean).join(', ') || fallback
}

export default async function handler(req, res) {
  await loadSiteConfiguration()
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Método no permitido' })
  }
  const location = getLocation(String(req.query?.location || ''))
  if (!location?.delivery) return res.status(400).json({ error: 'Esta sede no hace entregas.' })

  const q = String(req.query?.q || '').trim().slice(0, 160)
  const lat = Number(req.query?.lat)
  const lng = Number(req.query?.lng)
  const byPoint = Number.isFinite(lat) && Number.isFinite(lng)
  if (!q && !byPoint) return res.status(400).json({ error: 'Falta la dirección.' })

  try {
    let point
    let label
    if (byPoint) {
      const r = await nominatim('reverse', { lat, lon: lng, addressdetails: 1, zoom: 18 })
      point = { lat, lng }
      label = shortAddress(r?.address, r?.display_name)
    } else {
      /* Se busca cerca del local: primero dentro de su zona. */
      const { lat: oLat, lng: oLng } = location.delivery.origin
      const box = [oLng - 0.08, oLat + 0.06, oLng + 0.08, oLat - 0.06].join(',')
      const results = await nominatim('search', {
        q: /murcia/i.test(q) ? q : `${q}, Murcia`,
        countrycodes: 'es', addressdetails: 1, limit: 1, viewbox: box, bounded: 0,
      })
      const hit = results?.[0]
      if (!hit) return res.status(200).json({ ok: false, reason: 'not-found' })
      point = { lat: Number(hit.lat), lng: Number(hit.lon) }
      label = shortAddress(hit.address, hit.display_name)
    }

    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json({ ok: true, coords: point, label, quote: deliveryQuote(location.id, { coords: point }) })
  } catch (err) {
    console.error('Geocoding no disponible:', err?.message)
    return res.status(200).json({ ok: false, reason: 'unavailable' })
  }
}
