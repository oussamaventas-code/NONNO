import { getProduct, priceOf, PICKUP_DEALS } from '../data/menu.js'
import { deliveryQuote } from './delivery.js'

/* ═══════════════════════════════════════════════════════════════
   TOTALES DEL PEDIDO
   Subtotal − oferta de recogida + envío = total.

   Lo usan la web (carrito y checkout) y el servidor, que lo vuelve a
   calcular al guardar el pedido: lo que ve el cliente, lo que sale en
   el ticket y lo que se cobra son exactamente el mismo número.
   Todo se calcula en céntimos para no arrastrar errores de coma.
   ═══════════════════════════════════════════════════════════════ */

const cents = (euros) => Math.round(Number(euros) * 100)
const euros = (c) => c / 100

/**
 * Mejor combinación de packs para un grupo de pizzas.
 * Las pizzas más caras entran primero (es donde más se ahorra) y se
 * busca la partición en packs más barata para cada cantidad posible.
 */
function bestPacks(unitCents, packs) {
  const prices = [...unitCents].sort((a, b) => b - a)
  const n = prices.length
  const cost = Array(n + 1).fill(Infinity)
  const pick = Array(n + 1).fill(null)
  cost[0] = 0
  for (let k = 1; k <= n; k += 1) {
    for (const p of packs) {
      if (p.qty > k) continue
      const c = cost[k - p.qty] + cents(p.price)
      if (c < cost[k]) { cost[k] = c; pick[k] = p }
    }
  }

  let best = { saving: 0, k: 0 }
  let covered = 0
  for (let k = 1; k <= n; k += 1) {
    covered += prices[k - 1]
    const saving = covered - cost[k]
    if (Number.isFinite(cost[k]) && saving > best.saving) best = { saving, k }
  }

  const used = []
  for (let k = best.k; k > 0; k -= pick[k].qty) used.push(pick[k])
  return { saving: best.saving, packs: used }
}

/**
 * Descuento "Llévatelas por menos" sobre unas líneas de pedido.
 * @param {Array<{productId, portionId?, qty}>} lines
 * @returns {{ discount: number, deals: Array<{label, price, count}> }}
 */
export function pickupDeals(lines = []) {
  let discountCents = 0
  const deals = []

  for (const deal of PICKUP_DEALS) {
    const units = []
    lines.forEach((l) => {
      const product = getProduct(l.productId)
      if (product?.category !== deal.category) return
      for (let i = 0; i < l.qty; i += 1) units.push(cents(priceOf(product, l.portionId)))
    })

    const { saving, packs } = bestPacks(units, deal.packs)
    if (saving <= 0) continue
    discountCents += saving

    const byPack = new Map()
    packs.forEach((p) => byPack.set(p.qty, { ...p, count: (byPack.get(p.qty)?.count || 0) + 1 }))
    byPack.forEach((p) => deals.push({ label: `${p.qty} ${deal.label}`, price: p.price, count: p.count }))
  }

  return { discount: euros(discountCents), deals }
}

/**
 * Totales completos.
 * @param {object} input
 * @param {Array<{productId, portionId?, qty, unitPrice}>} input.lines
 * @param {'pickup'|'delivery'|null} input.mode
 * @param {string} input.locationId
 * @param {{ coords?: {lat, lng}, tier?: number }} [input.where]  punto de entrega (solo entrega)
 * @returns delivery: presupuesto de envío (ver deliveryQuote) o null si es recogida
 */
export function orderTotals({ lines = [], mode, locationId, where }) {
  const subtotalCents = lines.reduce((sum, l) => sum + cents(l.unitPrice) * l.qty, 0)
  const { discount, deals } = mode === 'pickup' ? pickupDeals(lines) : { discount: 0, deals: [] }
  const delivery = mode === 'delivery' ? deliveryQuote(locationId, where) : null
  const deliveryFee = delivery?.ok ? delivery.fee : 0

  return {
    subtotal: euros(subtotalCents),
    discount,
    deals,
    delivery,
    deliveryFee,
    total: euros(subtotalCents - cents(discount) + cents(deliveryFee)),
  }
}
