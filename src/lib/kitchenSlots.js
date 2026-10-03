import { stationOf } from '../data/menu.js'

/* ═══════════════════════════════════════════════════════════════
   FRANJAS DEL HORNO
   Cada sede tiene franjas de 15 min con un máximo de pizzas por
   franja. Un pedido ocupa la primera franja con hueco y, si no le
   caben todas, sigue en la siguiente. Está listo al terminar la
   última franja que usa. Las horas se calculan en hora de Madrid
   aunque el servidor esté en UTC.

   Lo usan el servidor (asigna la franja al guardar) y la web
   (muestra la hora estimada antes de pedir).
   ═══════════════════════════════════════════════════════════════ */

const TZ = 'Europe/Madrid'
const MIN = 60000

const madridParts = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ, hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
})

/** Minutos que Madrid va por delante de UTC en ese instante. */
function offsetMinutes(ms) {
  const p = Object.fromEntries(madridParts.formatToParts(new Date(ms)).map((x) => [x.type, x.value]))
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / MIN)
}

/** Instante de las HH:MM (hora de Madrid) del mismo día que `refMs`. */
export function madridTime(refMs, hhmm) {
  const off = offsetMinutes(refMs)
  const local = new Date(refMs + off * MIN)
  const [h, m] = hhmm.split(':').map(Number)
  const guess = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), h, m) - off * MIN
  return guess + (off - offsetMinutes(guess)) * MIN
}

/** "20:30" en hora de Madrid. */
export const hourOf = (value) =>
  new Date(value).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: TZ })

const weekdayParts = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' })
/** 'sun' | 'mon' | ... en hora de Madrid, para horarios que cierran antes algunos días. */
const weekdayOf = (ms) => weekdayParts.format(new Date(ms)).slice(0, 3).toLowerCase()

/** Hora de cierre de `kitchen` para el día de `nowMs` (hora de Madrid). */
const closeOf = (kitchen, nowMs) => kitchen.closeByDay?.[weekdayOf(nowMs)] || kitchen.close

/** Unidades que pasan por el horno (pizzas, calzones y calzones dulces). */
export const ovenUnits = (items = []) =>
  items.reduce((n, i) => n + (stationOf(i.category) === 'pizzas' ? Number(i.qty) || 0 : 0), 0)

/**
 * Planifica un pedido de `pizzas` unidades hecho en `nowMs`.
 * @param {Map<number, number>} load  pizzas ya ocupadas por inicio de franja (ms)
 * @returns {{ ok: true, readyAt: number, slots: Array<{start: string, pizzas: number}> }
 *         | { ok: false, reason: 'full' | 'after-hours' }}
 */
export function planOrder({ nowMs, kitchen, load = new Map(), pizzas, notBeforeMs = 0 }) {
  const slotMs = kitchen.slotMinutes * MIN
  /* Sin horario fijo: abre y cierra quien manda, con el botón del panel */
  const open = kitchen.manual ? 0 : madridTime(nowMs, kitchen.open)
  const close = kitchen.manual ? Infinity : madridTime(nowMs, closeOf(kitchen, nowMs))
  /* Nunca la franja en curso: la siguiente que empiece a partir de ahora.
     Un pedido programado no entra antes de su hora (`notBeforeMs`). */
  const first = Math.max(Math.ceil(nowMs / slotMs) * slotMs, Math.ceil(notBeforeMs / slotMs) * slotMs, open)

  if (first + slotMs > close) return { ok: false, reason: 'after-hours' }
  if (pizzas <= 0) return { ok: true, readyAt: first + slotMs, slots: [] }

  let remaining = pizzas
  const slots = []
  for (let s = first; s + slotMs <= close && remaining > 0; s += slotMs) {
    const free = kitchen.pizzasPerSlot - (load.get(s) || 0)
    if (free <= 0) continue
    const take = Math.min(free, remaining)
    slots.push({ start: new Date(s).toISOString(), pizzas: take })
    remaining -= take
  }

  if (remaining > 0) return { ok: false, reason: 'full' }
  return { ok: true, readyAt: Date.parse(slots[slots.length - 1].start) + slotMs, slots }
}

/**
 * Igual que planOrder pero SIN comprobar hueco: para un pedido que ya
 * se está cocinando de verdad (recuperado tras quedarse sin conexión
 * el mostrador) y solo hace falta apuntar su carga real en el horno,
 * no decidir si cabía. Si el tope ya estaba lleno, este pedido lo deja
 * por encima del tope — es lo correcto: las pizzas ya están dentro.
 */
export function forcedSlot({ atMs, kitchen, pizzas }) {
  const slotMs = kitchen.slotMinutes * MIN
  const start = Math.floor(atMs / slotMs) * slotMs
  if (pizzas <= 0) return { readyAt: start + slotMs, slots: [] }
  return { readyAt: start + slotMs, slots: [{ start: new Date(start).toISOString(), pizzas }] }
}

const addToLoad = (load, slots) =>
  slots.forEach((s) => {
    const key = Date.parse(s.start)
    load.set(key, (load.get(key) || 0) + s.pizzas)
  })

/**
 * Ocupación del horno a partir de los pedidos guardados.
 * Los que ya tienen franja cuentan tal cual. Los que aún no la tienen
 * (recién entrados) se reparten por orden de llegada: dos pedidos que
 * entran a la vez obtienen siempre el mismo reparto, así que nunca se
 * pasa del tope aunque se procesen en paralelo.
 *
 * @param {Array<{id, created_at, pizza_count, oven_slots}>} orders  sin los cancelados
 * @returns {{ load: Map<number, number>, plans: Map<string, object> }}
 */
export function buildLoad(orders, kitchen) {
  const load = new Map()
  orders.filter((o) => Array.isArray(o.oven_slots)).forEach((o) => addToLoad(load, o.oven_slots))

  const plans = new Map()
  orders
    .filter((o) => !Array.isArray(o.oven_slots))
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at) || String(a.id).localeCompare(String(b.id)))
    .forEach((o) => {
      const plan = planOrder({
        nowMs: Date.parse(o.created_at), kitchen, load, pizzas: o.pizza_count || 0,
        notBeforeMs: o.scheduled_for ? Date.parse(o.scheduled_for) : 0,
      })
      if (plan.ok) addToLoad(load, plan.slots)
      plans.set(o.id, plan)
    })

  return { load, plans }
}

/**
 * ¿Está la cocina dentro de su horario ahora? Para avisar en la web
 * antes de que el cliente llene el carrito (el servidor lo vuelve a
 * comprobar al pedir).
 * @returns {{ open: boolean, opensAt: string, later: boolean }}
 *   later: todavía abre hoy (antes de la hora de apertura)
 */
export function kitchenHours(kitchen, nowMs = Date.now()) {
  if (!kitchen || kitchen.manual) return { open: true, opensAt: '', later: false }
  const openMs = madridTime(nowMs, kitchen.open)
  const closeMs = madridTime(nowMs, closeOf(kitchen, nowMs))
  return { open: nowMs >= openMs && nowMs < closeMs, opensAt: kitchen.open, later: nowMs < openMs }
}
