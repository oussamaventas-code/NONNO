/* Último pedido hecho desde este navegador: para enseñar en la cabecera
   "Sigue tu pedido" hasta que se entregue (o pasen unas horas). */

const KEY = 'nonno.ultimoPedido'
const MAX_AGE_MS = 6 * 3600 * 1000
const EVENT = 'nonno:lastorder'

export function rememberLastOrder(token, ref) {
  try { localStorage.setItem(KEY, JSON.stringify({ token, ref, at: Date.now() })) } catch { /* modo privado */ }
  window.dispatchEvent(new Event(EVENT))
}

export function readLastOrder() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null')
    return saved?.token && Date.now() - saved.at < MAX_AGE_MS ? saved : null
  } catch {
    return null
  }
}

/** Se olvida si es ese pedido (o cualquiera, sin token). */
export function forgetLastOrder(token) {
  const saved = readLastOrder()
  if (token && saved?.token !== token) return
  try { localStorage.removeItem(KEY) } catch { /* modo privado */ }
  window.dispatchEvent(new Event(EVENT))
}

export const LAST_ORDER_EVENT = EVENT
