import { getLocation } from '../data/locations.js'

/* ═══════════════════════════════════════════════════════════════
   ENVÍO POR DISTANCIA
   Distancia en línea recta entre el local y el punto de entrega
   (dirección buscada o ubicación del móvil del cliente). El precio
   sale del primer tramo que la cubre; más allá del último, no se
   reparte.

   PLAN B: si no se puede localizar la dirección (el buscador no la
   encuentra o no responde), el cliente elige su tramo a mano y el
   pedido queda marcado "sin verificar" para que lo confirme el local.
   ═══════════════════════════════════════════════════════════════ */

const R = 6371

/** Kilómetros en línea recta entre dos puntos {lat, lng}. */
export function distanceKm(a, b) {
  const rad = (d) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export const deliveryTiers = (locationId) => getLocation(locationId)?.delivery?.tiers || []
export const maxDeliveryKm = (locationId) => deliveryTiers(locationId).at(-1)?.upToKm ?? 0

const km1 = (n) => `${n.toLocaleString('es-ES', { maximumFractionDigits: 1 })} km`

/** Texto de cada tramo: "Hasta 1 km", "De 1 a 3 km". */
export const tierLabel = (tiers, i) =>
  i === 0 ? `Hasta ${km1(tiers[0].upToKm)}` : `De ${tiers[i - 1].upToKm} a ${km1(tiers[i].upToKm)}`

const validPoint = (p) =>
  p && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng))
  && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180

/**
 * Presupuesto de envío.
 * @param {string} locationId
 * @param {{ coords?: {lat, lng}, tier?: number }} where
 *   coords: punto localizado (verificado). tier: tramo elegido a mano (plan B).
 * @returns {{ ok: true, fee, minutes, km, verified, label }
 *         | { ok: false, reason: 'no-delivery' | 'missing' | 'too-far', km?, maxKm? }}
 */
export function deliveryQuote(locationId, where = {}) {
  const cfg = getLocation(locationId)?.delivery
  if (!getLocation(locationId)?.services.delivery || !cfg) return { ok: false, reason: 'no-delivery' }
  const { tiers } = cfg

  if (validPoint(where.coords)) {
    const km = Math.round(distanceKm(cfg.origin, { lat: Number(where.coords.lat), lng: Number(where.coords.lng) }) * 100) / 100
    const tier = tiers.find((t) => km <= t.upToKm)
    if (!tier) return { ok: false, reason: 'too-far', km, maxKm: maxDeliveryKm(locationId) }
    return { ok: true, fee: tier.fee, minutes: tier.minutes, km, verified: true, label: `${km1(km)} del local` }
  }

  const i = Number.isInteger(where.tier) ? where.tier : null
  if (i !== null && tiers[i]) {
    return {
      ok: true, fee: tiers[i].fee, minutes: tiers[i].minutes, km: null, verified: false,
      label: `${tierLabel(tiers, i)} (sin verificar)`,
    }
  }
  return { ok: false, reason: 'missing' }
}

/** Mensaje para el cliente cuando no hay presupuesto. */
export function deliveryProblem(quote) {
  if (!quote || quote.ok) return null
  if (quote.reason === 'too-far') {
    return `Esa dirección está a ${km1(quote.km)} del local y repartimos hasta ${km1(quote.maxKm)}. Puedes pedir para recoger.`
  }
  if (quote.reason === 'no-delivery') return 'Esta sede no hace entregas a domicilio.'
  return 'Comprueba la dirección de entrega o usa tu ubicación.'
}
