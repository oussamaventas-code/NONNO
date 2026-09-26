import { useEffect, useState } from 'react'

const REFRESH_MS = 60000

/**
 * Hora estimada a la que estaría listo un pedido de `pizzas`
 * unidades en esa sede si se pidiera ahora (ver api/slots.js).
 * Devuelve null mientras no se sabe o si la API no responde: la web
 * nunca inventa una hora.
 * @returns {null | { ok: true, readyAt: string } | { ok: false, reason: string, message: string }}
 */
export function useKitchenEta(locationId, pizzas) {
  const [eta, setEta] = useState(null)

  useEffect(() => {
    if (!locationId) { setEta(null); return undefined }
    let cancelled = false

    const load = async () => {
      try {
        const res = await fetch(`/api/slots?location=${encodeURIComponent(locationId)}&pizzas=${pizzas}`)
        const data = await res.json()
        if (!cancelled) setEta(res.ok ? data : null)
      } catch {
        if (!cancelled) setEta(null)
      }
    }

    load()
    const timer = setInterval(load, REFRESH_MS)
    return () => { cancelled = true; clearInterval(timer) }
  }, [locationId, pizzas])

  return eta
}

/** Minutos que faltan hasta esa hora (nunca negativo). */
export const minutesUntil = (iso) => Math.max(0, Math.round((Date.parse(iso) - Date.now()) / 60000))
