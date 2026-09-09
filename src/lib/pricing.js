import { getExtra, getProduct, priceOf, isPizza, PIZZA_SIZE } from '../data/menu'

/* ═══════════════════════════════════════════════════════════════
   MOTOR DE PRECIOS
   Toda la aritmética del pedido vive aquí: los componentes solo
   pintan. Precio del producto + extras, multiplicado por unidades.

   Quitar ingredientes NO cambia el precio: sigue siendo la misma
   pizza, hecha a la manera del cliente.
   ═══════════════════════════════════════════════════════════════ */

/** Suma de los extras seleccionados */
export const extrasPrice = (extraIds = []) =>
  extraIds.reduce((total, id) => total + (getExtra(id)?.price || 0), 0)

/** Precio de una unidad configurada */
export const unitPrice = (product, { extraIds = [] } = {}) =>
  round(priceOf(product) + extrasPrice(extraIds))

/** Total de una línea del carrito */
export const lineTotal = (line) => round(line.unitPrice * line.qty)

/** Subtotal del carrito */
export const cartSubtotal = (lines = []) =>
  round(lines.reduce((total, line) => total + lineTotal(line), 0))

/** Unidades totales (contador de la navbar y la barra móvil) */
export const cartCount = (lines = []) =>
  lines.reduce((total, line) => total + line.qty, 0)

/**
 * Identidad de línea: mismo producto + mismos extras + mismos
 * ingredientes quitados + misma nota => se agrupa en una sola línea.
 * Una pizza sin cebolla y otra con ella son líneas distintas.
 */
export const lineId = ({ productId, extraIds = [], removed = [], note = '' }) =>
  [
    productId,
    [...extraIds].sort().join('+') || 'sin-extras',
    [...removed].sort().join('+') || 'completa',
    note.trim().toLowerCase(),
  ].join('__')

/**
 * Construye una línea de carrito completa a partir de una selección.
 * Congela nombre, imagen y precio para que el carrito siga siendo
 * legible aunque el catálogo cambie después.
 */
export const buildLine = ({ productId, extraIds = [], removed = [], qty = 1, note = '' }) => {
  const product = getProduct(productId)
  if (!product) return null

  /* Solo se pueden quitar ingredientes que el producto lleva */
  const quitados = (product.ingredients || []).filter((ing) => removed.includes(ing))

  return {
    id: lineId({ productId, extraIds, removed: quitados, note }),
    productId,
    name: product.name,
    image: product.image,
    category: product.category,
    sizeLabel: isPizza(product) ? PIZZA_SIZE.diameter : null,
    extraIds: [...extraIds].sort(),
    extraLabels: extraIds.map((id) => getExtra(id)?.label).filter(Boolean),
    removed: quitados,
    note: note.trim(),
    qty,
    unitPrice: unitPrice(product, { extraIds }),
  }
}

/** Redondeo a dos decimales sin errores de coma flotante */
export function round(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100
}
