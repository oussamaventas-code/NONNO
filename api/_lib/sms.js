import { getLocation } from '../../src/data/locations.js'
import { hourOf } from '../../src/lib/kitchenSlots.js'

/* ═══════════════════════════════════════════════════════════════
   SMS AL CLIENTE — desde un móvil Android del local

   El móvil lleva la app gratuita "SMS Gateway for Android"
   (sms-gate.app) en modo nube: nuestro servidor le pide que envíe
   el SMS y sale con la tarifa de esa SIM. Sin coste por mensaje si
   la tarifa incluye SMS.

   Variables en Vercel (las da la app al activar "Cloud server"):
     SMS_GATEWAY_USER, SMS_GATEWAY_PASSWORD
     SMS_GATEWAY_URL (opcional; por defecto el servidor público)

   PLAN B: si el móvil está apagado o sin cobertura, el pedido sigue
   su curso igual. El fallo queda apuntado en el pedido y el panel
   avisa para llamar al cliente.
   ═══════════════════════════════════════════════════════════════ */

const DEFAULT_URL = 'https://api.sms-gate.app/3rdparty/v1/messages'

export const smsConfigured = () =>
  Boolean(process.env.SMS_GATEWAY_USER && process.env.SMS_GATEWAY_PASSWORD)

/** Móvil español en formato +34XXXXXXXXX, o null si no es un móvil (los fijos no reciben SMS). */
export function mobileNumber(raw) {
  let digits = String(raw || '').replace(/[^\d+]/g, '')
  if (digits.startsWith('+34')) digits = digits.slice(3)
  else if (digits.startsWith('0034')) digits = digits.slice(4)
  return /^[67]\d{8}$/.test(digits) ? `+34${digits}` : null
}

/* Sin tildes ni símbolos raros: así el SMS usa el alfabeto básico y
   caben 160 caracteres en un solo mensaje (con una tilde bajaría a 70). */
const plain = (text) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/€/g, 'EUR')
const euros = (n) => `${Number(n).toFixed(2).replace('.', ',')} EUR`

/** Texto de cada aviso. null = ese aviso no aplica a este pedido. */
export function smsText(kind, order) {
  const location = getLocation(order.location_id)
  const contact = location?.phones?.[0]?.replace(/\s/g, '')
  const tail = contact ? ` Dudas: ${contact}` : ''
  const delivery = order.mode === 'delivery'

  if (kind === 'recibido') {
    const when = delivery
      ? (order.eta_at ? `Entrega hacia las ${hourOf(order.eta_at)}` : 'Te avisamos cuando salga')
      : (order.ready_at ? `Recogida en ${location?.name} a las ${hourOf(order.ready_at)}` : `Recogida en ${location?.name}`)
    return plain(`La Pizza de Nonno: pedido ${order.ref} recibido. ${when}. Total ${euros(order.total)}.${tail}`)
  }
  if (kind === 'listo') {
    return plain(delivery
      ? `La Pizza de Nonno: tu pedido ${order.ref} sale ya.${order.eta_at ? ` Llega hacia las ${hourOf(order.eta_at)}.` : ''}`
      : `La Pizza de Nonno: tu pedido ${order.ref} ya esta listo para recoger en ${location?.name}. Te esperamos!`)
  }
  if (kind === 'cancelado') {
    return plain(`La Pizza de Nonno: tu pedido ${order.ref} se ha cancelado.${tail}`)
  }
  return null
}

/**
 * Envía un SMS. Nunca lanza: devuelve el resultado para apuntarlo.
 * @returns {Promise<{ ok: boolean, at: string, error?: string, skipped?: string }>}
 */
export async function sendSms(phone, text) {
  const at = new Date().toISOString()
  if (!smsConfigured()) return { ok: false, at, skipped: 'sms-no-configurado' }
  const to = mobileNumber(phone)
  if (!to) return { ok: false, at, skipped: 'no-es-movil' }

  try {
    const auth = Buffer.from(`${process.env.SMS_GATEWAY_USER}:${process.env.SMS_GATEWAY_PASSWORD}`).toString('base64')
    const res = await fetch(process.env.SMS_GATEWAY_URL || DEFAULT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
      body: JSON.stringify({ textMessage: { text }, phoneNumbers: [to] }),
      /* Corto a propósito: el cliente no debe esperar por el SMS. */
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return { ok: false, at, error: `pasarela ${res.status}` }
    return { ok: true, at }
  } catch (err) {
    return { ok: false, at, error: err?.name === 'TimeoutError' ? 'sin respuesta del movil' : 'sin conexion con la pasarela' }
  }
}

/**
 * Manda un aviso una sola vez por pedido y lo apunta en `sms`
 * ({ recibido: {ok, at, ...}, listo: ..., cancelado: ... }).
 * @param {object} db   cliente de Supabase
 * @returns {Promise<object|null>} el registro actualizado, o null si no se envió nada
 */
export async function notifyCustomer(db, order, kind) {
  if (order.sms?.[kind]?.ok) return null
  /* En el mostrador el cliente está delante: solo se avisa de "listo". */
  if (kind === 'recibido' && order.channel === 'mostrador') return null
  const text = smsText(kind, order)
  if (!text || !order.customer_phone) return null

  const result = await sendSms(order.customer_phone, text)
  if (result.skipped === 'sms-no-configurado') return null
  const sms = { ...(order.sms || {}), [kind]: result }
  const { error } = await db.from('orders').update({ sms }).eq('id', order.id)
  if (error) console.error('Error apuntando el SMS:', error)
  return sms
}
