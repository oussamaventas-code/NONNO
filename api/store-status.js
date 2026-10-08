import { isConfigured } from './_lib/supabase.js'
import { requireSession, SCOPE_ALL } from './_lib/auth.js'
import { getStoreStatuses, setStoreOpen, setDoughLimit } from './_lib/store.js'
import menuHandler from './_lib/menuHandler.js'
import superadminHandler from './_lib/superadminHandler.js'

const LOCATION_IDS = ['sangonera', 'santo-angel']

/**
 * GET es público: la web necesita saber si puede dejar pedir antes
 * de que el cliente entre a checkout. PATCH es del panel: cada sede
 * solo puede abrir/cerrar la suya; la dirección puede con las dos.
 * Las masas del día ({ locationId, doughLimit }) solo las pone la dirección.
 *
 * /api/menu (la carta editable) llega aquí con `?resource=menu` por una
 * reescritura de vercel.json. Vive en este mismo fichero de función
 * porque Vercel Hobby admite como máximo 12 y ya estaban las 12.
 */
export default async function handler(req, res) {
  if (req.query?.resource === 'menu') return menuHandler(req, res)
  if (req.query?.resource === 'superadmin') return superadminHandler(req, res)

  if (!isConfigured()) {
    return res.status(200).json({
      statuses: Object.fromEntries(LOCATION_IDS.map((id) => [id, { is_open: true }])),
    })
  }

  if (req.method === 'GET') {
    const statuses = await getStoreStatuses()
    return res.status(200).json({ statuses })
  }

  if (req.method === 'PATCH') {
    const session = requireSession(req, res)
    if (!session) return

    const { locationId, isOpen } = req.body || {}
    if (!LOCATION_IDS.includes(locationId)) {
      return res.status(400).json({ error: 'Sede no válida.' })
    }

    if (req.body && 'doughLimit' in req.body) {
      if (session.scope !== SCOPE_ALL) return res.status(403).json({ error: 'Solo la dirección pone las masas del día.' })
      const raw = req.body.doughLimit
      const limit = raw === null || raw === '' ? null : Number(raw)
      if (limit !== null && !(Number.isInteger(limit) && limit >= 0 && limit <= 5000)) {
        return res.status(400).json({ error: 'Escribe un número de masas válido.' })
      }
      try {
        return res.status(200).json({ status: await setDoughLimit(locationId, limit) })
      } catch (err) {
        if (err?.code === '42703' || err?.code === 'PGRST204') {
          return res.status(503).json({ error: 'Falta activar las masas: ejecuta supabase/masas.sql en Supabase.' })
        }
        console.error('Error guardando las masas:', err)
        return res.status(500).json({ error: 'No hemos podido guardar las masas.' })
      }
    }
    if (session.scope !== SCOPE_ALL && session.scope !== locationId) {
      return res.status(403).json({ error: 'No puedes cambiar el estado de otra sede.' })
    }

    const status = await setStoreOpen(locationId, Boolean(isOpen))
    return res.status(200).json({ status })
  }

  res.setHeader('Allow', 'GET, PATCH')
  return res.status(405).json({ error: 'Método no permitido' })
}
