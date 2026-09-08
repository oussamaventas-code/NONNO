import { getExtra, getProduct, defaultSize } from '../data/menu'

/* ═══════════════════════════════════════════════════════════════
   MOTOR DE PRECIOS
   Toda la aritmética del pedido vive aquí: los componentes solo
   pintan. Precio base por tamaño + extras, multiplicado por unidades.
   ═══════════════════════════════════════════════════════════════ */

/** Precio base del producto según el tamaño elegido */
export const basePrice = (product, sizeId) => {
  if (!product) return 0
  if (!product.sizes) return product.price || 0
  const size = product.sizes.find((s) => s.id === sizeId) || defaultSize(product)
  return size ? size.price : 0
}

/** Suma de los extras seleccionados */
export const extrasPrice = (extraIds = []) =>
  extraIds.reduce((total, id) => total + (getExtra(id)?.price || 0), 0)

/** Precio de una unidad configurada (base + extras) */
export const unitPrice = (product, { sizeId, extraIds = [] } = {}) =>
  round(basePrice(product, sizeId) + extrasPrice(extraIds))

/** Total de una línea del carrito */
export const lineTotal = (line) => round(line.unitPrice * line.qty)

/** Subtotal del carrito */
export const cartSubtotal = (lines = []) =>
  round(lines.reduce((total, line) => total + lineTotal(line), 0))

/** Unidades totales (contador de la navbar y la barra móvil) */
export const cartCount = (lines = []) =>
  lines.reduce((total, line) => total + line.qty, 0)

/**
 * Identidad de línea: mismo producto + mismo tamaño + mismos extras
 * + misma nota => se agrupa en una sola línea con más cantidad.
 */
export const lineId = ({ productId, sizeId, extraIds = [], note = '' }) =>
  [productId, sizeId || 'unica', [...extraIds].sort().join('+') || 'sin-extras', note.trim().toLowerCase()]
    .join('__')

/**
 * Construye una línea de carrito completa a partir de una selección.
 * Congela nombre, imagen y precio para que el carrito siga siendo
 * legible aunque el catálogo cambie después.
 */
export const buildLine = ({ productId, sizeId, extraIds = [], qty = 1, note = '' }) => {
  const product = getProduct(productId)
  if (!product) return null

  const size = product.sizes
    ? product.sizes.find((s) => s.id === sizeId) || defaultSize(product)
    : null

  return {
    id: lineId({ productId, sizeId: size?.id, extraIds, note }),
    productId,
    name: product.name,
    image: product.image,
    category: product.category,
    sizeId: size?.id || null,
    sizeLabel: size ? `${size.label} · ${size.diameter}` : null,
    extraIds: [...extraIds].sort(),
    extraLabels: extraIds.map((id) => getExtra(id)?.label).filter(Boolean),
    note: note.trim(),
    qty,
    unitPrice: unitPrice(product, { sizeId: size?.id, extraIds }),
  }
}

/** Redondeo a dos decimales sin errores de coma flotante */
export function round(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100
}
