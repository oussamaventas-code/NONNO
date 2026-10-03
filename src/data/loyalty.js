/* ═══════════════════════════════════════════════════════════════
   CLUB NONNO — reglas de los puntos

   Un único sitio para cambiarlas: lo leen la web y el servidor
   (este fichero lo importan también las funciones de /api, por eso
   no importa nada del navegador).

   · Se gana 1 punto por cada euro del total del pedido, cuando el
     pedido se ENTREGA (no si se cancela).
   · 100 puntos = 5 € de descuento en un pedido online.
   · El descuento nunca cubre el envío: como mucho deja la comida
     a 0 €.
   ═══════════════════════════════════════════════════════════════ */

export const LOYALTY = {
  name: 'Club Nonno',
  pointsPerEuro: 1,
  redeemStep: 100, // se canjea en bloques de 100 puntos…
  stepValue: 5,    // …y cada bloque son 5 €
}

/** Puntos que da un pedido de este importe. */
export const pointsFor = (total) => Math.max(0, Math.floor(Number(total || 0) * LOYALTY.pointsPerEuro))

/** Euros de descuento que valen unos puntos (siempre en bloques enteros). */
export const discountFor = (points) =>
  Math.floor(Math.max(0, Number(points) || 0) / LOYALTY.redeemStep) * LOYALTY.stepValue

/**
 * Máximo de puntos canjeables: bloques enteros que tenga el cliente y
 * que no pasen de lo que cuesta la comida (el envío no se descuenta).
 * @param {number} balance   puntos del cliente
 * @param {number} payable   euros de comida ya descontadas las ofertas
 */
export function maxRedeemable(balance, payable) {
  const byBalance = Math.floor(Math.max(0, Number(balance) || 0) / LOYALTY.redeemStep)
  const byPrice = Math.floor(Math.max(0, Number(payable) || 0) / LOYALTY.stepValue)
  return Math.min(byBalance, byPrice) * LOYALTY.redeemStep
}

/** Deja una cantidad pedida en un canje válido (bloques enteros, ≥ 0). */
export const normalizeRedeem = (points) =>
  Math.floor(Math.max(0, Number(points) || 0) / LOYALTY.redeemStep) * LOYALTY.redeemStep
