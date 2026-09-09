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

/** Avisa a todos los dispositivos suscritos de que ha entrado un pedido. */
export async function notifyNewOrder(order) {
  if (!configure()) return { sent: 0, skipped: 'push no configurado' }

  /* Solo avisa a los dispositivos de esa sede, más la dirección. */
  const { data: subs, error } = await db()
    .from('push_subscriptions')
    .select('*')
    .in('scope', [order.location_id, 'all'])
  if (error || !subs?.length) return { sent: 0 }

  const payload = JSON.stringify({
    title: `Nuevo pedido · ${order.location_name || 'Nonno'}`,
    body: `${order.item_count} producto${order.item_count === 1 ? '' : 's'} · ${Number(order.total).toFixed(2).replace('.', ',')} € · ${order.mode === 'delivery' ? 'Entrega' : 'Recogida'}`,
    ref: order.ref,
    orderId: order.id,
  })

  let sent = 0
  const expired = []

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          payload,
          { urgency: 'high', TTL: 3600 }
        )
        sent++
      } catch (err) {
        /* 404/410: el navegador ya no existe. Se limpia. */
        if (err?.statusCode === 404 || err?.statusCode === 410) expired.push(sub.endpoint)
        else console.error('Push fallido:', err?.statusCode, err?.body)
      }
    })
  )

  if (expired.length) {
    await db().from('push_subscriptions').delete().in('endpoint', expired)
  }

  return { sent }
}
