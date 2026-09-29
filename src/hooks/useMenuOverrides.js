import { useEffect, useState } from 'react'
import { setMenuOverrides } from '../data/menu'

const POLL_MS = 60000

/**
 * Trae las correcciones de la carta (precios, productos ocultos y
 * agotados por sede) y se las pasa a src/data/menu.js. Devuelve un
 * contador que cambia cuando la carta cambia, para que quien lo use
 * se vuelva a pintar.
 *
 * Si la API no responde se queda la carta que ya había: nunca se
 * bloquea la web por esto, y el servidor vuelve a recalcular el pedido.
 */
export function useMenuOverrides() {
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let cancelled = false
    let last = ''

    const load = async () => {
      try {
        const res = await fetch('/api/menu')
        if (!res.ok) return
        const data = await res.json()
        const snapshot = JSON.stringify(data)
        if (cancelled || snapshot === last) return
        last = snapshot
        setMenuOverrides(data)
        setVersion((v) => v + 1)
      } catch {
        /* Sin conexión: se queda la carta actual. */
      }
    }

    load()
    const timer = setInterval(load, POLL_MS)
    window.addEventListener('focus', load)
    return () => {
      cancelled = true
      clearInterval(timer)
      window.removeEventListener('focus', load)
    }
  }, [])

  return version
}
