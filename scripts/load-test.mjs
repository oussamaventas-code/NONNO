#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════
   PRUEBA DE CARGA — pedidos simultáneos

   Simula varios pedidos a la vez contra /api/orders para comprobar
   dos cosas antes de fiarse del sistema un sábado real:

     1. ¿Aguanta el servidor y la base de datos N pedidos a la vez
        sin errores ni lentitud excesiva?
     2. ¿La asignación de franjas del horno se pasa alguna vez del
        tope de 15 pizzas / 15 min cuando varios pedidos entran al
        mismo tiempo? (con --admin-password lo comprueba de verdad
        contra lo que ha quedado guardado, no solo lo que responde
        cada petición)

   Los pedidos de prueba se marcan con el nombre "PRUEBA CARGA #N"
   para que nadie los confunda con un cliente real en cocina.

   USO
   ───
   node scripts/load-test.mjs --url https://tu-dominio.vercel.app [opciones]

   Contra un despliegue local (recomendado la primera vez):
     vercel dev
     node scripts/load-test.mjs --url http://localhost:3000

   OPCIONES
   ────────
   --url            (obligatorio) base de la web a probar
   --location       sede a probar: sangonera | santo-angel   (sangonera)
   --orders         cuántos pedidos simular                  (30)
   --concurrency    cuántos a la vez                          (10)
   --mode           pickup | delivery | mixed                (mixed)
   --admin-password contraseña del panel: verifica franjas y
                    cancela los pedidos de prueba al terminar
   --keep           no cancelar los pedidos de prueba (con --admin-password)
   --yes            no pedir confirmación antes de empezar

   ⚠️  Esto crea pedidos DE VERDAD en la base de datos que pongas en
   --url. Contra producción, hazlo fuera de horario de servicio.
   ═══════════════════════════════════════════════════════════════ */

import { getLocation } from '../src/data/locations.js'

const args = parseArgs(process.argv.slice(2))
const BASE_URL = (args.url || '').replace(/\/+$/, '')
const LOCATION_ID = args.location || 'sangonera'
const TOTAL = Number(args.orders || 30)
const CONCURRENCY = Number(args.concurrency || 10)
const MODE = args.mode || 'mixed'
const ADMIN_PASSWORD = args['admin-password'] || null
const KEEP = Boolean(args.keep)
const SKIP_CONFIRM = Boolean(args.yes)

if (!BASE_URL) {
  console.error('Falta --url. Ejemplo: node scripts/load-test.mjs --url http://localhost:3000')
  process.exit(1)
}
const location = getLocation(LOCATION_ID)
if (!location) {
  console.error(`Sede desconocida: ${LOCATION_ID}`)
  process.exit(1)
}

const PRODUCTS = ['margarita', 'hawaiana', 'prosciutto', 'fungi', 'nonno', 'bote']

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const key = a.slice(2)
      const next = argv[i + 1]
      if (next && !next.startsWith('--')) { out[key] = next; i++ } else out[key] = true
    }
  }
  return out
}

function buildOrder(i) {
  const isDelivery = MODE === 'delivery' || (MODE === 'mixed' && i % 3 === 0)
  const itemCount = 1 + (i % 3)
  const items = Array.from({ length: itemCount }, (_, j) => ({
    id: PRODUCTS[(i + j) % PRODUCTS.length],
    qty: 1 + ((i + j) % 2),
  }))

  return {
    clientKey: `loadtest-${Date.now()}-${i}`,
    location: { id: LOCATION_ID },
    mode: isDelivery ? 'delivery' : 'pickup',
    customer: {
      name: `PRUEBA CARGA #${i}`,
      phone: `6${String(10000000 + i).padStart(8, '0')}`,
      /* tier: 0 = "hasta 1 km" elegido a mano — evita depender del
         buscador de direcciones durante la prueba, que es un
         servicio externo aparte y no lo que queremos medir aquí. */
      ...(isDelivery ? { address: `Dirección de prueba ${i}, Murcia`, tier: 0 } : {}),
      notes: 'Pedido de la prueba de carga — se puede cancelar.',
    },
    items,
  }
}

async function timedFetch(url, opts) {
  const start = performance.now()
  let res, body
  try {
    res = await fetch(url, opts)
    body = await res.json().catch(() => ({}))
  } catch (err) {
    return { ok: false, ms: performance.now() - start, error: err.message, status: 0 }
  }
  return { ok: res.ok, status: res.status, ms: performance.now() - start, body }
}

async function runPool(items, worker, concurrency) {
  const results = new Array(items.length)
  let next = 0
  async function runner() {
    while (next < items.length) {
      const i = next++
      results[i] = await worker(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runner))
  return results
}

function percentile(sorted, p) {
  if (!sorted.length) return 0
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)
  return sorted[Math.max(0, idx)]
}

function confirm(message) {
  if (SKIP_CONFIRM) return Promise.resolve(true)
  return new Promise((resolve) => {
    process.stdout.write(`${message} (escribe SI y pulsa Intro) `)
    process.stdin.setEncoding('utf8')
    process.stdin.once('data', (d) => resolve(d.trim().toUpperCase() === 'SI'))
  })
}

async function main() {
  const isLocal = /localhost|127\.0\.0\.1/.test(BASE_URL)
  console.log('═══════════════════════════════════════════════════')
  console.log(' PRUEBA DE CARGA — pedidos simultáneos')
  console.log('═══════════════════════════════════════════════════')
  console.log(` Destino:      ${BASE_URL}${isLocal ? '  (local)' : '  ⚠️  NO es local'}`)
  console.log(` Sede:         ${location.name}`)
  console.log(` Pedidos:      ${TOTAL}  ·  ${CONCURRENCY} a la vez`)
  console.log(` Modo:         ${MODE}`)
  console.log('')
  if (!isLocal) {
    console.log(' ⚠️  Vas a crear pedidos DE VERDAD en un servidor que no es local.')
    console.log('    Si es producción, hazlo fuera de horario de servicio.')
  }
  const go = await confirm(' ¿Seguimos?')
  if (!go) { console.log('Cancelado.'); process.exit(0) }

  const orders = Array.from({ length: TOTAL }, (_, i) => buildOrder(i))

  console.log('\nEnviando pedidos...\n')
  const started = performance.now()
  const results = await runPool(orders, (order) =>
    timedFetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order),
    }), CONCURRENCY)
  const totalMs = performance.now() - started

  const ok = results.filter((r) => r.ok)
  const full = results.filter((r) => !r.ok && r.body?.code === 'full')
  const closed = results.filter((r) => !r.ok && r.body?.code === 'closed')
  const otherErrors = results.filter((r) => !r.ok && r.body?.code !== 'full' && r.body?.code !== 'closed')
  const times = results.filter((r) => r.status !== 0).map((r) => r.ms).sort((a, b) => a - b)

  console.log('─── Resultado ────────────────────────────────────')
  console.log(` Tiempo total:        ${(totalMs / 1000).toFixed(1)} s`)
  console.log(` Conseguidos:         ${ok.length} / ${TOTAL}`)
  console.log(` Rechazados (horno lleno): ${full.length}`)
  console.log(` Rechazados (sede cerrada): ${closed.length}`)
  console.log(` Otros errores:       ${otherErrors.length}`)
  if (times.length) {
    console.log(` Latencia  p50/p95/máx: ${percentile(times, 50).toFixed(0)}ms / ${percentile(times, 95).toFixed(0)}ms / ${times.at(-1).toFixed(0)}ms`)
  }
  if (otherErrors.length) {
    console.log('\n Primeros errores no esperados:')
    otherErrors.slice(0, 5).forEach((r) => console.log(`  · [${r.status}] ${r.body?.error || r.error || 'sin detalle'}`))
  }

  if (!ADMIN_PASSWORD) {
    console.log('\n(Pasa --admin-password para comprobar de verdad que el horno')
    console.log(' nunca superó las 15 pizzas por franja, y para limpiar los')
    console.log(' pedidos de prueba automáticamente.)')
    return
  }

  console.log('\n─── Comprobando franjas del horno ──────────────────')
  const loginRes = await fetch(`${BASE_URL}/api/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: ADMIN_PASSWORD }),
  })
  if (!loginRes.ok) {
    console.log(' No se ha podido entrar al panel con esa contraseña. Me salto la comprobación.')
    return
  }
  const sessionCookie = (loginRes.headers.get('set-cookie') || '').split(';')[0]

  const listRes = await fetch(`${BASE_URL}/api/orders?limit=500`, { headers: { cookie: sessionCookie } })
  const { orders: allOrders } = await listRes.json()
  const testOrders = (allOrders || []).filter((o) => o.customer_name?.startsWith('PRUEBA CARGA'))
  /* Un pedido cancelado no ocupa horno — igual que en el sistema real,
     no cuenta para el tope. Si no se descarta aquí, una prueba
     anterior ya cancelada puede sumarse por error a esta y parecer
     que el horno se pasó de tope cuando en realidad no fue así. */
  const activeTestOrders = testOrders.filter((o) => o.status !== 'cancelado')

  const bySlot = new Map()
  activeTestOrders.forEach((o) => {
    (o.oven_slots || []).forEach((s) => {
      bySlot.set(s.start, (bySlot.get(s.start) || 0) + s.pizzas)
    })
  })
  const limit = location.kitchen.pizzasPerSlot
  const overbooked = [...bySlot.entries()].filter(([, n]) => n > limit)

  console.log(` Pedidos de prueba encontrados: ${testOrders.length} (${activeTestOrders.length} activos, ${testOrders.length - activeTestOrders.length} de pruebas anteriores ya cancelados)`)
  console.log(` Franjas usadas: ${bySlot.size}  ·  tope por franja: ${limit}`)
  if (overbooked.length) {
    console.log(` ❌ ¡FRANJA CON MÁS PIZZAS DE LAS PERMITIDAS!`)
    overbooked.forEach(([start, n]) => console.log(`    ${start} → ${n} pizzas (tope ${limit})`))
  } else {
    console.log(' ✅ Ninguna franja se ha pasado del tope. La lógica de reparto ha aguantado.')
  }

  if (!KEEP && testOrders.length) {
    console.log('\n─── Limpiando pedidos de prueba ────────────────────')
    let cancelled = 0
    await runPool(testOrders, async (o) => {
      const r = await fetch(`${BASE_URL}/api/orders/${o.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', cookie: sessionCookie },
        body: JSON.stringify({ status: 'cancelado' }),
      })
      if (r.ok) cancelled++
    }, CONCURRENCY)
    console.log(` Cancelados ${cancelled} / ${testOrders.length} pedidos de prueba.`)
  } else if (testOrders.length) {
    console.log('\n(--keep: se dejan los pedidos de prueba tal cual en el panel.)')
  }
}

main().catch((err) => {
  console.error('Error en la prueba:', err)
  process.exit(1)
})
