/* ═══════════════════════════════════════════════════════════════
   CHECKLIST DE STOCK
   Cada producto tiene un objetivo diario. Se apunta lo que hay y la
   compra es lo que falta hasta el objetivo: si el objetivo es 80 kg
   y hay 10 kg, se compran 70 kg. Si hay de sobra, no se compra nada.
   ═══════════════════════════════════════════════════════════════ */

const round = (n) => Math.round(n * 100) / 100

/** Día de servicio en hora de Madrid: "2026-09-27". */
export const madridDay = (ms = Date.now()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(ms))

/** Lo que hay que comprar. null si todavía no se ha contado. */
export function toBuy(target, onHand) {
  if (onHand === null || onHand === undefined || onHand === '') return null
  return Math.max(0, round(Number(target) - Number(onHand)))
}

/** Acepta "10", "10,5" o "10.5". Devuelve null si está vacío o no es un número válido. */
export function parseQty(text) {
  const clean = String(text ?? '').trim().replace(',', '.')
  if (clean === '') return null
  const n = Number(clean)
  return Number.isFinite(n) && n >= 0 ? round(n) : null
}

/** "70 kg", "2,5 kg", "12 uds" */
export const formatQty = (n, unit) =>
  `${Number(n).toLocaleString('es-ES', { maximumFractionDigits: 2 })} ${unit}`

/**
 * Estado del día a partir de productos y recuentos.
 * @param {Array<{id, name, unit, target}>} items
 * @param {Record<string, {on_hand, bought}>} counts  por id de producto
 */
export function stockSummary(items, counts) {
  const rows = items.map((item) => {
    const count = counts[item.id] || {}
    const buy = toBuy(item.target, count.on_hand)
    return { ...item, onHand: count.on_hand ?? null, bought: Boolean(count.bought), buy }
  })
  const shopping = rows.filter((r) => r.buy > 0)
  return {
    rows,
    shopping,
    counted: rows.filter((r) => r.onHand !== null).length,
    pendingToBuy: shopping.filter((r) => !r.bought).length,
  }
}

/** Texto de la lista de la compra, para copiar o mandar por WhatsApp. */
export function shoppingText(shopping, { locationName, day }) {
  const date = new Date(`${day}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
  return [
    `COMPRA · ${locationName} · ${date}`,
    '',
    ...shopping.map((r) => `${r.bought ? '[x]' : '[ ]'} ${r.name}: ${formatQty(r.buy, r.unit)}`),
  ].join('\n')
}
