import { db, isConfigured } from './_lib/supabase.js'
import { guard, clear, clientIp } from './_lib/limiter.js'
import { sendMail, resetMail, siteBase, isEmail, mailConfigured } from './_lib/mail.js'
import {
  RESET_TTL_MIN, MIN_PASSWORD,
  normalizePhone, normalizeEmail, isMissingTable, hashPassword, passwordMatches, newResetToken, hashToken,
  createCustomerCookie, clearCustomerCookie, readCustomerId, sessionConfigured, getCustomer,
} from './_lib/customer.js'

/* ═══════════════════════════════════════════════════════════════
   /api/account — Club Nonno (cuentas con correo y contraseña)

   GET                                                   → mi cuenta (puntos, movimientos, pedidos)
   POST { action: 'register', email, password, name, phone, marketing }
   POST { action: 'login', email, password }
   POST { action: 'forgot', email }                      → correo con enlace para cambiarla
   POST { action: 'reset', token, password }             → contraseña nueva (y dentro)
   POST { action: 'update', name?, phone?, marketing? }
   POST { action: 'logout' }

   Todo en una función para no pasar del límite de funciones de Vercel.
   ═══════════════════════════════════════════════════════════════ */

const ORDER_FIELDS = [
  'id', 'ref', 'created_at', 'status', 'location_id', 'location_name', 'mode',
  'customer_name', 'items', 'subtotal', 'discount', 'deals', 'delivery_fee',
  'points_redeemed', 'points_discount', 'total', 'payment_status', 'payment_method',
].join(', ')

const publicCustomer = (c) => c && ({
  id: c.id, name: c.name || '', email: c.email || '', phone: c.phone, points: c.points,
  marketing: Boolean(c.marketing_ok), since: c.created_at,
})

const inactive = (res) => res.status(503).json({ code: 'club-off', error: 'El Club Nonno todavía no está activo.' })

export default async function handler(req, res) {
  if (!isConfigured() || !sessionConfigured()) return inactive(res)

  try {
    if (req.method === 'GET') return await me(req, res)
    if (req.method === 'POST') {
      const action = req.body?.action
      if (action === 'register') return await register(req, res)
      if (action === 'login') return await login(req, res)
      if (action === 'forgot') return await forgot(req, res)
      if (action === 'reset') return await reset(req, res)
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
  const customer = await getCustomer(readCustomerId(req))
  if (!customer) return res.status(200).json({ customer: null })

  const [ledger, orders] = await Promise.all([
    db().from('points_ledger').select('id, delta, reason, note, created_at, order_id')
      .eq('customer_id', customer.id).order('created_at', { ascending: false }).limit(40),
    db().from('orders').select(ORDER_FIELDS)
      .eq('customer_id', customer.id).order('created_at', { ascending: false }).limit(40),
  ])
  if (ledger.error) throw ledger.error
  if (orders.error) throw orders.error

  return res.status(200).json({ customer: publicCustomer(customer), ledger: ledger.data, orders: orders.data })
}

const signedIn = (res, customer, extra = {}) => {
  res.setHeader('Set-Cookie', createCustomerCookie(customer.id))
  return res.status(200).json({ customer: publicCustomer(customer), ...extra })
}

async function register(req, res) {
  const blocked = await guard(res, [[`register:ip:${clientIp(req)}`, { max: 6, window: 3600, lock: 3600 }]])
  if (blocked) return res.status(429).json({ error: 'Demasiados intentos. Prueba dentro de un rato.' })

  const email = normalizeEmail(req.body?.email)
  const password = String(req.body?.password || '')
  const name = String(req.body?.name || '').trim().slice(0, 80)
  const phone = normalizePhone(req.body?.phone)
  const marketing = req.body?.marketing === true

  if (!isEmail(email)) return res.status(400).json({ field: 'email', error: 'Escribe un correo válido.' })
  if (password.length < MIN_PASSWORD) return res.status(400).json({ field: 'password', error: `La contraseña necesita al menos ${MIN_PASSWORD} caracteres.` })
  if (!name) return res.status(400).json({ field: 'name', error: 'Escribe tu nombre.' })
  if (!phone) return res.status(400).json({ field: 'phone', error: 'Escribe un móvil español (empieza por 6 o 7).' })

  const { data: byEmail, error: emailError } = await db().from('customers').select('id').eq('email', email).maybeSingle()
  if (emailError) throw emailError
  if (byEmail) return res.status(409).json({ field: 'email', error: 'Ya hay una cuenta con ese correo. Entra con tu contraseña.' })

  const fields = {
    email, name, password_hash: await hashPassword(password),
    marketing_ok: marketing, marketing_at: marketing ? new Date().toISOString() : null,
    last_login_at: new Date().toISOString(),
  }

  /* El móvil ya estaba en el club (cuentas de antes, solo con el móvil):
     se le pone correo y contraseña y conserva sus puntos. Si ya tiene
     correo, es de otra persona o de otra cuenta suya. */
  const { data: byPhone, error: phoneError } = await db().from('customers').select('*').eq('phone', phone).maybeSingle()
  if (phoneError) throw phoneError
  if (byPhone?.email) return res.status(409).json({ field: 'phone', error: 'Ese móvil ya tiene una cuenta con otro correo. Entra con ese correo.' })

  const { data: customer, error } = byPhone
    ? await db().from('customers').update(fields).eq('id', byPhone.id).select('*').single()
    : await db().from('customers').insert({ phone, ...fields }).select('*').single()
  if (error) throw error
  return signedIn(res, customer, { created: true })
}

async function login(req, res) {
  const email = normalizeEmail(req.body?.email)
  const password = String(req.body?.password || '')
  if (!email || !password) return res.status(400).json({ error: 'Escribe tu correo y tu contraseña.' })

  /* Tope por conexión y por cuenta: nadie puede ir probando contraseñas */
  const accountKey = `login:mail:${email}`
  const blocked = await guard(res, [
    [`login:ip:${clientIp(req)}`, { max: 15, window: 900, lock: 900 }],
    [accountKey, { max: 8, window: 900, lock: 900 }],
  ])
  if (blocked) return res.status(429).json({ error: 'Demasiados intentos. Prueba dentro de un rato o cambia la contraseña.' })

  const { data: customer, error } = await db().from('customers').select('*').eq('email', email).maybeSingle()
  if (error) throw error
  if (!customer || !(await passwordMatches(password, customer.password_hash))) {
    return res.status(401).json({ error: 'Correo o contraseña incorrectos.' })
  }
  await clear(accountKey)
  const { data: updated } = await db().from('customers').update({ last_login_at: new Date().toISOString() }).eq('id', customer.id).select('*').single()
  return signedIn(res, updated || customer)
}

/** Siempre responde lo mismo: así no se puede averiguar qué correos tienen cuenta. */
async function forgot(req, res) {
  const blocked = await guard(res, [[`forgot:ip:${clientIp(req)}`, { max: 5, window: 3600, lock: 3600 }]])
  if (blocked) return res.status(429).json({ error: 'Demasiadas peticiones. Prueba dentro de un rato.' })
  if (!mailConfigured()) return res.status(503).json({ error: 'Ahora mismo no podemos mandar correos. Llama a la tienda.' })

  const email = normalizeEmail(req.body?.email)
  const done = () => res.status(200).json({ ok: true })
  if (!isEmail(email)) return done()

  const { data: customer, error } = await db().from('customers').select('id, email').eq('email', email).maybeSingle()
  if (error) throw error
  if (!customer) return done()

  const token = newResetToken()
  const { error: saveError } = await db().from('customers').update({
    reset_hash: hashToken(token),
    reset_expires: new Date(Date.now() + RESET_TTL_MIN * 60_000).toISOString(),
  }).eq('id', customer.id)
  if (saveError) throw saveError

  const mail = resetMail(`${siteBase()}/cuenta/contrasena?t=${encodeURIComponent(token)}`)
  await sendMail({ to: customer.email, ...mail })
  return done()
}

async function reset(req, res) {
  const token = String(req.body?.token || '')
  const password = String(req.body?.password || '')
  if (password.length < MIN_PASSWORD) return res.status(400).json({ error: `La contraseña necesita al menos ${MIN_PASSWORD} caracteres.` })

  const blocked = await guard(res, [[`reset:ip:${clientIp(req)}`, { max: 10, window: 900, lock: 900 }]])
  if (blocked) return res.status(429).json({ error: 'Demasiados intentos. Prueba dentro de un rato.' })

  const { data: customer, error } = token
    ? await db().from('customers').select('*').eq('reset_hash', hashToken(token)).maybeSingle()
    : { data: null }
  if (error) throw error
  if (!customer || Date.parse(customer.reset_expires) < Date.now()) {
    return res.status(400).json({ error: 'El enlace ha caducado o ya se usó. Pide otro.' })
  }

  const { data: updated, error: upError } = await db().from('customers').update({
    password_hash: await hashPassword(password), reset_hash: null, reset_expires: null,
    last_login_at: new Date().toISOString(),
  }).eq('id', customer.id).select('*').single()
  if (upError) throw upError
  return signedIn(res, updated)
}

async function update(req, res) {
  const id = readCustomerId(req)
  if (!id) return res.status(401).json({ error: 'Entra en tu cuenta primero.' })
  const patch = {}
  if (req.body?.name !== undefined) {
    const name = String(req.body.name || '').trim().slice(0, 80)
    if (!name) return res.status(400).json({ error: 'Escribe tu nombre.' })
    patch.name = name
  }
  if (req.body?.marketing !== undefined) {
    patch.marketing_ok = req.body.marketing === true
    patch.marketing_at = patch.marketing_ok ? new Date().toISOString() : null
  }
  if (!Object.keys(patch).length) return res.status(400).json({ error: 'Nada que cambiar.' })
  const { data, error } = await db().from('customers').update(patch).eq('id', id).select('*').maybeSingle()
  if (error) throw error
  if (!data) return res.status(401).json({ error: 'Entra en tu cuenta primero.' })
  return res.status(200).json({ customer: publicCustomer(data) })
}
