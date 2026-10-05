import { createHmac, timingSafeEqual } from 'node:crypto'
import { db, isConfigured } from './supabase.js'
import { readSession, SCOPE_ALL } from './auth.js'
import { take } from './limiter.js'
import { siteBase } from './mail.js'
import { notifyPrinterDown } from './push.js'
import { getLocation } from '../../src/data/locations.js'
import { comandaBytes, receiptBytes, cancelBytes, testBytes } from '../../src/lib/escpos.js'

/* ═══════════════════════════════════════════════════════════════
   NONNO IMPRESORA  ·  /api/print   (vive en api/display.js, ver vercel.json)

   El servidor deja cada papel en la cola (print_jobs) ya convertido a
   ESC/POS, y el programa del local (tienda/nonno-impresora) lo recoge,
   lo manda a la impresora y confirma. Si el ordenador del local estaba
   apagado, al volver imprime lo pendiente. Nadie tiene que tener Chrome
   abierto para que salga el papel.

   Programa del local (cabecera x-nonno-key, una clave por sede):
     POST { action: 'poll', location, printers }  → espera unos segundos y devuelve los papeles pendientes
     POST { action: 'ack', location, results: [{ id, ok, error }] }
   Panel (sesión):
     POST { action: 'job', orderId, kind }        reimprimir comanda / ticket
     POST { action: 'test', location, role }      hoja de prueba
     POST { action: 'takeover', location }        el panel imprime lo pendiente él mismo
     POST { action: 'retry', location }           volver a intentar lo que falló (sin papel…)
     POST { action: 'key', location }             código de instalación del programa del local
   ═══════════════════════════════════════════════════════════════ */

const ONLINE_MS = 45_000 // el programa pregunta sin parar: si calla 45 s, algo pasa
const ALERT_MS = 90_000
const MAX_AGE_MS = 12 * 3600_000
const WAIT_MS = Math.min(25_000, Number(process.env.PRINT_WAIT_MS) || 8_000)
const ROLES = ['cocina', 'mostrador']
const missing = (err) => ['42P01', '42703', 'PGRST204', 'PGRST205'].includes(err?.code)

/** Clave del programa de cada sede (derivada del secreto: no se guarda en ningún sitio). */
export const agentKey = (locationId) =>
  createHmac('sha256', process.env.PRINT_AGENT_SECRET || '').update(`impresora~${locationId}`).digest('base64url')

function agentAllowed(req, locationId) {
  if (!process.env.PRINT_AGENT_SECRET || !getLocation(locationId)) return false
  const given = Buffer.from(String(req.headers['x-nonno-key'] || ''))
  const want = Buffer.from(agentKey(locationId))
  return given.length === want.length && timingSafeEqual(given, want)
}

/** ¿Esta sede tiene el programa instalado? (alguna vez ha dado señal) */
async function agentInstalled(locationId) {
  const { data, error } = await db().from('store_status').select('printer_seen_at').eq('location_id', locationId).maybeSingle()
  if (error) { if (!missing(error)) console.error('Impresora: estado', error); return false }
  return Boolean(data?.printer_seen_at)
}

function render(kind, order) {
  if (kind === 'comanda') return { role: 'cocina', bytes: comandaBytes(order) }
  if (kind === 'cancelado') return { role: 'cocina', bytes: cancelBytes(order) }
  return { role: 'mostrador', bytes: receiptBytes(order, { siteUrl: siteBase() }) }
}

/**
 * Deja en la cola los papeles de un pedido. Solo si la sede tiene el
 * programa instalado; si no, sigue imprimiendo el panel como siempre.
 * Nunca rompe el pedido: si algo falla, lo apunta y sigue.
 * @returns {Promise<boolean>} true si ha quedado en la cola
 */
export async function enqueue(order, kinds, { automatic = false } = {}) {
  if (!isConfigured() || !kinds.length) return false
  try {
    if (!(await agentInstalled(order.location_id))) return false
    const rows = kinds.map((kind) => {
      const { role, bytes } = render(kind, order)
      return {
        location_id: order.location_id,
        role,
        kind,
        order_id: order.id,
        ref: order.ref,
        data: Buffer.from(bytes).toString('base64'),
        /* La clave hace idempotente la impresión automática en reintentos
           HTTP. Las reimpresiones manuales mantienen dedupe_key=null. */
        dedupe_key: automatic ? `auto:${order.id}:${kind}` : null,
      }
    })
    const { error } = await db().from('print_jobs').insert(rows)
    if (error) throw error
    return true
  } catch (err) {
    if (!missing(err) && err?.code !== '23505') console.error('No se pudo poner en la cola de impresión:', err)
    return false
  }
}

/** Pedido nuevo: comandas a cocina y, si no es de mostrador (ese se imprime al cobrar), ticket del cliente. */
export const enqueueNewOrder = (order) => enqueue(
  order,
  order.channel === 'mostrador' ? ['comanda'] : ['comanda', 'ticket'],
  { automatic: true },
)

/** Cancela el papel viejo de un pedido anulado y avisa si cocina podía haberlo recibido. */
export async function cancelPendingOrderJobs(order) {
  if (!isConfigured() || !order?.id) return false
  const { data, error } = await db().from('print_jobs').select('kind, status')
    .eq('location_id', order.location_id).eq('order_id', order.id)
    .in('kind', ['comanda', 'ticket']).in('status', ['pendiente', 'error', 'impreso', 'navegador'])
  if (error) { if (missing(error)) return false; throw error }

  const { error: cancelError } = await db().from('print_jobs')
    .update({ status: 'cancelado', error: 'Pedido cancelado.' })
    .eq('location_id', order.location_id).eq('order_id', order.id)
    .in('status', ['pendiente', 'error', 'navegador'])
  if (cancelError) { if (!missing(cancelError)) throw cancelError }

  return data.some((job) => job.kind === 'comanda' && ['pendiente', 'impreso', 'navegador'].includes(job.status))
}

/**
 * Estado de la impresora de cada sede para el panel, y aviso al móvil
 * del jefe si se ha caído con la tienda abierta (como mucho uno cada 15 min).
 */
export async function printersStatus(locationIds) {
  if (!isConfigured() || !locationIds.length) return {}
  const [st, jobs] = await Promise.all([
    db().from('store_status').select('location_id, is_open, printer_seen_at, printer_info').in('location_id', locationIds),
    db().from('print_jobs').select('location_id, status')
      .in('location_id', locationIds).in('status', ['pendiente', 'error'])
      .gte('created_at', new Date(Date.now() - MAX_AGE_MS).toISOString()).limit(500),
  ])
  if (st.error || jobs.error) {
    if (!missing(st.error) && !missing(jobs.error)) console.error('Impresora: estado', st.error || jobs.error)
    return {}
  }
  const out = {}
  for (const row of st.data) {
    if (!row.printer_seen_at) continue
    const age = Date.now() - Date.parse(row.printer_seen_at)
    const mine = jobs.data.filter((j) => j.location_id === row.location_id)
    const s = {
      online: age < ONLINE_MS, seenAt: row.printer_seen_at, info: row.printer_info || {},
      pending: mine.filter((j) => j.status === 'pendiente').length,
      failed: mine.filter((j) => j.status === 'error').length,
    }
    out[row.location_id] = s
    if (row.is_open && age > ALERT_MS) {
      take(`impresora:aviso:${row.location_id}`, { max: 1, window: 900, lock: 900 })
        .then((wait) => (wait ? null : notifyPrinterDown(row.location_id, getLocation(row.location_id)?.name || '', s.pending)))
        .catch(() => {})
    }
  }
  return out
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function pendingJobs(locationId) {
  const { data, error } = await db().from('print_jobs').select('id, role, kind, ref, data, attempts')
    .eq('location_id', locationId).eq('status', 'pendiente')
    .gte('created_at', new Date(Date.now() - MAX_AGE_MS).toISOString())
    .order('id', { ascending: true }).limit(10)
  if (error) throw error
  return data
}

export default async function printHandler(req, res) {
  if (!isConfigured()) return res.status(503).json({ error: 'Base de datos no configurada.' })
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Método no permitido' })
  }
  try {
    const { action } = req.body || {}
    if (action === 'poll' || action === 'ack') return await agent(req, res, action)
    return await panel(req, res, action)
  } catch (err) {
    if (missing(err)) return res.status(503).json({ error: 'Falta activar Nonno Impresora: ejecuta supabase/impresora.sql en Supabase.' })
    console.error('Error en /api/print:', err)
    return res.status(500).json({ error: 'No hemos podido imprimir.' })
  }
}

/* ── El programa del local ─────────────────────────────────────── */
async function agent(req, res, action) {
  const locationId = String(req.body.location || '')
  if (!agentAllowed(req, locationId)) return res.status(401).json({ error: 'Clave de impresora no válida.' })

  if (action === 'ack') {
    const results = Array.isArray(req.body.results) ? req.body.results.slice(0, 50) : []
    const now = new Date().toISOString()
    for (const r of results) {
      const id = Number(r.id)
      if (!Number.isInteger(id)) continue
      const { data: job, error: readError } = await db().from('print_jobs').select('id, kind, order_id, attempts, status')
        .eq('id', id).eq('location_id', locationId).maybeSingle()
      if (readError) throw readError
      if (!job) continue
      if (job.status === 'cancelado') {
        /* El agente pudo sacar la comanda justo cuando se anuló el pedido. */
        if (r.ok && job.kind === 'comanda' && job.order_id) {
          const { data: order, error: orderReadError } = await db().from('orders').select('*').eq('id', job.order_id).eq('location_id', locationId).maybeSingle()
          if (orderReadError) throw orderReadError
          if (order?.status === 'cancelado') await enqueue(order, ['cancelado'], { automatic: true })
        }
        continue
      }
      if (job.status !== 'pendiente') continue
      const attempts = job.attempts + 1
      const patch = r.ok
        ? { status: 'impreso', printed_at: now, attempts, error: null }
        /* Tres fallos seguidos (sin papel, apagada…): se deja en "error" y el panel avisa */
        : { status: attempts >= 3 ? 'error' : 'pendiente', attempts, error: String(r.error || 'Error').slice(0, 300) }
      const { data: updated, error: updateError } = await db().from('print_jobs').update(patch)
        .eq('id', id).eq('location_id', locationId).eq('status', 'pendiente').select('id').maybeSingle()
      if (updateError) throw updateError
      if (!updated) {
        const { data: latest, error: latestError } = await db().from('print_jobs').select('status, kind, order_id')
          .eq('id', id).eq('location_id', locationId).maybeSingle()
        if (latestError) throw latestError
        if (r.ok && latest?.status === 'cancelado' && latest.kind === 'comanda' && latest.order_id) {
          const { data: order, error: orderReadError } = await db().from('orders').select('*').eq('id', latest.order_id).eq('location_id', locationId).maybeSingle()
          if (orderReadError) throw orderReadError
          if (order?.status === 'cancelado') await enqueue(order, ['cancelado'], { automatic: true })
        }
        continue
      }
      if (r.ok && job.kind === 'comanda' && job.order_id) {
        const { error: orderError } = await db().from('orders').update({ printed_at: now }).eq('id', job.order_id)
        if (orderError) throw orderError
      }
    }
    return res.status(200).json({ ok: true })
  }

  /* poll: señal de vida + papeles pendientes (espera un poco si no hay) */
  const info = typeof req.body.printers === 'object' && req.body.printers ? req.body.printers : {}
  const beat = () => db().from('store_status').update({ printer_seen_at: new Date().toISOString(), printer_info: { ...info, version: String(req.body.version || '') } }).eq('location_id', locationId)
  const { error: beatError } = await beat()
  if (beatError) throw beatError
  const until = Date.now() + WAIT_MS
  let jobs = await pendingJobs(locationId)
  while (!jobs.length && Date.now() + 1000 < until) {
    await sleep(1000)
    jobs = await pendingJobs(locationId)
  }
  return res.status(200).json({ jobs: jobs.map(({ attempts: _a, ...j }) => j) })
}

/* ── Panel ─────────────────────────────────────────────────────── */
async function panel(req, res, action) {
  const session = readSession(req)
  if (!session) return res.status(401).json({ error: 'No autorizado' })
  const can = (loc) => session.scope === SCOPE_ALL || session.scope === loc

  if (action === 'job') {
    const kind = ['comanda', 'ticket'].includes(req.body.kind) ? req.body.kind : null
    if (!kind) return res.status(400).json({ error: 'Papel no válido.' })
    const { data: order, error } = await db().from('orders').select('*').eq('id', String(req.body.orderId || '')).maybeSingle()
    if (error) throw error
    if (!order || !can(order.location_id)) return res.status(404).json({ error: 'Ese pedido no es de tu sede.' })
    return res.status(200).json({ queued: await enqueue(order, [kind]) })
  }

  const locationId = String(req.body.location || '')
  if (!getLocation(locationId) || !can(locationId)) return res.status(403).json({ error: 'No puedes imprimir en otra sede.' })

  if (action === 'test') {
    const role = ROLES.includes(req.body.role) ? req.body.role : 'cocina'
    const label = `${getLocation(locationId).name} · ${role === 'cocina' ? 'COCINA' : 'MOSTRADOR'}`
    const { error } = await db().from('print_jobs').insert({
      location_id: locationId, role, kind: 'prueba', data: Buffer.from(testBytes(label)).toString('base64'),
    })
    if (error) throw error
    return res.status(200).json({ queued: true })
  }

  if (action === 'key') {
    if (!process.env.PRINT_AGENT_SECRET) return res.status(503).json({ error: 'Falta PRINT_AGENT_SECRET en Vercel.' })
    return res.status(200).json({ key: agentKey(locationId) })
  }

  if (action === 'retry') {
    const { error } = await db().from('print_jobs').update({ status: 'pendiente', attempts: 0, error: null })
      .eq('location_id', locationId).eq('status', 'error')
      .gte('created_at', new Date(Date.now() - MAX_AGE_MS).toISOString())
    if (error) throw error
    return res.status(200).json({ ok: true })
  }

  if (action === 'takeover') {
    /* La impresora del local no responde: el panel se queda lo pendiente y lo imprime por Chrome */
    const { data, error } = await db().from('print_jobs').update({ status: 'navegador' })
      .eq('location_id', locationId).in('status', ['pendiente', 'error'])
      .gte('created_at', new Date(Date.now() - MAX_AGE_MS).toISOString())
      .select('id, kind, order_id')
    if (error) throw error
    return res.status(200).json({ jobs: data })
  }

  return res.status(400).json({ error: 'Acción no válida.' })
}

