import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto'

/* ═══════════════════════════════════════════════════════════════
   Sesión del panel de cocina.

   Una sola contraseña compartida (ADMIN_PASSWORD), suficiente para
   un equipo pequeño en un local. La cookie va firmada, es httpOnly
   y caduca a los 30 días, así que el ordenador del local no tiene
   que volver a entrar cada mañana.
   ═══════════════════════════════════════════════════════════════ */

const COOKIE = 'nonno_panel'
const MAX_AGE = 60 * 60 * 24 * 30 // 30 días

const secret = () =>
  process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || ''

const sign = (value) =>
  createHmac('sha256', secret()).update(value).digest('base64url')

/** Compara sin filtrar información por el tiempo de respuesta. */
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a))
  const bufB = Buffer.from(String(b))
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

export function checkPassword(password) {
  const expected = process.env.ADMIN_PASSWORD
  if (!expected) return false
  return safeEqual(password || '', expected)
}

export function createSessionCookie() {
  const issued = `${Date.now()}.${randomBytes(8).toString('hex')}`
  const token = `${issued}.${sign(issued)}`
  return [
    `${COOKIE}=${token}`,
    'HttpOnly',
    'Secure',
    'SameSite=Strict',
    'Path=/',
    `Max-Age=${MAX_AGE}`,
  ].join('; ')
}

export const clearSessionCookie = () =>
  `${COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`

/** ¿Trae la petición una sesión de panel válida y no caducada? */
export function hasSession(req) {
  if (!secret()) return false

  const raw = req.headers?.cookie || ''
  const match = raw.split(';').map((c) => c.trim()).find((c) => c.startsWith(`${COOKIE}=`))
  if (!match) return false

  const token = match.slice(COOKIE.length + 1)
  const cut = token.lastIndexOf('.')
  if (cut < 0) return false

  const issued = token.slice(0, cut)
  const signature = token.slice(cut + 1)
  if (!safeEqual(signature, sign(issued))) return false

  const at = Number(issued.split('.')[0])
  if (!at || Date.now() - at > MAX_AGE * 1000) return false

  return true
}

/** Corta la petición con 401 si no hay sesión. Devuelve true si cortó. */
export function requireSession(req, res) {
  if (hasSession(req)) return false
  res.status(401).json({ error: 'No autorizado' })
  return true
}
