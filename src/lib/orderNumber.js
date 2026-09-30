import { madridDay } from './stock.js'

/* ═══════════════════════════════════════════════════════════════
   NÚMERO DE PEDIDO DEL DÍA
   Cada sede numera sus pedidos 01, 02, 03… y vuelve a empezar cada
   día de servicio: el cliente oye "el 07" y lo recuerda. El día cambia
   a las 5 de la mañana, así un pedido de las 00:30 sigue en la misma
   noche. Lo usan el servidor (api/orders.js) y la factura.
   ═══════════════════════════════════════════════════════════════ */

const DAY_STARTS_AT_HOUR = 5

/** Día de servicio en hora de Madrid: "2026-09-29". */
export const serviceDay = (ms = Date.now()) => madridDay(ms - DAY_STARTS_AT_HOUR * 3600000)

/** ¿Es un número del día ("07", "123") y no una referencia antigua ("NN-4821")? */
export const isDailyNumber = (ref) => /^\d+$/.test(String(ref || ''))

/** Siguiente número a partir de los ya usados hoy en la sede: "01", "02"… "100". */
export function nextNumber(usedRefs) {
  const max = (usedRefs || []).filter(isDailyNumber).reduce((m, r) => Math.max(m, Number(r)), 0)
  return String(max + 1).padStart(2, '0')
}

/**
 * Número de factura único: el del día se repite cada día, así que la
 * factura lleva delante la fecha y la sede: "20260929-sangonera-07".
 */
export const invoiceNumber = (order) =>
  isDailyNumber(order?.ref)
    ? `${(order.service_day || serviceDay(Date.parse(order.created_at))).replace(/-/g, '')}-${order.location_id}-${order.ref}`
    : order?.ref
