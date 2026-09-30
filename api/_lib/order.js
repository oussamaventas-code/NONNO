import { buildLine } from '../../src/lib/pricing.js'
import { orderTotals } from '../../src/lib/orderTotals.js'
import { getLocation } from '../../src/data/locations.js'
import { ovenUnits } from '../../src/lib/kitchenSlots.js'
import { deliveryProblem } from '../../src/lib/delivery.js'
import { isOrderable } from '../../src/data/menu.js'

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

/** Referencia de reserva ("NN-4821"), solo si la base de datos aún no tiene
    el número del día (supabase/numero-pedido.sql). Con 6 cifras si las de 4 chocan. */
export const newRef = (digits = 4) =>
  `NN-${Math.floor(10 ** (digits - 1) + Math.random() * 9 * 10 ** (digits - 1))}`
export const PAYMENT_METHODS = ['efectivo', 'tarjeta']

/**
 * @param {object} body
 * @param {{ staff?: boolean, customerId?: string, redeem?: number }} opts
 *   staff: pedido creado desde el panel (mostrador o teléfono). Solo el
 *   personal puede marcarlo como pagado al crearlo y el teléfono es
 *   opcional en mostrador.
 *   customerId / redeem: cliente del Club Nonno con sesión y puntos que
 *   quiere canjear, ya limitados a su saldo por quien llama.
 */
/**
 * Pedido "para las HH:MM" (solo personal): devuelve desde qué momento puede
 * ocupar el horno para estar listo (o, en entrega, en la puerta) a esa hora.
 * Solo vale una hora futura de las próximas 12; si no, se ignora.
 */
function scheduleOf(body, { staff, locationId, delivery }) {
  if (!staff || !body?.scheduledFor) return null
  const target = Date.parse(body.scheduledFor)
  const now = Date.now()
  if (!Number.isFinite(target) || target < now + 5 * 60000 || target > now + 12 * 3600000) return null
  const slotMin = getLocation(locationId)?.kitchen?.slotMinutes || 15
  const travel = delivery?.ok ? delivery.minutes : 0
  return new Date(target - (travel + slotMin) * 60000).toISOString()
}

export function sanitizeOrder(body, { staff = false, customerId = null, redeem = 0 } = {}) {
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
  const where = whereOf(body?.customer)
  const totals = orderTotals({ lines, mode, locationId, where, pointsRedeemed: redeem })
  const delivery = totals.delivery
  const scheduledFor = scheduleOf(body, { staff, locationId, delivery })

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
      /* El número del día lo pone api/orders.js al guardar. Solo se respeta
         el de un pedido que el mostrador tomó sin conexión ("SC-213045"):
         es el que ya salió impreso en la comanda. */
      ref: staff && /^SC-\d{6}$/.test(trim(body?.ref, 20)) ? trim(body.ref, 20) : newRef(),
      location_id: locationId,
      location_name: getLocation(locationId)?.name || '',
      mode,
      customer_name: trim(body?.customer?.name, 80),
      customer_phone: trim(body?.customer?.phone, 40),
      address: mode === 'delivery' ? trim(body?.customer?.address, 200) || null : null,
      delivery_zone: delivery?.ok ? delivery.label : null,
      delivery_km: delivery?.ok ? delivery.km : null,
      delivery_lat: delivery?.ok && delivery.verified ? where.coords.lat : null,
      delivery_lng: delivery?.ok && delivery.verified ? where.coords.lng : null,
      delivery_verified: delivery?.ok ? delivery.verified : null,
      /* Tramo elegido a mano (plan B), guardado tal cual: si más
         adelante cambian los precios de envío, no hay que reconstruir
         qué tramo era comparando la tarifa guardada con las tarifas
         de ese momento — eso se rompería con cualquier cambio de precio. */
      delivery_tier: delivery?.ok && !delivery.verified ? where.tier : null,
      client_key: trim(body?.clientKey, 64) || null,
      notes: trim(body?.customer?.notes, 400) || null,
      items,
      item_count: items.reduce((n, i) => n + i.qty, 0),
      pizza_count: ovenUnits(items),
      subtotal: totals.subtotal,
      discount: totals.discount,
      deals: totals.deals,
      delivery_fee: totals.deliveryFee,
      total: totals.total,
      /* Solo se añaden si hay cliente o canje: así, sin las columnas del
         club creadas en la base de datos, los pedidos siguen entrando. */
      ...(customerId ? { customer_id: customerId } : {}),
      /* Igual que el club: solo si hay pedido programado, para que sin la
         columna nueva los pedidos normales sigan entrando. */
      ...(scheduledFor ? { scheduled_for: scheduledFor } : {}),
      ...(totals.pointsRedeemed > 0 ? { points_redeemed: totals.pointsRedeemed, points_discount: totals.pointsDiscount } : {}),
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
    delivery,
  }
}

/** Punto de entrega que manda el navegador: coordenadas o, como plan B, un tramo. */
function whereOf(customer) {
  const lat = Number(customer?.coords?.lat)
  const lng = Number(customer?.coords?.lng)
  const coords = Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null
  const tier = Number.isInteger(customer?.tier) ? customer.tier : undefined
  return { coords, tier }
}

export function validateOrder({ order, unknownProduct, delivery }) {
  const location = getLocation(order.location_id)
  if (unknownProduct) return 'Algún producto ya no está en la carta. Revisa tu pedido.'
  if (!order.items.length) return 'El pedido está vacío.'
  /* Ocultos y agotados: solo frenan a la web. El mostrador puede vender
     lo que tenga en la mano aunque el panel lo marque como agotado. */
  if (order.channel === 'web') {
    const blocked = order.items.find((i) => !isOrderable(i.id, order.location_id))
    if (blocked) return `${blocked.name} está agotado ahora mismo en esta sede. Quítalo del pedido para continuar.`
  }
  if (!location) return 'Falta la sede.'
  if (!order.customer_name) return 'Falta el nombre.'
  /* En mostrador el teléfono es opcional SOLO si el cliente se lo lleva
     él mismo: para una entrega hace falta poder llamarle, venga de
     donde venga el pedido. */
  if (!order.customer_phone && (order.channel !== 'mostrador' || order.mode === 'delivery')) return 'Falta el teléfono.'
  if (order.mode === 'delivery') {
    if (!order.address) return 'Falta la dirección de entrega.'
    if (!delivery?.ok) return deliveryProblem(delivery)
  } else if (!location.services.pickup) {
    return 'Esta sede no admite recogida.'
  }
  return null
}
