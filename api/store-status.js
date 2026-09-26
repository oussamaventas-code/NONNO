import { isConfigured } from './_lib/supabase.js'
import { requireSession, SCOPE_ALL } from './_lib/auth.js'
import { getStoreStatuses, setStoreOpen } from './_lib/store.js'

const LOCATION_IDS = ['sangonera', 'santo-angel']

/**
 * GET es público: la web necesita saber si puede dejar pedir antes
 * de que el cliente entre a checkout. PATCH es del panel: cada sede
 * solo puede abrir/cerrar la suya; la dirección puede con las dos.
 */
export default async function handler(req, res) {
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
    if (session.scope !== SCOPE_ALL && session.scope !== locationId) {
      return res.status(403).json({ error: 'No puedes cambiar el estado de otra sede.' })
    }

    const status = await setStoreOpen(locationId, Boolean(isOpen))
    return res.status(200).json({ status })
  }

  res.setHeader('Allow', 'GET, PATCH')
  return res.status(405).json({ error: 'Método no permitido' })
}
