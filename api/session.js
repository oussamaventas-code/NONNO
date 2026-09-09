import { checkPassword, createSessionCookie, clearSessionCookie, hasSession } from './_lib/auth.js'

/**
 * Sesión del panel.
 *   GET    → ¿estoy dentro?
 *   POST   → entrar con contraseña
 *   DELETE → salir
 */
export default function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({
      authenticated: hasSession(req),
      configured: Boolean(process.env.ADMIN_PASSWORD),
    })
  }

  if (req.method === 'POST') {
    if (!process.env.ADMIN_PASSWORD) {
      return res.status(503).json({ error: 'El panel aún no tiene contraseña configurada.' })
    }
    const { password } = req.body || {}
    if (!checkPassword(password)) {
      return res.status(401).json({ error: 'Contraseña incorrecta.' })
    }
    res.setHeader('Set-Cookie', createSessionCookie())
    return res.status(200).json({ authenticated: true })
  }

  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', clearSessionCookie())
    return res.status(200).json({ authenticated: false })
  }

  res.setHeader('Allow', 'GET, POST, DELETE')
  return res.status(405).json({ error: 'Método no permitido' })
}
