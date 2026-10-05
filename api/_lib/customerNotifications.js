import { db, isConfigured } from './supabase.js'
import { siteBase } from './mail.js'
import { getLocation } from '../../src/data/locations.js'
import { hourOf } from '../../src/lib/kitchenSlots.js'
import { trackPath, trackToken } from '../../src/lib/tracking.js'
import { mobileNumber } from '../../src/lib/customerLookup.js'

export const CUSTOMER_EVENTS = ['recibido', 'listo', 'reparto', 'cancelado']

const TWILIO_TEMPLATES = {
  recibido: 'TWILIO_WA_RECIBIDO',
  listo: 'TWILIO_WA_LISTO',
  reparto: 'TWILIO_WA_REPARTO',
  cancelado: 'TWILIO_WA_CANCELADO',
}

const hasTwilio = () => Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN)
const hasSmsGateway = () => Boolean(process.env.SMS_GATEWAY_USER && process.env.SMS_GATEWAY_PASSWORD)
const hasTwilioSms = () => Boolean(hasTwilio() && process.env.TWILIO_FROM)

export function customerNotificationConfig() {
  const templates = Object.fromEntries(Object.entries(TWILIO_TEMPLATES).map(([event, env]) => [event, Boolean(process.env[env])]))
  return {
    whatsapp: Boolean(hasTwilio() && process.env.TWILIO_WHATSAPP_FROM && Object.values(templates).some(Boolean)),
    sms: hasSmsGateway() || hasTwilioSms(),
    smsAndroid: hasSmsGateway(),
    smsTwilio: hasTwilioSms(),
    templates,
  }
}

const euro = (value) => `${Number(value || 0).toFixed(2).replace('.', ',')} €`
const locationName = (order) => getLocation(order.location_id)?.name || order.location_name || 'La Pizza de Nonno'
const phoneOf = (order) => mobileNumber(order.customer_phone)
const whatsappAddress = (phone) => `whatsapp:${phone}`
const fromWhatsapp = (from) => String(from || '').startsWith('whatsapp:') ? from : `whatsapp:${from}`

function etaText(order) {
  if (order.mode === 'delivery') return order.eta_at ? `Te lo llevamos hacia las ${hourOf(order.eta_at)}` : 'Te lo llevamos en cuanto salga del horno'
  return order.ready_at ? `Recógelo en ${locationName(order)} a las ${hourOf(order.ready_at)}` : `Recógelo en ${locationName(order)}`
}

function trackingLink(order) {
  const base = siteBase()
  const token = trackToken(order)
  return base && token ? `${base}${trackPath(token)}` : ''
}

function messageFor(order, event) {
  const name = locationName(order)
  if (event === 'recibido') return `Hemos recibido tu pedido ${order.ref} en ${name}. ${etaText(order)}. Total: ${euro(order.total)}.${trackingLink(order) ? ` Sigue tu pedido: ${trackingLink(order)}` : ''}`
  if (event === 'listo') return `Tu pedido ${order.ref} ya está listo para recoger en ${name}. ¡Te esperamos!`
  if (event === 'reparto') return `Tu pedido ${order.ref} ya sale para entrega. ${order.eta_at ? `Te llegará hacia las ${hourOf(order.eta_at)}.` : ''} ¡Que aproveche!`
  if (event === 'cancelado') return `Tu pedido ${order.ref} se ha cancelado. Si tienes cualquier duda, llámanos al ${getLocation(order.location_id)?.phones?.[0] || 'local'}. Disculpa las molestias.`
  throw new Error('Aviso no válido.')
}

function templateVariables(order, event) {
  if (event === 'recibido') return { 1: String(order.ref), 2: etaText(order), 3: euro(order.total), 4: trackingLink(order) || `Llámanos al ${getLocation(order.location_id)?.phones?.[0] || 'local'}` }
  if (event === 'listo') return { 1: String(order.ref), 2: locationName(order) }
  if (event === 'reparto') return { 1: String(order.ref), 2: order.eta_at ? `Te llegará hacia las ${hourOf(order.eta_at)}` : 'Tu pedido va de camino' }
  return { 1: String(order.ref), 2: getLocation(order.location_id)?.phones?.[0] || 'local' }
}

async function twilioSend({ to, from, body, contentSid, contentVariables }) {
  const account = process.env.TWILIO_ACCOUNT_SID
  const auth = Buffer.from(`${account}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')
  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(account)}/Messages.json`
  const form = new URLSearchParams({ To: to, From: from })
  if (contentSid) {
    form.set('ContentSid', contentSid)
    form.set('ContentVariables', JSON.stringify(contentVariables || {}))
  } else form.set('Body', body)
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
    signal: AbortSignal.timeout(10000),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error('Twilio no aceptó el mensaje.')
  return data.sid || null
}

async function sendSmsGateway(phone, body) {
  const credentials = Buffer.from(`${process.env.SMS_GATEWAY_USER}:${process.env.SMS_GATEWAY_PASSWORD}`).toString('base64')
  const response = await fetch('https://api.sms-gate.app/3rdparty/v1/messages?skipPhoneValidation=true', {
    method: 'POST',
    headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneNumbers: [phone], textMessage: { text: body } }),
    signal: AbortSignal.timeout(10000),
  })
  if (!response.ok) throw new Error('El móvil de Nonno no aceptó el SMS.')
  const data = await response.json().catch(() => ({}))
  return data.id || null
}

async function sendSms(phone, body) {
  if (hasSmsGateway()) return { channel: 'sms-android', id: await sendSmsGateway(phone, body) }
  if (hasTwilioSms()) {
    return { channel: 'sms-twilio', id: await twilioSend({ to: phone, from: process.env.TWILIO_FROM, body }) }
  }
  throw new Error('No hay SMS configurado.')
}

async function saveStatus(orderId, event, patch) {
  const { error } = await db().rpc('record_order_sms', {
    p_order_id: orderId,
    p_event: event,
    p_status: patch.status,
    p_channel: patch.channel || null,
    p_error: patch.error || null,
    p_external_id: patch.externalId || null,
  })
  if (error) throw error
}

/** Claim atómico por evento para que un reintento no mande dos mensajes. */
async function claim(orderId, event) {
  const { data, error } = await db().rpc('claim_order_sms', { p_order_id: orderId, p_event: event })
  if (error) throw error
  return data === true
}

export async function sendCustomerNotification(order, event) {
  if (!isConfigured() || !order?.id || !CUSTOMER_EVENTS.includes(event)) return { status: 'sin_configurar' }
  let claimed = false
  try {
    claimed = await claim(order.id, event)
  } catch (error) {
    console.error('No se pudo reservar el aviso al cliente:', error?.code || 'db-error')
    return { status: 'fallido', error: 'No se pudo registrar el aviso.' }
  }
  if (!claimed) return { status: 'omitido' }

  const phone = phoneOf(order)
  const body = messageFor(order, event)
  if (!phone) {
    const error = 'El pedido no tiene un móvil válido para avisar.'
    await saveStatus(order.id, event, { status: 'sin_configurar', error }).catch(() => {})
    return { status: 'sin_configurar', error }
  }

  const config = customerNotificationConfig()
  let channel = null
  let externalId = null
  let whatsappError = null
  const templateSid = process.env[TWILIO_TEMPLATES[event]]
  if (config.whatsapp && templateSid) {
    try {
      externalId = await twilioSend({
        to: whatsappAddress(phone),
        from: fromWhatsapp(process.env.TWILIO_WHATSAPP_FROM),
        contentSid: templateSid,
        contentVariables: templateVariables(order, event),
      })
      channel = 'whatsapp'
    } catch {
      whatsappError = 'WhatsApp no aceptó el aviso.'
    }
  }

  if (!channel && config.sms) {
    try {
      const sent = await sendSms(phone, body)
      channel = sent.channel
      externalId = sent.id
    } catch (error) {
      await saveStatus(order.id, event, {
        status: 'fallido',
        error: whatsappError ? `${whatsappError} Tampoco se pudo enviar por SMS.` : (error.message || 'No se pudo enviar el SMS.'),
      }).catch(() => {})
      return { status: 'fallido' }
    }
  }

  if (!channel) {
    const error = whatsappError || 'Configura SMS Gateway o Twilio en las variables protegidas.'
    await saveStatus(order.id, event, { status: 'sin_configurar', error }).catch(() => {})
    return { status: 'sin_configurar', error }
  }

  try {
    await saveStatus(order.id, event, { status: 'enviado', channel, externalId })
    return { status: 'enviado', channel }
  } catch (error) {
    /* El proveedor ya aceptó el mensaje. No se repite aquí para evitar duplicarlo. */
    console.error('No se pudo guardar el estado del aviso al cliente:', error?.code || 'db-error')
    return { status: 'enviado', channel }
  }
}

export async function sendTestSms(phone) {
  const normalized = mobileNumber(phone)
  if (!normalized) throw new Error('Escribe un móvil español válido.')
  if (!customerNotificationConfig().sms) throw new Error('Configura SMS Gateway o Twilio antes de enviar la prueba.')
  return sendSms(normalized, 'Prueba de avisos de La Pizza de Nonno. Si recibes este mensaje, el envío de SMS funciona.')
}

export async function notificationDatabaseReady() {
  if (!isConfigured()) return false
  const { error } = await db().rpc('claim_order_sms', {
    p_order_id: '00000000-0000-0000-0000-000000000000',
    p_event: 'recibido',
  })
  return !error
}
