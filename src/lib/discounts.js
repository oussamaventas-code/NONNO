/* ═══════════════════════════════════════════════════════════════
   DESCUENTOS
   Los crea la dirección en el panel (pestaña Descuentos) y rebajan el
   precio de toda la carta, de unas categorías o de unos productos.
   Mismo código en la web y en el servidor: el cliente ve el precio que
   se le cobra. Si a un producto le tocan varios, gana el que más rebaja
   (no se suman). Los extras (toppings) no se rebajan.
   Sin dependencias: lo importan también las funciones del servidor.
   ═══════════════════════════════════════════════════════════════ */

export const DISCOUNT_KINDS = ['percent', 'amount']
export const DISCOUNT_TARGETS = ['all', 'categories', 'products']

/** Fila de la tabla `discounts` → descuento en el formato de la web. */
export const discountFromRow = (r) => ({
  id: r.id,
  name: r.name,
  kind: r.kind,
  value: Number(r.value),
  target: r.target,
  targetIds: r.target_ids || [],
  startsAt: r.starts_at || null,
  endsAt: r.ends_at || null,
  active: r.active !== false,
})

/** ¿Está en vigor ahora? Encendido y dentro de sus fechas (si las tiene). */
export function isLive(d, now = Date.now()) {
  if (!d?.active) return false
  if (d.startsAt && Date.parse(d.startsAt) > now) return false
  if (d.endsAt && Date.parse(d.endsAt) <= now) return false
  return true
}

/** ¿Le toca a este producto? */
export const appliesTo = (d, product) =>
  d.target === 'all'
  || (d.target === 'categories' && d.targetIds.includes(product.category))
  || (d.target === 'products' && d.targetIds.includes(product.id))

const cents = (n) => Math.round(n * 100)

/** Precio rebajado (nunca por debajo de 0). */
export const discounted = (price, d) => Math.max(0, (
  d.kind === 'percent' ? cents(price) - Math.round(cents(price) * d.value / 100) : cents(price) - cents(d.value)
)) / 100

/** Etiqueta corta: "-20%" o "-2 €". */
export const discountLabel = (d) =>
  d.kind === 'percent'
    ? `-${d.value.toLocaleString('es-ES')}%`
    : `-${d.value.toLocaleString('es-ES', { minimumFractionDigits: d.value % 1 ? 2 : 0 })} €`

/**
 * Aplica al producto el descuento que más rebaja de los que le tocan.
 * Deja el precio anterior en `priceBefore` (y en cada ración) y el
 * descuento en `discount` para que la web lo tache y lo anuncie.
 */
export function applyDiscounts(product, discounts = []) {
  const mine = discounts.filter((d) => appliesTo(d, product))
  if (!mine.length) return product
  const best = mine.reduce((a, b) => (discounted(product.price, b) < discounted(product.price, a) ? b : a))
  if (discounted(product.price, best) >= product.price) return product
  const next = { ...product, priceBefore: product.price, price: discounted(product.price, best), discount: { id: best.id, name: best.name, label: discountLabel(best) } }
  if (product.portions) {
    next.portions = product.portions.map((p) => ({ ...p, priceBefore: p.price, price: discounted(p.price, best) }))
    next.price = next.portions[0].price
  }
  return next
}
