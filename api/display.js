import { db, isConfigured } from './_lib/supabase.js'
import { requireSession, SCOPE_ALL } from './_lib/auth.js'
import { getLocation } from '../src/data/locations.js'
import printHandler from './_lib/printJobs.js'

/**
 * GET /api/display?location=sangonera
 * Datos para la pantalla del local (TV): solo pedidos PARA RECOGER que
 * están en preparación o listos. Lo justo para que el cliente se
 * reconozca: número y nombre abreviado. Nunca teléfono ni dirección.
 *
 * /api/print (Nonno Impresora) llega aquí con ?resource=print por una
 * reescritura de vercel.json, para no gastar otra función.
 */
export default async function handler(req, res) {
  if (req.query?.resource === 'print') return printHandler(req, res)
  if (!isConfigured()) {
    return res.status(503).json({ error: 'El sistema todavía no está conectado a la base de datos.' })
  }
  const session = requireSession(req, res)
  if (!session) return

  const locationId = session.scope === SCOPE_ALL ? String(req.query?.location || '') : session.scope
  if (!getLocation(locationId)) return res.status(400).json({ error: 'Sede no válida.' })

  const since = new Date(Date.now() - 12 * 3600 * 1000).toISOString()
  const { data, error } = await db()
    .from('orders')
    .select('id, ref, customer_name, status, ready_at, created_at')
    .eq('location_id', locationId)
    .eq('mode', 'pickup')
    .in('status', ['nuevo', 'horno', 'listo'])
    .gte('created_at', since)
    .order('ready_at', { ascending: true, nullsFirst: false })
    .limit(60)

  if (error) {
    console.error('Error leyendo la pantalla:', error)
    return res.status(500).json({ error: 'No hemos podido cargar los pedidos.' })
  }

  /* En el local nadie marca LISTO (la cocina trabaja con la comanda en
     papel): un pedido se da por listo al llegar su hora. */
  const now = Date.now()
  const isReady = (o) => o.status === 'listo' || (o.ready_at && Date.parse(o.ready_at) <= now)

  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).json({
    location: getLocation(locationId).name,
    orders: data.map((o) => ({
      id: o.id,
      ref: o.ref,
      name: shortName(o.customer_name),
      status: isReady(o) ? 'listo' : 'preparando',
      readyAt: o.ready_at,
    })),
  })
}

/** "Antonio García López" → "Antonio G." */
function shortName(full) {
  const [first = '', second = ''] = String(full || '').trim().split(/\s+/)
  return second ? `${first} ${second[0].toUpperCase()}.` : first
}
