import { distanceKm } from './delivery.js'

/* ═══════════════════════════════════════════════════════════════
   ORGANIZADOR DE RUTAS DE REPARTO
   Agrupa los pedidos a domicilio en salidas del repartidor:
   pedidos listos a horas parecidas y cerca entre sí van juntos,
   hasta un máximo de paradas. Dentro de cada salida se prueban
   todos los órdenes posibles (con 4-5 paradas son pocos) y se queda
   el más corto. Las distancias son en línea recta × un factor de
   calle, así que los tiempos son estimaciones.
   ═══════════════════════════════════════════════════════════════ */

const ROAD_FACTOR = 1.3
const MIN = 60000

const pointOf = (o) => (o.delivery_lat != null && o.delivery_lng != null
  ? { lat: Number(o.delivery_lat), lng: Number(o.delivery_lng) }
  : null)
const readyMs = (o) => Date.parse(o.ready_at || o.created_at)

/** Todas las permutaciones (solo para listas cortas). */
function permutations(list) {
  if (list.length <= 1) return [list]
  return list.flatMap((x, i) => permutations([...list.slice(0, i), ...list.slice(i + 1)]).map((p) => [x, ...p]))
}

/** Orden de paradas más corto saliendo del local (sin volver). */
export function bestOrder(origin, stops) {
  let best = { km: Infinity, order: stops }
  for (const order of permutations(stops)) {
    let km = 0
    let at = origin
    for (const s of order) { km += distanceKm(at, pointOf(s)); at = pointOf(s) }
    if (km < best.km) best = { km, order }
  }
  return best
}

/**
 * Tiempos de una salida.
 * @returns {{ departAt, km, minutes, etas: number[] }} etas: llegada a cada parada (ms)
 */
export function tripTimes(origin, stops, cfg, departAt) {
  let at = origin
  let t = departAt
  let km = 0
  const etas = stops.map((s) => {
    const p = pointOf(s)
    const leg = p ? distanceKm(at, p) * ROAD_FACTOR : 0
    km += leg
    t += (leg / cfg.speedKmh) * 60 * MIN
    const eta = t
    t += cfg.stopMinutes * MIN
    if (p) at = p
    return eta
  })
  return { departAt, km: Math.round(km * 10) / 10, minutes: Math.round((etas.at(-1) - departAt) / MIN), etas }
}

/**
 * Propone las salidas para los pedidos a domicilio aún no despachados.
 * @param {Array} orders   pedidos (delivery_lat/lng, ready_at…)
 * @param {{lat, lng}} origin  el local
 * @param {{maxStops, groupWindowMin, nearKm, speedKmh, stopMinutes}} cfg
 * @returns {Array<{ id, stops, verified, departAt, km, minutes, etas }>}
 */
export function planTrips(orders, origin, cfg) {
  const withPoint = orders.filter(pointOf).sort((a, b) => readyMs(a) - readyMs(b))
  const withoutPoint = orders.filter((o) => !pointOf(o))
  const taken = new Set()
  const trips = []

  for (const seed of withPoint) {
    if (taken.has(seed.id)) continue
    taken.add(seed.id)
    const group = [seed]
    const limit = readyMs(seed) + cfg.groupWindowMin * MIN

    /* Se van sumando los más cercanos a alguna parada ya en la salida. */
    for (;;) {
      if (group.length >= cfg.maxStops) break
      const candidates = withPoint
        .filter((o) => !taken.has(o.id) && readyMs(o) <= limit)
        .map((o) => ({ o, d: Math.min(...group.map((g) => distanceKm(pointOf(g), pointOf(o)))) }))
        .filter((c) => c.d <= cfg.nearKm)
        .sort((a, b) => a.d - b.d)
      if (!candidates.length) break
      taken.add(candidates[0].o.id)
      group.push(candidates[0].o)
    }

    const { order } = bestOrder(origin, group)
    const departAt = Math.max(...order.map(readyMs))
    trips.push({ id: order.map((o) => o.id).join('+'), stops: order, verified: true, ...tripTimes(origin, order, cfg, departAt) })
  }

  /* Sin ubicación exacta: salida propia; se busca por la dirección escrita. */
  withoutPoint.sort((a, b) => readyMs(a) - readyMs(b)).forEach((o) => {
    trips.push({ id: o.id, stops: [o], verified: false, departAt: readyMs(o), km: null, minutes: null, etas: [null] })
  })

  return trips.sort((a, b) => a.departAt - b.departAt)
}

/** Enlace de Google Maps con la ruta ya trazada (hasta 9 paradas intermedias). */
export function mapsRouteUrl(origin, stops) {
  const where = (o) => {
    const p = pointOf(o)
    return p ? `${p.lat},${p.lng}` : `${o.address}, Murcia`
  }
  const params = new URLSearchParams({
    api: '1',
    origin: `${origin.lat},${origin.lng}`,
    destination: where(stops.at(-1)),
    travelmode: 'driving',
  })
  if (stops.length > 1) params.set('waypoints', stops.slice(0, -1).map(where).join('|'))
  return `https://www.google.com/maps/dir/?${params}`
}
