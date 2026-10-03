import { SITE } from '../data/site'
import { getLocation } from '../data/locations'
import { cartCount } from './pricing'
import { orderTotals } from './orderTotals'
import { deliveryQuote, deliveryProblem } from './delivery'
import { price, orderRef } from './format'
import { mobileNumber } from './customerLookup'

/* ═══════════════════════════════════════════════════════════════
   CAPA DE INTEGRACIÓN DE PEDIDOS

   ⚠️ AQUÍ SE CONECTA EL BACKEND. Ni un componente sabe cómo se
   envía un pedido: solo llaman a submitOrder().

   Hoy el adaptador activo es 'api' (SITE.ordering.adapter): el pedido
   se guarda en la base de datos y aparece en el panel de cocina.

   OTROS CANALES:
   - WhatsApp        -> adapter 'whatsapp' + teléfono en locations.js
   - Plataforma ext. -> adapter 'external' + orderUrl de la sede
   - Sin enviar      -> adapter 'none'
   ═══════════════════════════════════════════════════════════════ */

const whereOf = (customer) => ({ coords: customer?.coords || null, tier: customer?.tier ?? null })

/** Payload normalizado. Este es el contrato con cualquier backend. */
export function buildOrderPayload({ lines, locationId, mode, customer, clientKey, ref, redeemPoints = 0 }) {
  const location = getLocation(locationId)
  const totals = orderTotals({ lines, mode, locationId, where: whereOf(customer), pointsRedeemed: redeemPoints })
  return {
    /* La referencia no cambia entre reintentos: si el cliente acaba
       mandándolo por WhatsApp, cocina ve la misma que en el panel. */
    ref: ref || orderRef(),
    /* Misma clave en cada reintento del mismo pedido: el servidor no lo duplica. */
    clientKey,
    createdAt: new Date().toISOString(),
    channel: 'web',
    version: SITE.brand.version,
    location: location
      ? { id: location.id, name: location.name, fullName: location.fullName }
      : null,
    mode, // 'pickup' | 'delivery'
    customer: {
      name: customer?.name?.trim() || '',
      phone: customer?.phone?.trim() || '',
      email: customer?.email?.trim() || '',
      marketing: Boolean(customer?.marketing),
      address: mode === 'delivery' ? customer?.address?.trim() || '' : null,
      coords: mode === 'delivery' ? customer?.coords || null : null,
      tier: mode === 'delivery' ? customer?.tier ?? null : null,
      notes: customer?.notes?.trim() || '',
    },
    items: lines.map((l) => ({
      id: l.productId,
      portionId: l.portionId,
      extraIds: l.extraIds,
      name: l.name,
      category: l.category,
      size: l.sizeLabel,
      extras: l.extraLabels,
      removed: l.removed || [],
      note: l.note,
      qty: l.qty,
      unitPrice: l.unitPrice,
      total: Number((l.unitPrice * l.qty).toFixed(2)),
    })),
    count: cartCount(lines),
    subtotal: totals.subtotal,
    discount: totals.discount,
    deals: totals.deals,
    deliveryZone: totals.delivery?.ok ? totals.delivery.label : null,
    deliveryFee: totals.deliveryFee,
    /* Club Nonno: el servidor comprueba el saldo y recalcula el descuento */
    redeemPoints: totals.pointsRedeemed,
    pointsDiscount: totals.pointsDiscount,
    total: totals.total,
  }
}

/** Validación previa: devuelve la lista de errores por campo */
export function validateOrder({ lines, locationId, mode, customer }) {
  const errors = {}
  if (!lines?.length) errors.cart = 'Tu pedido está vacío.'
  if (!locationId) errors.location = 'Elige una sede.'
  if (!mode) errors.mode = 'Elige recogida o entrega.'
  if (!customer?.name?.trim()) errors.name = 'Necesitamos un nombre.'
  if (!customer?.phone?.trim()) errors.phone = 'Necesitamos un teléfono de contacto.'
  else if (!mobileNumber(customer.phone)) errors.phone = 'Escribe un móvil español (empieza por 6 o 7).'
  if (mode === 'delivery' && !customer?.address?.trim())
    errors.address = 'Necesitamos la dirección de entrega.'
  if (mode === 'delivery') {
    const problem = deliveryProblem(deliveryQuote(locationId, whereOf(customer)))
    if (problem) errors.delivery = problem
  }
  return errors
}

/** Texto plano del pedido: WhatsApp, impresión en cocina o email */
export function orderToText(payload) {
  const lines = payload.items.map((i) => {
    const bits = [`${i.qty}x ${i.name}`]
    if (i.size) bits.push(`(${i.size})`)
    /* Lo que se quita va en mayúsculas y por delante de los extras:
       es el dato que más se pasa por alto en cocina. */
    if (i.removed?.length) bits.push(`>> SIN ${i.removed.join(', SIN ').toUpperCase()}`)
    if (i.extras?.length) bits.push(`+ ${i.extras.join(', ')}`)
    if (i.note) bits.push(`— "${i.note}"`)
    return `• ${bits.join(' ')} · ${price(i.total)}`
  })
  return [
    `PEDIDO ${payload.ref} — LA PIZZA DE NONNO`,
    payload.location ? `Sede: ${payload.location.name}` : '',
    `Modo: ${payload.mode === 'delivery' ? 'Entrega' : 'Recogida'}`,
    '',
    ...lines,
    '',
    payload.discount || payload.deliveryFee || payload.pointsDiscount ? `Subtotal: ${price(payload.subtotal)}` : '',
    ...payload.deals.map((d) => `Oferta ${d.count > 1 ? `${d.count}× ` : ''}${d.label} por ${price(d.price)}`),
    payload.discount ? `Descuento recogida: -${price(payload.discount)}` : '',
    payload.pointsDiscount ? `Puntos Club Nonno (${payload.redeemPoints}): -${price(payload.pointsDiscount)}` : '',
    payload.deliveryFee ? `Envío (${payload.deliveryZone}): +${price(payload.deliveryFee)}` : '',
    `TOTAL: ${price(payload.total)}`,
    '',
    `Nombre: ${payload.customer.name}`,
    `Teléfono: ${payload.customer.phone}`,
    payload.customer.address ? `Dirección: ${payload.customer.address}` : '',
    payload.customer.notes ? `Notas: ${payload.customer.notes}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

/* Aviso al local de que el pedido le llega por el plan B. */
const fallbackText = (text) =>
  `${text}\n\n(La web no ha podido enviarlo a cocina. Si ya lo tenéis en el panel con esta referencia, no lo repitáis.)`

/** Enlaces del plan B para una sede: WhatsApp con el pedido escrito y teléfonos. */
export function fallbackContacts(locationId, text) {
  const location = getLocation(locationId)
  return {
    whatsappUrl: location?.whatsapp ? `https://wa.me/${location.whatsapp}?text=${encodeURIComponent(text)}` : null,
    phones: location?.phones || [],
  }
}

/**
 * Envía el pedido por el canal configurado.
 * @returns {Promise<{status:'ready'|'sent'|'error', payload, text, url?, message?}>}
 */
export async function submitOrder(input) {
  const errors = validateOrder(input)
  if (Object.keys(errors).length) {
    return { status: 'error', errors, message: SITE.messages.error }
  }

  const payload = buildOrderPayload(input)
  const text = orderToText(payload)
  const { adapter, apiEndpoint, externalUrl } = SITE.ordering

  try {
    if (adapter === 'whatsapp') {
      const phone = getLocation(input.locationId)?.whatsapp
      if (!phone) throw new Error('Sede sin WhatsApp configurado')
      const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
      return { status: 'sent', payload, text, url }
    }

    if (adapter === 'api') {
      let res
      let data = {}
      try {
        res = await fetch(apiEndpoint || '/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(15000),
        })
        data = await res.json().catch(() => ({}))
      } catch {
        res = null
      }

      /* PLAN B: sin respuesta, o fallo del servidor que no es una
         negativa normal (sede cerrada, horno lleno, dato que falta).
         El pedido no se pierde: se ofrece mandarlo por WhatsApp ya
         escrito, o llamar. */
      const systemDown = !res
        || (res.status >= 500 && !data.code)
        || (!res.ok && !data.error) /* respuesta que no es de nuestra API */
      if (systemDown) {
        return { status: 'error', fallback: true, payload, text: fallbackText(text), message: SITE.messages.error }
      }
      if (!res.ok) {
        return {
          status: 'error',
          payload,
          text,
          message: data.error || SITE.messages.error,
        }
      }

      /* La referencia buena es la que ha quedado guardada en cocina. */
      return {
        status: 'sent',
        payload: { ...payload, ref: data.ref || payload.ref, total: data.total ?? payload.total },
        /* Hora definitiva: la franja que ha asignado el servidor. */
        arrivalAt: payload.mode === 'delivery' ? data.etaAt : data.readyAt,
        /* Enlace de seguimiento del pedido (página /p/...) */
        track: data.track || null,
        text,
        message: 'Pedido recibido en cocina.',
      }
    }

    if (adapter === 'external') {
      const url = getLocation(input.locationId)?.orderUrl || externalUrl
      if (!url) throw new Error('Plataforma externa no configurada')
      return { status: 'sent', payload, text, url }
    }

    /* adapter 'none' — sin backend todavía.
       El pedido queda compuesto, validado y listo para enviarse. */
    return { status: 'ready', payload, text, message: SITE.messages.orderReady }
  } catch (error) {
    return { status: 'error', payload, text, message: SITE.messages.error, detail: String(error) }
  }
}
