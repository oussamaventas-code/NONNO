import { db, isConfigured } from './supabase.js'

/* ═══════════════════════════════════════════════════════════════
   Límite de intentos (login, contraseñas, pedidos públicos).

   Arquitectura multicapa Zero-Downtime:
   1. Upstash Redis REST API (Serverless nativo, global e instantáneo)
      si UPSTASH_REDIS_REST_URL y UPSTASH_REDIS_REST_TOKEN están configuradas.
   2. Supabase RPC 'auth_take' (atómico en PostgreSQL / base de datos)
   3. Memoria local segura (fallback por instancia si no hay red externa)
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

async function takeFromUpstash(key, { max, window, lock }) {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null

  try {
    const cleanUrl = url.replace(/\/+$/, '')
    const lockKey = `lock:${key}`

    // 1. Comprobar si está bloqueado
    const checkRes = await fetch(`${cleanUrl}/get/${encodeURIComponent(lockKey)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const checkData = await checkRes.json().catch(() => ({}))
    if (checkData.result !== null && checkData.result !== undefined) {
      const ttlRes = await fetch(`${cleanUrl}/ttl/${encodeURIComponent(lockKey)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const ttlData = await ttlRes.json().catch(() => ({}))
      const ttl = Number(ttlData.result)
      return ttl > 0 ? ttl : lock
    }

    // 2. Incrementar intentos dentro de la ventana deslizante
    const countKey = `ratelimit:${key}`
    const pipeline = [
      ['INCR', countKey],
      ['EXPIRE', countKey, window],
    ]
    const pipeRes = await fetch(`${cleanUrl}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(pipeline),
    })
    const pipeData = await pipeRes.json().catch(() => ([]))
    const currentHits = Number(pipeData?.[0]?.result || 1)

    // 3. Superado el máximo -> activar bloqueo
    if (currentHits > max) {
      await fetch(`${cleanUrl}/set/${encodeURIComponent(lockKey)}/1/ex/${lock}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      return lock
    }
    return 0
  } catch (err) {
    console.error('Upstash rate limit fallback error:', err)
    return null
  }
}

/**
 * Cuenta un intento.
 * Prioridad 1: Upstash Redis REST
 * Prioridad 2: Supabase RPC 'auth_take'
 * Prioridad 3: In-Memory Map
 * @param {string} key
 * @param {{max:number, window:number, lock:number}} rule  intentos, ventana (s), bloqueo (s)
 * @returns {Promise<number>} 0 si puede seguir, o segundos de bloqueo
 */
export async function take(key, rule) {
  // Nivel 1: Upstash Redis
  const upstashBlock = await takeFromUpstash(key, rule)
  if (upstashBlock !== null) return upstashBlock

  // Nivel 2: Supabase RPC
  if (isConfigured()) {
    const { data, error } = await db().rpc('auth_take', {
      p_key: key, p_max: rule.max, p_window: rule.window, p_lock: rule.lock,
    })
    if (!error && Number.isFinite(data)) return data
  }

  // Nivel 3: Memoria local
  return takeInMemory(key, rule)
}

/** Login correcto: se borra el contador de esa clave. */
export async function clear(key) {
  memory.delete(key)
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (url && token) {
    const cleanUrl = url.replace(/\/+$/, '')
    fetch(`${cleanUrl}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([
        ['DEL', `ratelimit:${key}`],
        ['DEL', `lock:${key}`],
      ]),
    }).catch(() => {})
  }
  if (!isConfigured()) return
  await db().rpc('auth_clear', { p_key: key }).then(() => {}, () => {})
}

/** IP del cliente tal y como la pone Vercel / Netlify. */
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
