import { db, isConfigured } from './supabase.js'

/* ═══════════════════════════════════════════════════════════════
   Límite de intentos (login, códigos por SMS, pedidos públicos).

   La cuenta se lleva en Supabase (supabase/seguridad.sql, función
   auth_take) para que valga entre todas las instancias del servidor
   y sea atómica. Si esa función todavía no existe, se usa una cuenta
   en memoria: más floja (cada instancia cuenta lo suyo) pero nunca
   deja la puerta abierta del todo.
   ═══════════════════════════════════════════════════════════════ */

const memory = new Map()

function takeInMemory(key, { max, window, lock }) {
  const now = Date.now()
  let row = memory.get(key)
  if (!row || (row.lockedUntil <= now && now - row.start > window * 1000)) {
    row = { hits: 0, start: now, lockedUntil: 0 }
  }
  row.hits += 1
  if (row.lockedUntil > now) {
    memory.set(key, row)
    return Math.ceil((row.lockedUntil - now) / 1000)
  }
  if (row.hits > max) {
    row.lockedUntil = now + lock * 1000
    row.hits = 0
    row.start = now
    memory.set(key, row)
    return lock
  }
  memory.set(key, row)
  if (memory.size > 5000) for (const [k, v] of memory) if (v.lockedUntil <= now && now - v.start > 3600_000) memory.delete(k)
  return 0
}

/**
 * Cuenta un intento.
 * @param {string} key
 * @param {{max:number, window:number, lock:number}} rule  intentos, ventana (s), bloqueo (s)
 * @returns {Promise<number>} 0 si puede seguir, o segundos de bloqueo
 */
export async function take(key, rule) {
  if (isConfigured()) {
    const { data, error } = await db().rpc('auth_take', {
      p_key: key, p_max: rule.max, p_window: rule.window, p_lock: rule.lock,
    })
    if (!error && Number.isFinite(data)) return data
  }
  return takeInMemory(key, rule)
}

/** Login correcto: se borra el contador de esa clave. */
export async function clear(key) {
  memory.delete(key)
  if (!isConfigured()) return
  await db().rpc('auth_clear', { p_key: key }).then(() => {}, () => {})
}

/** IP del cliente tal y como la pone Vercel. */
export function clientIp(req) {
  const h = req.headers || {}
  const raw = h['x-real-ip'] || String(h['x-forwarded-for'] || '').split(',')[0] || req.socket?.remoteAddress || 'desconocida'
  return String(raw).trim().slice(0, 64)
}

/** Corta con 429 si alguna regla está bloqueada. Cuenta todas las reglas. */
export async function guard(res, rules) {
  let worst = 0
  for (const [key, rule] of rules) worst = Math.max(worst, await take(key, rule))
  if (worst > 0) {
    res.setHeader('Retry-After', String(worst))
    return worst
  }
  return 0
}

export const minutes = (s) => Math.max(1, Math.ceil(s / 60))
