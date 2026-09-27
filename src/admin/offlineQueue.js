/* ═══════════════════════════════════════════════════════════════
   COLA SIN CONEXIÓN DEL MOSTRADOR (plan B)

   Si el servidor no responde al crear un pedido en el mostrador, la
   comanda sale en papel y el pedido se guarda aquí, en el propio
   equipo. En cuanto vuelve la conexión se envía solo. Cada pedido
   lleva su clave única: aunque se reenvíe varias veces, en la base
   de datos queda uno.
   ═══════════════════════════════════════════════════════════════ */

const KEY = 'nonno.panel.offline-queue'

export function readQueue() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function writeQueue(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)) } catch { /* sin espacio: queda en memoria de la pantalla */ }
}

/** entry: { payload, order } — payload para la API, order para pintar e imprimir */
export function enqueue(entry) {
  writeQueue([...readQueue().filter((e) => e.payload.clientKey !== entry.payload.clientKey), entry])
}

export function dequeue(clientKey) {
  writeQueue(readQueue().filter((e) => e.payload.clientKey !== clientKey))
}

/** ¿El fallo es de conexión/servidor (plan B) y no un "no" del servidor? */
export const isConnectionError = (err) => !err?.status || err.status >= 500

export const newClientKey = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
