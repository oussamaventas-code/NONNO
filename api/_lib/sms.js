import { createHmac, timingSafeEqual } from 'node:crypto'
import { getLocation } from '../../src/data/locations.js'
import { hourOf } from '../../src/lib/kitchenSlots.js'
import { trackToken, trackPath } from '../../src/lib/tracking.js'

/* Enlace para seguir el pedido. Solo si SITE_URL está puesto en Vercel
   (p. ej. https://lapizzadenonno.es): sin él, el SMS va como antes. */
const trackUrl = (order) => {
  const base = String(process.env.SITE_URL || '').replace(/\/+$/, '')
  const token = trackToken(order)
  return base && token ? `${base}${trackPath(token)}` : ''
}
const trackLink = (order) => (trackUrl(order) ? ` Sigue tu pedido: ${trackUrl(order)}` : '')

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

/* ALTERNATIVA DE PAGO: Twilio (no necesita ningún móvil en el local).
   Si están sus tres variables, se usa Twilio en vez del Android:
     TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN
     TWILIO_FROM  → número de Twilio (+1…) o nombre de remitente (NONNO) */
const twilioConfigured = () =>
  Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM)
const gatewayConfigured = () =>
  Boolean(process.env.SMS_GATEWAY_USER && process.env.SMS_GATEWAY_PASSWORD)

export const smsConfigured = () => twilioConfigured() || gatewayConfigured()

/* ═══════════════════════════════════════════════════════════════
   WHATSAPP (Twilio) — va primero si está configurado; el SMS queda
   de reserva por si el cliente no tiene WhatsApp.

   WhatsApp solo deja al negocio escribir primero con PLANTILLAS
   aprobadas por Meta. Cada plantilla se crea en Twilio (Content
   Template Builder) y su identificador (HX…) va en una variable:
     TWILIO_WHATSAPP_FROM  → número de WhatsApp del negocio (+34…)
     TWILIO_WA_RECIBIDO    → pedido recibido      {{1}} nº {{2}} cuándo {{3}} total {{4}} enlace o teléfono
     TWILIO_WA_LISTO       → listo para recoger   {{1}} nº {{2}} sede
     TWILIO_WA_REPARTO     → sale a domicilio     {{1}} nº {{2}} hora de llegada
     TWILIO_WA_CANCELADO   → cancelado            {{1}} nº {{2}} teléfono
     TWILIO_WA_CODIGO      → código del Club      {{1}} código (plantilla de autenticación)
   Aviso que no tenga su plantilla → sale por SMS como siempre.
   ═══════════════════════════════════════════════════════════════ */

const WA_TEMPLATES = {
  recibido: 'TWILIO_WA_RECIBIDO',
  listo: 'TWILIO_WA_LISTO',
  reparto: 'TWILIO_WA_REPARTO',
  cancelado: 'TWILIO_WA_CANCELADO',
  codigo: 'TWILIO_WA_CODIGO',
}

const whatsappConfigured = () =>
  Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_FROM)

/** Identificador de la plantilla (HX…) de ese aviso, o null. */
const waTemplate = (key) => (whatsappConfigured() && process.env[WA_TEMPLATES[key]]) || null


/** Qué vía de envío está activa, para enseñarlo en el panel */
export const smsProvider = () =>
  waTemplate('listo') ? 'whatsapp' : twilioConfigured() ? 'twilio' : gatewayConfigured() ? 'android' : null

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
    const link = trackLink(order)
    /* Con enlace se quita el teléfono de dudas: está en la página */
    return plain(`La Pizza de Nonno: pedido ${order.ref} recibido. ${when}. Total ${euros(order.total)}.${link || tail}`)
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

/** Plantilla de WhatsApp y valores de sus huecos para cada aviso. null = no aplica. */
export function waMessage(kind, order) {
  const location = getLocation(order.location_id)
  const contact = location?.phones?.[0] || 'la tienda'
  const total = `${Number(order.total).toFixed(2).replace('.', ',')} €`

  if (kind === 'recibido') {
    const when = order.mode === 'delivery'
      ? (order.eta_at ? `Te lo llevamos hacia las ${hourOf(order.eta_at)}` : 'Te avisamos cuando salga')
      : (order.ready_at ? `Recógelo en ${location?.name} a las ${hourOf(order.ready_at)}` : `Recógelo en ${location?.name}`)
    return { template: 'recibido', vars: { 1: order.ref, 2: when, 3: total, 4: trackUrl(order) || `llama al ${contact}` } }
  }
  if (kind === 'listo') {
    return order.mode === 'delivery'
      ? { template: 'reparto', vars: { 1: order.ref, 2: order.eta_at ? `Llega hacia las ${hourOf(order.eta_at)}` : 'Llega en unos minutos' } }
      : { template: 'listo', vars: { 1: order.ref, 2: location?.name || order.location_name } }
  }
  if (kind === 'cancelado') return { template: 'cancelado', vars: { 1: order.ref, 2: contact } }
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

  if (twilioConfigured()) return sendTwilio(to, text, at)

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

async function sendTwilio(to, text, at) {
  const sid = process.env.TWILIO_ACCOUNT_SID
  try {
    const auth = Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${auth}` },
      body: new URLSearchParams({ To: to, From: process.env.TWILIO_FROM, Body: text }),
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      /* El motivo exacto de Twilio (número sin verificar en la prueba, país no permitido…) */
      return { ok: false, at, error: `twilio ${data.code || res.status}: ${String(data.message || '').slice(0, 120)}` }
    }
    return { ok: true, at }
  } catch (err) {
    return { ok: false, at, error: err?.name === 'TimeoutError' ? 'twilio no responde' : 'sin conexion con twilio' }
  }
}

/* Dirección pública de la web, para que Twilio avise de cómo acabó cada WhatsApp. */
const siteBase = () => {
  const base = process.env.SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '')
  return String(base).replace(/\/+$/, '')
}

/**
 * Manda un WhatsApp con plantilla. Que Twilio lo acepte no quiere decir
 * que llegue: si el cliente no tiene WhatsApp, Twilio avisa después a
 * `callback` (ver whatsappStatus) y entonces sale el SMS de reserva.
 */
async function sendWhatsApp(phone, templateSid, vars, callback) {
  const at = new Date().toISOString()
  const to = mobileNumber(phone)
  if (!to) return { ok: false, at, skipped: 'no-es-movil' }
  const sid = process.env.TWILIO_ACCOUNT_SID
  const params = new URLSearchParams({
    To: `whatsapp:${to}`,
    From: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM.replace(/^whatsapp:/, '')}`,
    ContentSid: templateSid,
    ContentVariables: JSON.stringify(vars),
  })
  if (callback && siteBase()) params.set('StatusCallback', `${siteBase()}/api/push?${new URLSearchParams({ twilio: 'status', ...callback })}`)
  try {
    const auth = Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${auth}` },
      body: params,
      signal: AbortSignal.timeout(5000),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, at, via: 'whatsapp', error: `whatsapp ${data.code || res.status}: ${String(data.message || '').slice(0, 120)}` }
    return { ok: true, at, via: 'whatsapp', sid: data.sid }
  } catch (err) {
    return { ok: false, at, via: 'whatsapp', error: err?.name === 'TimeoutError' ? 'twilio no responde' : 'sin conexion con twilio' }
  }
}

/** WhatsApp primero (si hay plantilla); si no se puede, SMS. */
async function sendAviso(phone, wa, text, callback) {
  const templateSid = wa && waTemplate(wa.template)
  let first = null
  if (templateSid) {
    first = await sendWhatsApp(phone, templateSid, wa.vars, callback)
    if (first.ok || first.skipped) return first
  }
  if (!text || !smsConfigured()) return first || { ok: false, at: new Date().toISOString(), skipped: 'sms-no-configurado' }
  const sms = await sendSms(phone, text)
  return sms.ok || !first ? { ...sms, via: 'sms' } : { ...sms, via: 'sms', error: `${first.error}; sms: ${sms.error || sms.skipped}` }
}

/** Código de entrada al Club Nonno, por WhatsApp o SMS. */
export const sendLoginCode = (phone, code, minutes) =>
  sendAviso(phone, { template: 'codigo', vars: { 1: code } },
    `La Pizza de Nonno: tu codigo es ${code}. Caduca en ${minutes} min. No se lo digas a nadie.`)

/** Aviso de prueba desde el panel: el de "listo" con un pedido de mentira. */
export const sendTestAviso = (phone) =>
  sendAviso(phone, { template: 'listo', vars: { 1: '00', 2: '(esto es un mensaje de prueba)' } },
    'La Pizza de Nonno: SMS de prueba. Si lo lees, los avisos a clientes funcionan.')

/**
 * Manda un aviso una sola vez por pedido y lo apunta en `sms`
 * ({ recibido: {ok, at, via, ...}, listo: ..., cancelado: ... }).
 * @param {object} db   cliente de Supabase
 * @returns {Promise<object|null>} el registro actualizado, o null si no se envió nada
 */
export async function notifyCustomer(db, order, kind) {
  if (order.sms?.[kind]?.ok) return null
  /* En el mostrador el cliente está delante: solo se avisa de "listo". */
  if (kind === 'recibido' && order.channel === 'mostrador') return null
  const text = smsText(kind, order)
  if (!text || !order.customer_phone) return null

  const result = await sendAviso(order.customer_phone, waMessage(kind, order), text, { order: order.id, kind })
  if (result.skipped === 'sms-no-configurado') return null
  const sms = { ...(order.sms || {}), [kind]: result }
  const { error } = await db.from('orders').update({ sms }).eq('id', order.id)
  if (error) console.error('Error apuntando el SMS:', error)
  return sms
}

/** ¿La petición viene de verdad de Twilio? (cabecera X-Twilio-Signature) */
export function validTwilioSignature(url, params, signature, token = process.env.TWILIO_AUTH_TOKEN) {
  if (!token || !signature) return false
  const data = Object.keys(params || {}).sort().reduce((s, k) => s + k + params[k], url)
  const expected = Buffer.from(createHmac('sha1', token).update(data).digest('base64'))
  const given = Buffer.from(String(signature))
  return expected.length === given.length && timingSafeEqual(expected, given)
}

/**
 * Twilio avisa de cómo acabó cada WhatsApp. Si no llegó (el cliente no
 * tiene WhatsApp, bloqueó al negocio…), sale el SMS de reserva y se
 * apunta en el pedido; si tampoco hay SMS, el panel avisa para llamar.
 */
export async function whatsappStatus(db, req, res) {
  const url = `${siteBase()}${req.url}`
  if (!validTwilioSignature(url, req.body, req.headers?.['x-twilio-signature'])) return res.status(403).end()

  const { MessageStatus: status, MessageSid: messageSid, ErrorCode: code } = req.body || {}
  const { order: id, kind } = req.query || {}
  if (!['failed', 'undelivered'].includes(status) || !id || !['recibido', 'listo', 'cancelado'].includes(kind)) {
    return res.status(200).end()
  }

  const { data: order } = await db.from('orders').select('*').eq('id', id).maybeSingle()
  /* Solo si ese aviso sigue siendo este WhatsApp (no uno ya reintentado) */
  if (!order || order.sms?.[kind]?.sid !== messageSid) return res.status(200).end()

  const error = `whatsapp no entregado${code ? ` (${code})` : ''}`
  let result = { ok: false, at: new Date().toISOString(), via: 'whatsapp', error }
  const text = smsText(kind, order)
  if (text && smsConfigured()) {
    const sms = await sendSms(order.customer_phone, text)
    result = sms.ok ? { ...sms, via: 'sms' } : { ...sms, via: 'sms', error: `${error}; sms: ${sms.error || sms.skipped}` }
  }
  const { error: saveError } = await db.from('orders').update({ sms: { ...order.sms, [kind]: result } }).eq('id', id)
  if (saveError) console.error('Error apuntando el WhatsApp:', saveError)
  return res.status(200).end()
}
