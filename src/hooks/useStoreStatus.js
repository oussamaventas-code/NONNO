import { useEffect, useState } from 'react'

const POLL_MS = 30000

/**
 * Apertura de cada sede ("Nonno le da al ON"). Público, sin sesión:
 * la web lo consulta para no dejar empezar un pedido en una sede
 * cerrada. El servidor vuelve a comprobarlo al guardar el pedido,
 * así que esto es solo para avisar pronto, no la única barrera.
 */
export function useStoreStatus() {
  const [statuses, setStatuses] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const res = await fetch('/api/store-status')
        const data = await res.json().catch(() => ({}))
        if (!cancelled && data?.statuses) setStatuses(data.statuses)
      } catch {
        /* Sin conexión o API caída: no se bloquea la web por esto,
           el servidor sigue siendo quien de verdad decide al pedir. */
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    const timer = setInterval(load, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  /* Mientras no se sabe con certeza (aún cargando o sede sin fila),
     se asume abierta: nunca se bloquea un pedido real por un fallo
     de red al consultar el estado. */
  const isOpen = (locationId) => {
    const entry = statuses[locationId]
    return entry ? entry.is_open !== false : true
  }

  return { statuses, isOpen, loading }
}
