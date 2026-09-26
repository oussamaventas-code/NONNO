import { buildLine } from '../../src/lib/pricing.js'
import { orderTotals } from '../../src/lib/orderTotals.js'
import { getLocation } from '../../src/data/locations.js'
import { ovenUnits } from '../../src/lib/kitchenSlots.js'

/* ═══════════════════════════════════════════════════════════════
   Saneado y validación del pedido que llega desde el navegador.

   Aparte del handler para poder probarlo solo. Regla: del navegador
   solo se acepta QUÉ se pide (producto, ración, toppings, cantidad).
   Nombres, precios, oferta de recogida y envío se sacan de la carta
   y se recalculan aquí — un navegador puede mentir sobre el total.
   ═══════════════════════════════════════════════════════════════ */

const trim = (value, max) => String(value ?? '').trim().slice(0, max)
const list = (value, max, len) =>
  Array.isArray(value) ? value.slice(0, max).map((v) => trim(v, len)).filter(Boolean) : []

const CHANNELS = ['mostrador', 'telefono']
export const PAYMENT_METHODS = ['efectivo', 'tarjeta']

/**
 * @param {object} body
 * @param {{ staff?: boolean }} opts  staff: pedido creado desde el panel
 *   (mostrador o teléfono). Solo el personal puede marcarlo como pagado
 *   al crearlo y el teléfono es opcional en mostrador.
 */
export function sanitizeOrder(body, { staff = false } = {}) {
  const rawItems = Array.isArray(body?.items) ? body.items.slice(0, 60) : []
  let unknownProduct = false

  const lines = rawItems.map((i) => {
    const line = buildLine({
      productId: trim(i?.id, 60),
      portionId: trim(i?.portionId, 20) || undefined,
      extraIds: list(i?.extraIds, 20, 40),
      removed: list(i?.removed, 20, 60),
      note: trim(i?.note, 140),
      qty: Math.max(1, Math.min(99, Math.floor(Number(i?.qty)) || 1)),
    })
    if (!line) unknownProduct = true
    return line
  }).filter(Boolean)

  const mode = body?.mode === 'delivery' ? 'delivery' : 'pickup'
  const locationId = trim(body?.location?.id, 40)
  const zoneId = trim(body?.customer?.zone, 40)
  const totals = orderTotals({ lines, mode, locationId, zoneId })

  const items = lines.map((l) => ({
    /* Lo que se pidió, para poder editar el pedido desde el mostrador */
    id: l.productId,
    portionId: l.portionId,
    extraIds: l.extraIds,
    name: l.name,
    /* Categoría del producto: es lo que permite imprimir un tiquet
       por puesto de cocina. */
    category: l.category,
    size: l.sizeLabel,
    extras: l.extraLabels,
    removed: l.removed,
    note: l.note || null,
    qty: l.qty,
    unitPrice: l.unitPrice,
    total: Math.round(l.unitPrice * l.qty * 100) / 100,
  }))

  return {
    order: {
      ref: trim(body?.ref, 20) || `NN-${Math.floor(1000 + Math.random() * 9000)}`,
      location_id: locationId,
      location_name: getLocation(locationId)?.name || '',
      mode,
      customer_name: trim(body?.customer?.name, 80),
      customer_phone: trim(body?.customer?.phone, 40),
      address: mode === 'delivery' ? trim(body?.customer?.address, 200) || null : null,
      delivery_zone: totals.zone?.name || null,
      notes: trim(body?.customer?.notes, 400) || null,
      items,
      item_count: items.reduce((n, i) => n + i.qty, 0),
      pizza_count: ovenUnits(items),
      subtotal: totals.subtotal,
      discount: totals.discount,
      deals: totals.deals,
      delivery_fee: totals.deliveryFee,
      total: totals.total,
      channel: staff ? (CHANNELS.includes(body?.channel) ? body.channel : 'mostrador') : 'web',
      ...(staff && body?.paymentStatus === 'pagado'
        ? {
            payment_status: 'pagado',
            payment_method: PAYMENT_METHODS.includes(body?.paymentMethod) ? body.paymentMethod : 'efectivo',
            paid_at: new Date().toISOString(),
          }
        : {}),
    },
    unknownProduct,
    zoneRequested: zoneId,
    zone: totals.zone,
  }
}

export function validateOrder({ order, unknownProduct, zoneRequested }) {
  const location = getLocation(order.location_id)
  if (unknownProduct) return 'Algún producto ya no está en la carta. Revisa tu pedido.'
  if (!order.items.length) return 'El pedido está vacío.'
  if (!location) return 'Falta la sede.'
  if (!order.customer_name) return 'Falta el nombre.'
  if (!order.customer_phone && order.channel !== 'mostrador') return 'Falta el teléfono.'
  if (order.mode === 'delivery') {
    if (!location.services.delivery) return 'Esta sede no hace entregas a domicilio.'
    if (!order.delivery_zone) {
      return zoneRequested ? 'No repartimos en esa zona.' : 'Falta la zona de entrega.'
    }
    if (!order.address) return 'Falta la dirección de entrega.'
  } else if (!location.services.pickup) {
    return 'Esta sede no admite recogida.'
  }
  return null
}
