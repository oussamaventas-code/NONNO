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
export default function handler(req, res) {
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

    const scope = scopeForPassword(req.body?.password)
    if (!scope) {
      return res.status(401).json({ error: 'Contraseña incorrecta.' })
    }

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
