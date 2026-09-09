import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto'

/* ═══════════════════════════════════════════════════════════════
   Sesión del panel de cocina.

   Cada sede tiene su propia contraseña y solo ve sus pedidos. El
   ámbito viaja firmado dentro de la cookie, así que un trabajador
   de una sede no puede ver la otra ni manipulando la petición.

   ADMIN_PASSWORD_SANGONERA    → solo Sangonera la Verde
   ADMIN_PASSWORD_SANTO_ANGEL  → solo Santo Ángel
   ADMIN_PASSWORD              → las dos (dirección)

   La cookie es httpOnly y dura 30 días: el ordenador del local no
   tiene que volver a entrar cada mañana.
   ═══════════════════════════════════════════════════════════════ */

const COOKIE = 'nonno_panel'
const MAX_AGE = 60 * 60 * 24 * 30 // 30 días

/** 'all' ve todo; si no, el id de la sede que puede ver. */
export const SCOPE_ALL = 'all'

const PASSWORDS = [
  { env: 'ADMIN_PASSWORD_SANGONERA', scope: 'sangonera' },
  { env: 'ADMIN_PASSWORD_SANTO_ANGEL', scope: 'santo-angel' },
  { env: 'ADMIN_PASSWORD', scope: SCOPE_ALL },
]

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

/** ¿Hay alguna contraseña configurada? */
export const isConfigured = () => PASSWORDS.some(({ env }) => process.env[env])

/**
 * Comprueba la contraseña contra todas las configuradas.
 * @returns {string|null} el ámbito que abre, o null si no vale.
 */
export function scopeForPassword(password) {
  if (!password) return null
  /* Se recorren todas sin cortar al primer acierto para no revelar
     por el tiempo de respuesta cuál de ellas coincidió. */
  let found = null
  for (const { env, scope } of PASSWORDS) {
    const expected = process.env[env]
    if (expected && safeEqual(password, expected) && !found) found = scope
  }
  return found
}

export function createSessionCookie(scope) {
  const issued = `${Date.now()}.${randomBytes(8).toString('hex')}`
  const body = `${issued}~${scope}`
  const token = `${body}~${sign(body)}`
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

/**
 * Lee la sesión de la petición.
 * @returns {{scope: string}|null} null si no hay sesión válida.
 */
export function readSession(req) {
  if (!secret()) return null

  const raw = req.headers?.cookie || ''
  const match = raw.split(';').map((c) => c.trim()).find((c) => c.startsWith(`${COOKIE}=`))
  if (!match) return null

  const token = match.slice(COOKIE.length + 1)
  const parts = token.split('~')
  if (parts.length !== 3) return null

  const [issued, scope, signature] = parts
  if (!safeEqual(signature, sign(`${issued}~${scope}`))) return null

  const at = Number(issued.split('.')[0])
  if (!at || Date.now() - at > MAX_AGE * 1000) return null

  return { scope }
}

export const hasSession = (req) => readSession(req) !== null

/**
 * Corta la petición con 401 si no hay sesión.
 * @returns {{scope: string}|null} la sesión, o null si ya se respondió.
 */
export function requireSession(req, res) {
  const session = readSession(req)
  if (!session) {
    res.status(401).json({ error: 'No autorizado' })
    return null
  }
  return session
}
