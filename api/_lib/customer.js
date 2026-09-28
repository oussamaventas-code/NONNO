import { createHmac, randomInt, timingSafeEqual, randomBytes } from 'node:crypto'
import { db } from './supabase.js'
import { mobileNumber } from './sms.js'
import { LOYALTY, pointsFor } from '../../src/data/loyalty.js'

/* ═══════════════════════════════════════════════════════════════
   CLUB NONNO — cuentas de cliente (servidor)

   El cliente entra con su móvil y un código que le llega por SMS.
   La sesión es una cookie httpOnly firmada, igual que la del panel
   pero con otro nombre y otro secreto: una cosa no abre la otra.

   Variables en Vercel:
     CUSTOMER_SESSION_SECRET  (si falta, se usa ADMIN_SESSION_SECRET)

   Si las tablas del club no existen todavía (no se ha ejecutado
   supabase/club-nonno.sql), todo esto responde "club no activo" y
   los pedidos siguen funcionando exactamente igual.
   ═══════════════════════════════════════════════════════════════ */

const COOKIE = 'nonno_cliente'
const MAX_AGE = 60 * 60 * 24 * 180 // 180 días

export const CODE_TTL_MIN = 10
export const MAX_ATTEMPTS = 5          // intentos por código
export const RESEND_SECONDS = 60       // espera entre dos SMS al mismo móvil
export const MAX_SENDS_PER_HOUR = 5    // SMS por móvil y hora

const secret = () =>
  process.env.CUSTOMER_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || ''

export const sessionConfigured = () => Boolean(secret())

const sign = (value) => createHmac('sha256', `cliente:${secret()}`).update(value).digest('base64url')

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a))
  const bufB = Buffer.from(String(b))
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB)
}

/** Móvil normalizado (+34XXXXXXXXX) o null si no es un móvil español. */
export const normalizePhone = mobileNumber

/** ¿El error de Supabase es porque las tablas del club no existen? */
export const isMissingTable = (error) =>
  Boolean(error && (error.code === '42P01' || error.code === 'PGRST205' || error.code === '42703' || /does not exist|schema cache/i.test(error.message || '')))

// ── Sesión ─────────────────────────────────────────────────────

export function createCustomerCookie(customerId) {
  const body = `${Date.now()}.${randomBytes(6).toString('hex')}~${customerId}`
  return [
    `${COOKIE}=${body}~${sign(body)}`,
    'HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/', `Max-Age=${MAX_AGE}`,
  ].join('; ')
}

export const clearCustomerCookie = () => `${COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`

/** @returns {string|null} id del cliente con sesión válida */
export function readCustomerId(req) {
  if (!secret()) return null
  const match = (req.headers?.cookie || '').split(';').map((c) => c.trim()).find((c) => c.startsWith(`${COOKIE}=`))
  if (!match) return null
  const parts = match.slice(COOKIE.length + 1).split('~')
  if (parts.length !== 3) return null
  const [issued, id, signature] = parts
  if (!safeEqual(signature, sign(`${issued}~${id}`))) return null
  const at = Number(issued.split('.')[0])
  if (!at || Date.now() - at > MAX_AGE * 1000) return null
  return id
}

// ── Códigos por SMS ────────────────────────────────────────────

export const newCode = () => String(randomInt(0, 10 ** LOYALTY.codeLength)).padStart(LOYALTY.codeLength, '0')

/** Huella del código ligada al móvil: la tabla nunca guarda el código. */
export const hashCode = (phone, code) => createHmac('sha256', `codigo:${secret()}`).update(`${phone}:${code}`).digest('hex')

export const codeMatches = (row, phone, code) =>
  Boolean(row && /^\d+$/.test(String(code)) && safeEqual(row.code_hash, hashCode(phone, String(code))))

// ── Clientes y puntos ─────────────────────────────────────────

/** Cliente por id, o null. Lanza si el club no está activo. */
export async function getCustomer(id) {
  if (!id) return null
  const { data, error } = await db().from('customers').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

/**
 * Mueve puntos de forma atómica (función loyalty_move de la base de datos).
 * Un mismo pedido no puede sumar, canjear o devolver dos veces.
 * @returns {Promise<number>} saldo final
 */
export async function movePoints(customerId, orderId, delta, reason, note = null) {
  const { data, error } = await db().rpc('loyalty_move', {
    p_customer: customerId, p_order: orderId, p_delta: delta, p_reason: reason, p_note: note,
  })
  if (error) throw error
  return data
}

/**
 * Puntos al cambiar de estado un pedido en cocina. Nunca lanza: si el
 * club no está activo o algo falla, el pedido sigue igual y se apunta
 * el error en el registro.
 *   entregado → suma 1 punto por euro (si el pedido es de un cliente
 *               del club; si no tenía cuenta asociada se busca por su móvil)
 *   cancelado → devuelve los puntos canjeados y anula los ganados
 */
export async function settleOrderPoints(order) {
  try {
    if (order.status === 'entregado') {
      let customerId = order.customer_id
      if (!customerId) {
        const phone = normalizePhone(order.customer_phone)
        if (!phone) return
        const { data, error } = await db().from('customers').select('id').eq('phone', phone).maybeSingle()
        if (error) throw error
        if (!data) return
        customerId = data.id
        await db().from('orders').update({ customer_id: customerId }).eq('id', order.id)
      }
      const earned = pointsFor(order.total)
      if (earned > 0) await movePoints(customerId, order.id, earned, 'pedido', `Pedido ${order.ref}`)
      return
    }

    if (order.status === 'cancelado' && order.customer_id) {
      if (Number(order.points_redeemed) > 0) {
        await movePoints(order.customer_id, order.id, Number(order.points_redeemed), 'devolucion', `Pedido ${order.ref} cancelado`)
      }
      /* Si ya había sumado puntos (se entregó y luego se canceló), se retiran */
      const { data: earned } = await db().from('points_ledger')
        .select('delta').eq('order_id', order.id).eq('reason', 'pedido').maybeSingle()
      if (earned?.delta > 0) {
        await movePoints(order.customer_id, order.id, -earned.delta, 'anulacion', `Pedido ${order.ref} cancelado`)
          .catch((err) => {
            /* Ya se los gastó: se deja constancia, no se bloquea la cancelación */
            if (/saldo_insuficiente/.test(err?.message || '')) console.warn(`Puntos del pedido ${order.ref} ya gastados`)
            else throw err
          })
      }
    }
  } catch (err) {
    if (!isMissingTable(err)) console.error('Error moviendo puntos del pedido', order.ref, err)
  }
}
