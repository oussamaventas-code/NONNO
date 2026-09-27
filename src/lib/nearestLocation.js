import { LOCATIONS } from '../data/locations.js'
import { distanceKm } from './delivery.js'

/**
 * Sede física más cercana a un punto (en línea recta), o null si
 * ninguna sede tiene coordenadas todavía.
 * @param {{lat:number, lng:number}} coords
 * @returns {{ id: string, km: number } | null}
 */
export function nearestLocation(coords) {
  let best = null
  for (const loc of LOCATIONS) {
    if (!loc.coords) continue
    const km = distanceKm(loc.coords, coords)
    if (!best || km < best.km) best = { id: loc.id, km: Math.round(km * 10) / 10 }
  }
  return best
}
