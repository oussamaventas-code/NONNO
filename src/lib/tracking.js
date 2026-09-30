/* ═══════════════════════════════════════════════════════════════
   SEGUIMIENTO DEL PEDIDO PARA EL CLIENTE
   Enlace /p/NN-4821-a1b2c3d4e5: la referencia del pedido más los
   primeros 10 caracteres de su id (aleatorio). Sin esa segunda parte
   no se puede adivinar el enlace de otro cliente a partir de la
   referencia, que es corta y va impresa en el tique.
   Lo usan el servidor (api/orders.js) y la web.
   ═══════════════════════════════════════════════════════════════ */

const KEY_LEN = 10

/** Token público de un pedido guardado: "NN-4821-a1b2c3d4e5" */
export const trackToken = (order) =>
  order?.ref && order?.id ? `${order.ref}-${String(order.id).replace(/-/g, '').slice(0, KEY_LEN)}` : null

/** "NN-4821-a1b2c3d4e5" → { ref: "NN-4821", key: "a1b2c3d4e5" } */
export function parseTrackToken(token) {
  const m = /^([A-Za-z0-9-]{2,20})-([0-9a-f]{10})$/.exec(String(token || '').trim())
  return m ? { ref: m[1], key: m[2] } : null
}

export const trackPath = (token) => `/p/${token}`

/** ¿El id del pedido encaja con la clave del enlace? */
export const keyMatches = (id, key) => String(id || '').replace(/-/g, '').slice(0, KEY_LEN) === key
