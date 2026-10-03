import { db, isConfigured } from './_lib/supabase.js'
import { sendLoginCode } from './_lib/sms.js'
import { guard, clear, clientIp } from './_lib/limiter.js'
import {
  CODE_TTL_MIN, MAX_ATTEMPTS, RESEND_SECONDS, MAX_SENDS_PER_HOUR,
  normalizePhone, newCode, hashCode, codeMatches, isMissingTable,
  createCustomerCookie, clearCustomerCookie, readCustomerId, readCustomerSession, sessionConfigured, getCustomer,
} from './_lib/customer.js'

/* ═══════════════════════════════════════════════════════════════
   /api/account — Club Nonno

   GET                         → mi cuenta (puntos, movimientos, pedidos)
   POST { action: 'login', phone, name }      → entra solo con el móvil (lo que usa la web)
   POST { action: 'send-code', phone }        → manda el código por SMS (la web lo pide
                                                solo para canjear puntos)
   POST { action: 'verify', phone, code, name } → entra (cookie de sesión)
   POST { action: 'update', name }            → cambia el nombre
   POST { action: 'logout' }                  → sale

   Todo en una función para no pasar del límite de funciones de Vercel.
   ═══════════════════════════════════════════════════════════════ */

/* Sin dirección: se entra solo con el móvil, así que quien sepa un número
   no debe ver dónde vive esa persona. */
const ORDER_FIELDS = [
  'id', 'ref', 'created_at', 'status', 'location_id', 'location_name', 'mode',
  'customer_name', 'items', 'subtotal', 'discount', 'deals', 'delivery_fee',
  'points_redeemed', 'points_discount', 'total', 'payment_status', 'payment_method',
].join(', ')

const publicCustomer = (c) => c && ({ id: c.id, name: c.name || '', phone: c.phone, points: c.points, since: c.created_at })

const inactive = (res) => res.status(503).json({ code: 'club-off', error: 'El Club Nonno todavía no está activo.' })

export default async function handler(req, res) {
  if (!isConfigured() || !sessionConfigured()) return inactive(res)

  try {
    if (req.method === 'GET') return await me(req, res)
    if (req.method === 'POST') {
      const action = req.body?.action
      if (action === 'login') return await login(req, res)
      if (action === 'send-code') return await sendCode(req, res)
      if (action === 'verify') return await verify(req, res)
      if (action === 'update') return await update(req, res)
      if (action === 'logout') {
        res.setHeader('Set-Cookie', clearCustomerCookie())
        return res.status(200).json({ ok: true })
      }
      return res.status(400).json({ error: 'Acción no válida.' })
    }
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'Método no permitido' })
  } catch (err) {
    if (isMissingTable(err)) return inactive(res)
    console.error('Error en /api/account:', err)
    return res.status(500).json({ error: 'Algo ha fallado. Inténtalo de nuevo.' })
  }
}

/** Mi cuenta: datos, últimos movimientos de puntos y pedidos (para las facturas). */
async function me(req, res) {
  const session = readCustomerSession(req)
  const customer = await getCustomer(session?.id)
  if (!customer) return res.status(200).json({ customer: null })

  const [ledger, orders] = await Promise.all([
    db().from('points_ledger').select('id, delta, reason, note, created_at, order_id')
      .eq('customer_id', customer.id).order('created_at', { ascending: false }).limit(40),
    db().from('orders').select(ORDER_FIELDS)
      .eq('customer_id', customer.id).order('created_at', { ascending: false }).limit(40),
  ])
  if (ledger.error) throw ledger.error
  if (orders.error) throw orders.error

  return res.status(200).json({ customer: { ...publicCustomer(customer), verified: session.verified }, ledger: ledger.data, orders: orders.data })
}

/** Entrar solo con el móvil: sin código. Tope de intentos por conexión
    para que nadie vaya probando números uno tras otro. */
async function login(req, res) {
  const phone = normalizePhone(req.body?.phone)
  if (!phone) return res.status(400).json({ error: 'Escribe un móvil español válido (empieza por 6 o 7).' })

  const blocked = await guard(res, [
    [`login:ip:${clientIp(req)}`, { max: 8, window: 900, lock: 900 }],
  ])
  if (blocked) return res.status(429).json({ error: 'Demasiados intentos. Prueba dentro de un rato.', wait: blocked })

  const name = String(req.body?.name || '').trim().slice(0, 80)
  const { data: existing, error: findError } = await db().from('customers').select('*').eq('phone', phone).maybeSingle()
  if (findError) throw findError

  let customer = existing
  const loginAt = new Date().toISOString()
  if (customer) {
    const patch = { last_login_at: loginAt, ...(name && !customer.name ? { name } : {}) }
    const { data, error } = await db().from('customers').update(patch).eq('id', customer.id).select('*').single()
    if (error) throw error
    customer = data
  } else {
    const { data, error } = await db().from('customers')
      .insert({ phone, name: name || null, last_login_at: loginAt }).select('*').single()
    if (error) throw error
    customer = data
  }

  res.setHeader('Set-Cookie', createCustomerCookie(customer.id))
  return res.status(200).json({ customer: publicCustomer(customer), created: !existing })
}

async function sendCode(req, res) {
  const phone = normalizePhone(req.body?.phone)
  if (!phone) return res.status(400).json({ error: 'Escribe un móvil español válido (empieza por 6 o 7).' })

  /* Cada SMS lo paga el local: tope por IP y tope diario entre todos, para
     que nadie gaste la tarifa probando números uno tras otro. */
  const blocked = await guard(res, [
    [`sms:ip:${clientIp(req)}`, { max: 6, window: 3600, lock: 3600 }],
    ['sms:all', { max: 300, window: 86400, lock: 3600 }],
  ])
  if (blocked) return res.status(429).json({ error: 'Demasiadas peticiones. Prueba dentro de un rato.', wait: blocked })

  const now = Date.now()
  const { data: row, error } = await db().from('customer_codes').select('*').eq('phone', phone).maybeSingle()
  if (error) throw error

  /* Límites: un SMS por minuto y unos pocos por hora a cada móvil */
  if (row) {
    const wait = RESEND_SECONDS - Math.floor((now - Date.parse(row.sent_at)) / 1000)
    if (wait > 0) return res.status(429).json({ error: `Espera ${wait} s para pedir otro código.`, wait })
  }
  const windowOpen = row && now - Date.parse(row.window_start) < 3600_000
  if (windowOpen && row.window_count >= MAX_SENDS_PER_HOUR) {
    return res.status(429).json({ error: 'Has pedido demasiados códigos. Prueba dentro de un rato.' })
  }

  const code = newCode()
  const { error: saveError } = await db().from('customer_codes').upsert({
    phone,
    code_hash: hashCode(phone, code),
    expires_at: new Date(now + CODE_TTL_MIN * 60_000).toISOString(),
    attempts: 0,
    sent_at: new Date(now).toISOString(),
    window_start: windowOpen ? row.window_start : new Date(now).toISOString(),
    window_count: windowOpen ? row.window_count + 1 : 1,
  })
  if (saveError) throw saveError

  /* WhatsApp si hay plantilla de código; si no, SMS. Sin ninguna vía
     configurada: en pruebas se devuelve el código para poder entrar;
     en la web publicada, nunca. */
  const sent = await sendLoginCode(phone, code, CODE_TTL_MIN)
  if (sent.skipped === 'sms-no-configurado') {
    if (process.env.VERCEL_ENV === 'production') {
      return res.status(503).json({ error: 'Ahora mismo no podemos mandar el código. Inténtalo más tarde.' })
    }
    return res.status(200).json({ ok: true, devCode: code })
  }
  if (!sent.ok) return res.status(502).json({ error: 'No hemos podido mandar el código. Inténtalo en un momento.' })
  return res.status(200).json({ ok: true, via: sent.via || 'sms' })
}

async function verify(req, res) {
  const phone = normalizePhone(req.body?.phone)
  const code = String(req.body?.code || '').trim()
  if (!phone || !code) return res.status(400).json({ error: 'Falta el móvil o el código.' })

  /* El intento se cuenta ANTES de comparar y de forma atómica: probar
     muchos códigos a la vez no da más intentos que probarlos uno a uno. */
  const phoneKey = `code:${phone}`
  const blocked = await guard(res, [
    [phoneKey, { max: MAX_ATTEMPTS, window: CODE_TTL_MIN * 60, lock: CODE_TTL_MIN * 60 }],
    [`code:ip:${clientIp(req)}`, { max: 20, window: 900, lock: 900 }],
  ])
  if (blocked) return res.status(429).json({ error: 'Demasiados intentos. Espera un rato y pide un código nuevo.' })

  const { data: row, error } = await db().from('customer_codes').select('*').eq('phone', phone).maybeSingle()
  if (error) throw error
  if (!row || Date.parse(row.expires_at) < Date.now()) {
    return res.status(401).json({ error: 'El código ha caducado. Pide uno nuevo.' })
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    return res.status(429).json({ error: 'Demasiados intentos. Pide un código nuevo.' })
  }
  if (!codeMatches(row, phone, code)) {
    await db().from('customer_codes').update({ attempts: row.attempts + 1 }).eq('phone', phone)
    const left = MAX_ATTEMPTS - row.attempts - 1
    return res.status(401).json({ error: left > 0 ? `Código incorrecto. Te quedan ${left} intentos.` : 'Código incorrecto. Pide uno nuevo.' })
  }

  /* Código bueno: se gasta y se entra (creando la cuenta si es la primera vez) */
  await db().from('customer_codes').delete().eq('phone', phone)
  await clear(phoneKey)
  const name = String(req.body?.name || '').trim().slice(0, 80)
  const { data: existing, error: findError } = await db().from('customers').select('*').eq('phone', phone).maybeSingle()
  if (findError) throw findError

  let customer = existing
  const loginAt = new Date().toISOString()
  if (customer) {
    const patch = { last_login_at: loginAt, ...(name && !customer.name ? { name } : {}) }
    const { data, error: upError } = await db().from('customers').update(patch).eq('id', customer.id).select('*').single()
    if (upError) throw upError
    customer = data
  } else {
    const { data, error: insError } = await db().from('customers')
      .insert({ phone, name: name || null, last_login_at: loginAt }).select('*').single()
    if (insError) throw insError
    customer = data
  }

  res.setHeader('Set-Cookie', createCustomerCookie(customer.id, { verified: true }))
  return res.status(200).json({ customer: publicCustomer(customer), created: !existing })
}

async function update(req, res) {
  const id = readCustomerId(req)
  if (!id) return res.status(401).json({ error: 'Entra con tu móvil primero.' })
  const name = String(req.body?.name || '').trim().slice(0, 80)
  if (!name) return res.status(400).json({ error: 'Escribe tu nombre.' })
  const { data, error } = await db().from('customers').update({ name }).eq('id', id).select('*').maybeSingle()
  if (error) throw error
  if (!data) return res.status(401).json({ error: 'Entra con tu móvil primero.' })
  return res.status(200).json({ customer: publicCustomer(data) })
}
