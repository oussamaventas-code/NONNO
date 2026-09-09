/* ═══════════════════════════════════════════════════════════════
   Saneado y validación del pedido que llega desde el navegador.

   Aparte del handler para poder probarlo solo. Regla: nada que
   venga del cliente entra en la base sin pasar por aquí, y los
   importes se recalculan en el servidor — un navegador puede
   mentir sobre el total.
   ═══════════════════════════════════════════════════════════════ */

const trim = (value, max) => String(value ?? '').trim().slice(0, max)
const money = (n) => Math.round((Number(n) || 0) * 100) / 100

export function sanitizeOrder(body) {
  const rawItems = Array.isArray(body?.items) ? body.items.slice(0, 60) : []

  const items = rawItems.map((i) => {
    const qty = Math.max(1, Math.min(99, Math.floor(Number(i?.qty)) || 1))
    const unitPrice = Math.max(0, money(i?.unitPrice))
    return {
      name: trim(i?.name, 80),
      size: trim(i?.size, 60) || null,
      extras: Array.isArray(i?.extras) ? i.extras.slice(0, 20).map((e) => trim(e, 60)) : [],
      /* Ingredientes que el cliente ha quitado. Van a cocina. */
      removed: Array.isArray(i?.removed) ? i.removed.slice(0, 20).map((e) => trim(e, 60)) : [],
      note: trim(i?.note, 140) || null,
      qty,
      unitPrice,
      total: money(unitPrice * qty),
    }
  }).filter((i) => i.name)

  return {
    ref: trim(body?.ref, 20) || `NN-${Math.floor(1000 + Math.random() * 9000)}`,
    location_id: trim(body?.location?.id, 40),
    location_name: trim(body?.location?.name, 80),
    mode: body?.mode === 'delivery' ? 'delivery' : 'pickup',
    customer_name: trim(body?.customer?.name, 80),
    customer_phone: trim(body?.customer?.phone, 40),
    address: trim(body?.customer?.address, 200) || null,
    notes: trim(body?.customer?.notes, 400) || null,
    items,
    item_count: items.reduce((n, i) => n + i.qty, 0),
    total: money(items.reduce((sum, i) => sum + i.total, 0)),
  }
}

export function validateOrder(order) {
  if (!order.items.length) return 'El pedido está vacío.'
  if (!order.location_id) return 'Falta la sede.'
  if (!order.customer_name) return 'Falta el nombre.'
  if (!order.customer_phone) return 'Falta el teléfono.'
  if (order.mode === 'delivery' && !order.address) return 'Falta la dirección de entrega.'
  return null
}
