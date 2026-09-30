import { db, isConfigured } from './_lib/supabase.js'
import { requireSession, readSession, SCOPE_ALL } from './_lib/auth.js'
import { notifyNewOrder } from './_lib/push.js'
import { sanitizeOrder, validateOrder, newRef } from './_lib/order.js'
import { isStoreOpen } from './_lib/store.js'
import { loadMenu } from './_lib/menu.js'
import { precheck, assignSlot, SLOT_ERRORS } from './_lib/slots.js'
import { notifyCustomer } from './_lib/sms.js'
import { readCustomerId, getCustomer, movePoints, isMissingTable } from './_lib/customer.js'
import { normalizeRedeem } from '../src/data/loyalty.js'
import { forcedSlot } from '../src/lib/kitchenSlots.js'
import { getLocation } from '../src/data/locations.js'
import { phonePattern, phoneKey, summarizeCustomer } from '../src/lib/customerLookup.js'
import { trackToken, parseTrackToken, keyMatches } from '../src/lib/tracking.js'
import { serviceDay, nextNumber } from '../src/lib/orderNumber.js'
import { guard, clientIp } from './_lib/limiter.js'

const reply = (row, staff) => ({
  id: row.id,
  ref: row.ref,
  track: trackToken(row),
  status: row.status,
  total: row.total,
  readyAt: row.ready_at,
  etaAt: row.eta_at,
  ...(staff ? { order: row } : {}),
})

async function findByClientKey(key) {
  if (!key) return null
  const { data } = await db().from('orders').select('*').eq('client_key', key).maybeSingle()
  return data
}

/** Siguiente número del día en la sede ("01", "02"…). */
async function dailyNumber(locationId, day) {
  const { data, error } = await db().from('orders').select('ref').eq('location_id', locationId).eq('service_day', day)
  if (error) throw error
  return nextNumber(data.map((r) => r.ref))
}

/** La base de datos aún no tiene la columna service_day. */
const missingDayColumn = (err) =>
  ['42703', 'PGRST204'].includes(err?.code) && /service_day/.test(err?.message || '')

/** Hora ISO de las últimas 12 h (nunca futura), o null. */
function validPastTime(value) {
  const t = Date.parse(value)
  if (!Number.isFinite(t) || t > Date.now() + 60000 || t < Date.now() - 12 * 3600000) return null
  return new Date(t).toISOString()
}

export default async function handler(req, res) {
  if (!isConfigured()) {
    return res.status(503).json({
      error: 'El sistema de pedidos todavía no está conectado a la base de datos.',
    })
  }

  /* ── Crear pedido ───────────────────────────────────────────────
     Público desde la web. Desde el panel (mostrador o teléfono) llega
     con `channel` y sesión: entonces no depende del interruptor de la
     web, pero sí de las franjas del horno, igual que todos. */
  if (req.method === 'POST') {
    /* Solo mostrador y teléfono son pedidos del personal. La web manda
       channel: 'web' y tiene que seguir entrando sin sesión. */
    const staffChannel = ['mostrador', 'telefono'].includes(req.body?.channel)
    const session = staffChannel ? readSession(req) : null
    if (staffChannel && !session) return res.status(401).json({ error: 'No autorizado' })
    const staff = Boolean(session)

    /* Pedidos de la web: tope por IP y por teléfono. Evita llenar el horno
       con pedidos falsos y que se use el aviso por SMS contra un número
       ajeno. Con margen de sobra para una familia que pide varias veces. */
    if (!staff) {
      const rules = [[`order:ip:${clientIp(req)}`, { max: 12, window: 600, lock: 600 }]]
      const digits = phoneKey(req.body?.customer?.phone)
      if (digits) rules.push([`order:tel:${digits}`, { max: 5, window: 600, lock: 600 }])
      const blocked = await guard(res, rules)
      if (blocked) {
        return res.status(429).json({ error: 'Demasiados pedidos seguidos. Espera unos minutos o llámanos.', retryAfter: blocked })
      }
    }

    /* Cliente del Club Nonno con sesión (solo pedidos de la web): el
       pedido queda a su nombre y puede canjear puntos, como mucho los
       que tiene de verdad según la base de datos. */
    let customer = null
    if (!staff) {
      try {
        customer = await getCustomer(readCustomerId(req))
      } catch (err) {
        if (!isMissingTable(err)) console.error('Error leyendo el cliente:', err)
      }
    }
    const redeem = customer ? Math.min(normalizeRedeem(req.body?.redeemPoints), normalizeRedeem(customer.points)) : 0

    /* Precios, ocultos y agotados al día: el total se recalcula con la carta
       real, no con la que el navegador tenía en pantalla. */
    await loadMenu({ force: true })
    const parsed = sanitizeOrder(req.body, { staff, customerId: customer?.id, redeem })
    const problem = validateOrder(parsed)
    if (problem) return res.status(400).json({ error: problem })
    const { order } = parsed

    if (staff && session.scope !== SCOPE_ALL && session.scope !== order.location_id) {
      return res.status(403).json({ error: 'No puedes crear pedidos en otra sede.' })
    }

    /* Mismo pedido reenviado (reintento, o cola del mostrador sin
       conexión): se devuelve el que ya existe en vez de duplicarlo. */
    const existing = await findByClientKey(order.client_key)
    if (existing) return res.status(200).json(reply(existing, staff))

    /* Pedido que el mostrador tomó SIN CONEXIÓN y ya salió en papel a
       cocina: se registra aunque el horno ya no tenga hueco, porque
       ya se está haciendo. Solo el personal puede hacerlo. */
    const offlineAt = staff ? validPastTime(req.body?.offlineAt) : null
    if (offlineAt) order.created_at = offlineAt

    /* La web ya avisa si la sede está cerrada, pero el servidor es
       quien de verdad lo impide: nadie se lo salta reenviando la
       petición a mano. */
    if (!staff && !(await isStoreOpen(order.location_id))) {
      return res.status(503).json({ code: 'closed', error: 'Esta sede está cerrada ahora mismo. No se pueden hacer pedidos.' })
    }

    /* Primer filtro: si ya no cabe, ni se guarda. */
    if (!offlineAt) {
      try {
        const plan = await precheck(order.location_id, order.pizza_count, order.scheduled_for)
        if (!plan.ok) return res.status(409).json({ code: 'full', error: SLOT_ERRORS[plan.reason] })
      } catch (err) {
        console.error('Error leyendo la carga del horno:', err)
        return res.status(500).json({ error: 'No hemos podido registrar el pedido.' })
      }
    }

    /* Número del día de la sede: 01, 02, 03… Si dos pedidos cogen el
       mismo a la vez, la base de datos rechaza uno y ese coge el
       siguiente. Sin la columna service_day (falta ejecutar
       supabase/numero-pedido.sql) se usa la referencia al azar de antes. */
    const offlineRef = order.ref.startsWith('SC-')
    order.service_day = serviceDay(offlineAt ? Date.parse(offlineAt) : Date.now())
    let data, error
    for (let attempt = 0; attempt < 10; attempt++) {
      if (order.service_day && !offlineRef) {
        try {
          order.ref = await dailyNumber(order.location_id, order.service_day)
        } catch (err) {
          if (!missingDayColumn(err)) {
            console.error('Error leyendo el número del día:', err)
            return res.status(500).json({ error: 'No hemos podido registrar el pedido.' })
          }
          delete order.service_day
          order.ref = newRef()
        }
      } else if (attempt > 0) {
        order.ref = newRef(attempt < 5 ? 4 : 6)
      }
      ;({ data, error } = await db().from('orders').insert(order).select('id').single())
      if (error && order.service_day && missingDayColumn(error)) {
        delete order.service_day
        if (!offlineRef) order.ref = newRef()
        continue
      }
      if (error?.code !== '23505') break
      /* Dos envíos del mismo pedido a la vez: gana uno, el otro lo recoge. */
      const dup = await findByClientKey(order.client_key)
      if (dup) return res.status(200).json(reply(dup, staff))
    }

    if (error) {
      console.error('Error guardando el pedido:', error)
      if (error.code === '42703' && order.scheduled_for) {
        return res.status(409).json({ error: 'Los pedidos programados aún no están activados en la base de datos (falta ejecutar supabase/fase2.sql).' })
      }
      return res.status(500).json({ error: 'No hemos podido registrar el pedido.' })
    }

    /* Franja definitiva, con este pedido ya dentro. Si no cabe o algo
       falla, el pedido se retira: mejor un error claro que un pedido
       sin hora en cocina. Salvo los tomados sin conexión: esos se
       quedan sin franja, porque ya están en el horno. */
    let assigned
    try {
      assigned = await assignSlot(data.id, order.location_id, parsed.delivery)
    } catch (err) {
      console.error('Error asignando franja:', err)
      assigned = { ok: false }
    }
    if (!assigned.ok && offlineAt) {
      /* No cabía en el cálculo normal, pero ya se está haciendo de
         verdad: se apunta su carga real (aunque deje la franja por
         encima del tope) para que los SIGUIENTES pedidos sí la vean
         y no se planifiquen encima de un horno que ya está ocupado. */
      const kitchen = getLocation(order.location_id).kitchen
      const forced = forcedSlot({ atMs: Date.parse(offlineAt), kitchen, pizzas: order.pizza_count })
      const readyAt = new Date(forced.readyAt)
      const etaAt = parsed.delivery?.ok ? new Date(forced.readyAt + parsed.delivery.minutes * 60000) : readyAt
      const { data: kept } = await db().from('orders')
        .update({ oven_slots: forced.slots, ready_at: readyAt.toISOString(), eta_at: etaAt.toISOString() })
        .eq('id', data.id).select('*').single()
      assigned = { ok: true, row: kept }
    }
    if (!assigned.ok) {
      await db().from('orders').delete().eq('id', data.id)
      return res.status(409).json({ code: 'full', error: SLOT_ERRORS[assigned.reason] || 'No hemos podido registrar el pedido.' })
    }
    const row = assigned.row

    /* Canje de puntos: se descuentan ahora, con el pedido ya en firme.
       Si el saldo no llega (lo gastó en otro pedido a la vez), el
       pedido se retira y se avisa. */
    if (row.points_redeemed > 0) {
      try {
        await movePoints(customer.id, row.id, -row.points_redeemed, 'canje', `Pedido ${row.ref}`)
      } catch (err) {
        await db().from('orders').delete().eq('id', row.id)
        if (/saldo_insuficiente/.test(err?.message || '')) {
          return res.status(409).json({ code: 'points', error: 'No tienes puntos suficientes para ese descuento. Revisa tu pedido.' })
        }
        console.error('Error canjeando puntos:', err)
        return res.status(500).json({ error: 'No hemos podido registrar el pedido.' })
      }
    }

    /* Los avisos no deben tumbar el pedido si fallan, y son
       independientes entre sí: van a la vez, no uno detrás del otro
       (el SMS puede tardar hasta 5 s si el móvil de la pasarela no
       responde, y el cliente no tiene por qué esperar ese tiempo). */
    const [, smsResult] = await Promise.all([
      notifyNewOrder(row).catch((err) => console.error('Error enviando la notificación:', err)),
      notifyCustomer(db(), row, 'recibido').catch((err) => console.error('Error enviando el SMS:', err)),
    ])
    if (smsResult) row.sms = smsResult

    return res.status(201).json(reply(row, staff))
  }

  /* ── Listar pedidos (solo panel) ────────────────────────────── */
  if (req.method === 'GET') {
    /* Seguimiento público del cliente: solo con el enlace completo
       (referencia + clave), y solo lo que necesita ver. */
    if (req.query?.track !== undefined) return trackOrder(req, res)

    const session = requireSession(req, res)
    if (!session) return

    /* Ficha de un cliente por teléfono (mostrador y teléfono). Cada local
       solo ve los pedidos de su sede, igual que el resto del panel. */
    if (req.query?.customer !== undefined) {
      const pattern = phonePattern(req.query.customer)
      if (!pattern) return res.status(200).json({ customer: null })
      let q = db()
        .from('orders')
        .select('ref, created_at, status, total, mode, items, location_id, address, delivery_lat, delivery_lng, delivery_verified, delivery_tier, delivery_fee, customer_name, customer_phone')
        .ilike('customer_phone', pattern)
        .order('created_at', { ascending: false })
        .limit(40)
      if (session.scope !== SCOPE_ALL) q = q.eq('location_id', session.scope)
      const { data, error } = await q
      if (error) {
        console.error('Error buscando al cliente:', error)
        return res.status(500).json({ error: 'No hemos podido buscar al cliente.' })
      }
      return res.status(200).json({ customer: summarizeCustomer(data, req.query.customer) })
    }

    const limit = Math.min(200, Math.max(1, Number(req.query?.limit) || 60))
    const since = req.query?.since

    let query = db()
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    /* El filtro por sede sale de la SESIÓN, nunca de lo que pida el
       navegador: quien entra con la clave de una sede no puede ver la
       otra ni manipulando la petición. */
    if (session.scope !== SCOPE_ALL) query = query.eq('location_id', session.scope)

    if (since) query = query.gt('created_at', since)

    const { data, error } = await query
    if (error) {
      console.error('Error leyendo pedidos:', error)
      return res.status(500).json({ error: 'No hemos podido cargar los pedidos.' })
    }

    return res.status(200).json({ orders: data })
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).json({ error: 'Método no permitido' })
}

/** Primer nombre y poco más: la página de seguimiento es pública. */
const firstName = (name) => String(name || '').trim().split(/\s+/)[0] || ''

async function trackOrder(req, res) {
  const parsed = parseTrackToken(req.query.track)
  if (!parsed) return res.status(404).json({ error: 'No encontramos ese pedido.' })
  /* El número del día se repite cada día: se busca por número y por el
     principio del id que lleva el enlace (los 10 primeros caracteres). */
  const k = parsed.key
  const { data, error } = await db()
    .from('orders')
    .select('*')
    .eq('ref', parsed.ref)
    .gte('id', `${k.slice(0, 8)}-${k.slice(8)}00-0000-0000-000000000000`)
    .lte('id', `${k.slice(0, 8)}-${k.slice(8)}ff-ffff-ffff-ffffffffffff`)
    .limit(1)
    .maybeSingle()
  if (error) {
    console.error('Error leyendo el seguimiento:', error)
    return res.status(500).json({ error: 'No hemos podido cargar tu pedido.' })
  }
  if (!data || !keyMatches(data.id, parsed.key)) return res.status(404).json({ error: 'No encontramos ese pedido.' })

  const location = getLocation(data.location_id)
  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).json({
    order: {
      ref: data.ref,
      status: data.status,
      mode: data.mode,
      name: firstName(data.customer_name),
      createdAt: data.created_at,
      readyAt: data.ready_at,
      etaAt: data.eta_at,
      scheduledFor: data.scheduled_for || null,
      dispatchedAt: data.dispatched_at || null,
      total: data.total,
      paid: data.payment_status === 'pagado',
      items: (data.items || []).map((i) => ({ qty: i.qty, name: i.name, removed: i.removed || [], extras: i.extras || [] })),
      location: location ? { id: location.id, name: location.name, address: location.address, phone: location.phones?.[0] || null } : null,
    },
  })
}
