import { useEffect, useState } from 'react'
import { nearestLocation } from '../lib/nearestLocation'

/**
 * Sede más cercana según la ubicación del navegador (no la que el
 * cliente ha elegido, esa vive en el store). Nunca bloquea nada: si
 * no hay geolocalización, no se concede el permiso o tarda demasiado,
 * se queda en null para siempre y la web sigue con la elección manual
 * de toda la vida — es un extra, no una condición para poder pedir.
 * @returns {{ id: string, km: number } | null}
 */
export function useNearestLocation() {
  const [nearest, setNearest] = useState(null)

  useEffect(() => {
    if (!navigator.geolocation) return undefined
    let cancelled = false

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return
        const found = nearestLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        if (found) setNearest(found)
      },
      () => { /* denegado, sin cobertura o sin ubicación: se sigue con la elección manual */ },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 10 * 60 * 1000 },
    )

    return () => { cancelled = true }
  }, [])

  return nearest
}
