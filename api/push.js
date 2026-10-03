import { db, isConfigured } from './_lib/supabase.js'
import { requireSession } from './_lib/auth.js'
import { pushConfigured } from './_lib/push.js'
import { sendTestAviso, smsProvider, mobileNumber, whatsappStatus } from './_lib/sms.js'

const twilioSms = () => Boolean(process.env.TWILIO_FROM)

/**
 * Suscripción del panel a las notificaciones.
 *   GET    → clave pública y si el push está disponible
 *   POST   → registrar este navegador
 *   DELETE → dar de baja este navegador
 */
export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({
      enabled: pushConfigured(),
      publicKey: process.env.VAPID_PUBLIC_KEY || null,
    })
  }

  if (!isConfigured()) {
    return res.status(503).json({ error: 'Base de datos no configurada.' })
  }

  /* Twilio avisando de cómo acabó un WhatsApp. Sin sesión: se comprueba
     la firma de Twilio. Va aquí para no gastar otra función de Vercel. */
  if (req.method === 'POST' && req.query?.twilio === 'status') return whatsappStatus(db(), req, res)

  const session = requireSession(req, res)
  if (!session) return

  /* Aviso de prueba desde el panel (menú ⚙): comprueba que la vía de envío
     funciona sin tener que hacer un pedido falso. */
  if (req.method === 'POST' && req.body?.action === 'test-sms') {
    const provider = smsProvider()
    if (!provider) return res.status(200).json({ ok: false, error: 'No hay ninguna vía de avisos configurada en Vercel (ni WhatsApp, ni Twilio SMS, ni el Android).' })
    if (!mobileNumber(req.body.phone)) return res.status(400).json({ ok: false, error: 'Escribe un móvil español (6XX o 7XX).' })
    const result = await sendTestAviso(req.body.phone)
    return res.status(200).json({ ...result, provider: result.via === 'whatsapp' ? 'whatsapp' : result.provider || (provider === 'whatsapp' ? (twilioSms() ? 'twilio' : 'android') : provider) })
  }

  if (req.method === 'POST') {
    const { subscription, label } = req.body || {}
    if (!subscription?.endpoint || !subscription?.keys) {
      return res.status(400).json({ error: 'Suscripción no válida.' })
    }

    const { error } = await db()
      .from('push_subscriptions')
      .upsert(
        {
          endpoint: subscription.endpoint,
          keys: subscription.keys,
          label: String(label || 'Panel de cocina').slice(0, 80),
          scope: session.scope,
        },
        { onConflict: 'endpoint' }
      )

    if (error) {
      console.error('Error guardando la suscripción:', error)
      return res.status(500).json({ error: 'No hemos podido activar los avisos.' })
    }
    return res.status(200).json({ ok: true })
  }

  if (req.method === 'DELETE') {
    const { endpoint } = req.body || {}
    if (endpoint) await db().from('push_subscriptions').delete().eq('endpoint', endpoint)
    return res.status(200).json({ ok: true })
  }

  res.setHeader('Allow', 'GET, POST, DELETE')
  return res.status(405).json({ error: 'Método no permitido' })
}
