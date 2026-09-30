import {
  scopeForPassword, createSessionCookie, clearSessionCookie,
  readSession, isConfigured, SCOPE_ALL,
} from './_lib/auth.js'

/**
 * Sesión del panel.
 *   GET    → ¿estoy dentro y qué sede puedo ver?
 *   POST   → entrar con contraseña
 *   DELETE → salir
 */
import { guard, clear, clientIp, minutes } from './_lib/limiter.js'

/* Intentos de contraseña: 5 por IP cada 15 min (luego 15 min de bloqueo)
   y 40 entre todas las IP, para que cambiar de IP no sirva de nada. */
const PER_IP = { max: 5, window: 900, lock: 900 }
const GLOBAL = { max: 40, window: 900, lock: 300 }

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const session = readSession(req)
    return res.status(200).json({
      authenticated: Boolean(session),
      scope: session?.scope || null,
      configured: isConfigured(),
    })
  }

  if (req.method === 'POST') {
    if (!isConfigured()) {
      return res.status(503).json({ error: 'El panel aún no tiene contraseña configurada.' })
    }

    /* El intento se cuenta ANTES de mirar la contraseña: así, mandar mil
       peticiones a la vez no da mil intentos. */
    const ipKey = `panel:ip:${clientIp(req)}`
    const locked = await guard(res, [[ipKey, PER_IP], ['panel:all', GLOBAL]])
    if (locked) {
      return res.status(429).json({
        error: `Demasiados intentos. Espera ${minutes(locked)} min antes de volver a probar.`,
        retryAfter: locked,
      })
    }

    const scope = scopeForPassword(req.body?.password)
    if (!scope) {
      /* Pequeña espera: frena a quien prueba contraseñas a mano */
      await new Promise((r) => setTimeout(r, 600))
      return res.status(401).json({ error: 'Contraseña incorrecta.' })
    }

    await clear(ipKey)
    res.setHeader('Set-Cookie', createSessionCookie(scope))
    return res.status(200).json({ authenticated: true, scope })
  }

  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', clearSessionCookie())
    return res.status(200).json({ authenticated: false })
  }

  res.setHeader('Allow', 'GET, POST, DELETE')
  return res.status(405).json({ error: 'Método no permitido' })
}

export { SCOPE_ALL }
