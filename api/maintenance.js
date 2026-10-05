import { db, isConfigured } from './_lib/supabase.js'
import { requireSession, SCOPE_ALL } from './_lib/auth.js'
import { getLocation } from '../src/data/locations.js'

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/
const clean = (value, max) => String(value ?? '').trim().slice(0, max)
const missingTable = (error) => ['42P01', 'PGRST205'].includes(error?.code)
const validDate = (value) => {
  const day = clean(value, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false
  const date = new Date(`${day}T12:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === day
}

function nextMonth(month) {
  const [year, number] = month.split('-').map(Number)
  return number === 12 ? `${year + 1}-01` : `${year}-${String(number + 1).padStart(2, '0')}`
}

export default async function handler(req, res) {
  if (!isConfigured()) return res.status(503).json({ error: 'El sistema todavía no está conectado a la base de datos.' })
  const session = requireSession(req, res)
  if (!session) return

  const locationId = clean(req.method === 'GET' ? req.query?.location : req.body?.location, 40)
  if (!getLocation(locationId)) return res.status(400).json({ error: 'Sede no válida.' })
  if (session.scope !== SCOPE_ALL && session.scope !== locationId) {
    return res.status(403).json({ error: 'No puedes gestionar el mantenimiento de otra sede.' })
  }

  try {
    if (req.method === 'GET') {
      const month = MONTH.test(req.query?.month || '') ? req.query.month : new Date().toISOString().slice(0, 7)
      const { data, error } = await db().from('maintenance_records').select('*')
        .eq('location_id', locationId)
        .gte('maintenance_date', `${month}-01`)
        .lt('maintenance_date', `${nextMonth(month)}-01`)
        .order('maintenance_date', { ascending: true }).order('created_at', { ascending: true })
      if (error) throw error
      return res.status(200).json({ month, records: data })
    }

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST')
      return res.status(405).json({ error: 'Método no permitido.' })
    }

    const body = req.body || {}
    if (body.action !== 'save') return res.status(400).json({ error: 'Acción no válida.' })
    const maintenanceDate = clean(body.maintenanceDate, 10)
    const responsible = clean(body.responsible, 120)
    const tasks = clean(body.tasks, 4000)
    const incident = clean(body.incident, 2000)
    if (!validDate(maintenanceDate)) return res.status(400).json({ error: 'Indica una fecha válida.' })
    if (!responsible) return res.status(400).json({ error: 'Indica quién se encarga.' })
    if (!tasks) return res.status(400).json({ error: 'Describe las tareas previstas o realizadas.' })

    const record = {
      location_id: locationId,
      maintenance_date: maintenanceDate,
      responsible,
      tasks,
      incident,
      completed_at: body.completed ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }
    let result
    if (body.id) {
      result = await db().from('maintenance_records').update(record)
        .eq('id', clean(body.id, 50)).eq('location_id', locationId).select('*').maybeSingle()
      if (!result.error && !result.data) return res.status(404).json({ error: 'No encontramos ese registro de mantenimiento.' })
    } else {
      result = await db().from('maintenance_records').insert(record).select('*').single()
    }
    if (result.error) throw result.error
    return res.status(200).json({ record: result.data })
  } catch (error) {
    console.error('Error en /api/maintenance:', error)
    if (missingTable(error)) return res.status(503).json({ error: 'Falta activar el registro de mantenimiento: ejecuta supabase/mantenimiento.sql en Supabase.' })
    return res.status(500).json({ error: 'No hemos podido guardar el mantenimiento.' })
  }
}
