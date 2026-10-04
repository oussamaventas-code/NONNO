import webpush from 'web-push'
import { db } from './supabase.js'

/* ═══════════════════════════════════════════════════════════════
   Notificaciones push del panel de cocina.

   Avisan aunque el panel esté cerrado, siempre que el navegador
   siga vivo en segundo plano. Requiere un par de claves VAPID
   (se generan con: npx web-push generate-vapid-keys).
   ═══════════════════════════════════════════════════════════════ */

let ready = false

function configure() {
  if (ready) return true
  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) return false

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:pedidos@lapizzadenonno.example',
    publicKey,
    privateKey
  )
  ready = true
  return true
}

export const pushConfigured = () =>
  Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)

/**
 * Manda `payload` a los dispositivos de esas sedes (más la dirección,
 * que tiene scope 'all') y limpia los que ya no existen.
 */
async function sendToScopes(scopes, payload, { urgency = 'high', TTL = 3600 } = {}) {
  if (!configure()) return { sent: 0, skipped: 'push no configurado' }

  const { data: subs, error } = await db()
    .from('push_subscriptions')
    .select('*')
    .in('scope', [...scopes, 'all'])
  if (error || !subs?.length) return { sent: 0 }

  let sent = 0
  const expired = []
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, JSON.stringify(payload), { urgency, TTL })
        sent++
      } catch (err) {
        /* 404/410: el navegador ya no existe. Se limpia. */
        if (err?.statusCode === 404 || err?.statusCode === 410) expired.push(sub.endpoint)
        else console.error('Push fallido:', err?.statusCode, err?.body)
      }
    })
  )
  if (expired.length) await db().from('push_subscriptions').delete().in('endpoint', expired)
  return { sent }
}

/** Avisa a los dispositivos de esa sede (y a la dirección) de que ha entrado un pedido. */
export function notifyNewOrder(order) {
  return sendToScopes([order.location_id], {
    title: `Nuevo pedido · ${order.location_name || 'Nonno'}`,
    body: `${order.item_count} producto${order.item_count === 1 ? '' : 's'} · ${Number(order.total).toFixed(2).replace('.', ',')} € · ${order.mode === 'delivery' ? 'Entrega' : 'Recogida'}`,
    ref: order.ref,
    orderId: order.id,
  })
}

/**
 * Recordatorio de cierre (lo lanza el cron de Vercel por la noche): a
 * cada sede que siga ABIERTA en el panel le llega "¿Cerramos?". La web
 * ya no cierra sola por horario, así que esto evita pedidos de madrugada.
 */
export async function remindClose(statuses, locations) {
  const open = locations.filter((l) => statuses[l.id]?.is_open !== false)
  const results = await Promise.all(open.map((l) => sendToScopes([l.id], {
    title: `¿Cerramos ${l.name}?`,
    body: 'La web sigue aceptando pedidos. Toca para abrir el panel y cerrar la cocina.',
    ref: `cierre-${l.id}`,
    url: `/admin/${l.id}`,
  })))
  return { open: open.map((l) => l.id), sent: results.reduce((n, r) => n + (r.sent || 0), 0) }
}

/** La impresora (o el ordenador) de una sede no responde con la tienda abierta. */
export function notifyPrinterDown(locationId, locationName, pending) {
  return sendToScopes([locationId], {
    title: `Impresora sin conexión · ${locationName}`,
    body: pending
      ? `${pending} papel${pending === 1 ? '' : 'es'} sin imprimir. Mira el ordenador del local o imprime desde el panel.`
      : 'El programa Nonno Impresora no responde. Mira que el ordenador del local esté encendido.',
    url: `/admin/${locationId}`,
  })
}
