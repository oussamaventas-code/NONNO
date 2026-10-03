import nodemailer from 'nodemailer'
import { getLocation } from '../../src/data/locations.js'
import { hourOf } from '../../src/lib/kitchenSlots.js'
import { trackToken, trackPath } from '../../src/lib/tracking.js'

/* ═══════════════════════════════════════════════════════════════
   CORREOS AL CLIENTE — desde el Gmail del local

   · Ticket de cada pedido al correo que deje el cliente.
   · Enlace para cambiar la contraseña de su cuenta.

   Variables en Vercel:
     GMAIL_USER          → la dirección de Gmail (p. ej. lapizzadenonno@gmail.com)
     GMAIL_APP_PASSWORD  → "contraseña de aplicación" de esa cuenta
                           (Cuenta de Google → Seguridad → Verificación en
                           dos pasos → Contraseñas de aplicaciones). NO es
                           la contraseña normal del Gmail.
   Gmail deja mandar unos 500 correos al día: de sobra para los pedidos.
   Sin las variables no se manda nada y todo lo demás sigue igual.
   ═══════════════════════════════════════════════════════════════ */

export const mailConfigured = () => Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD)

let transport
const transporter = () => {
  transport ||= nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD.replace(/\s/g, '') },
  })
  return transport
}

/** Dirección pública de la web: SITE_URL o el dominio de producción de Vercel. */
export const siteBase = () => {
  const base = process.env.SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '')
  return String(base).replace(/\/+$/, '')
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const euros = (n) => `${Number(n || 0).toFixed(2).replace('.', ',')} €`
export const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || '').trim())

/** Envía un correo. Nunca lanza: devuelve { ok, error? }. */
export async function sendMail({ to, subject, html, text }) {
  if (!mailConfigured()) return { ok: false, skipped: 'correo-no-configurado' }
  if (!isEmail(to)) return { ok: false, skipped: 'correo-no-valido' }
  try {
    await transporter().sendMail({
      from: `"La Pizza de Nonno" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      html,
      text,
    })
    return { ok: true }
  } catch (err) {
    console.error('Error mandando el correo:', err?.message || err)
    return { ok: false, error: 'no se pudo mandar el correo' }
  }
}

/* Marco común: fondo negro y rojo de la marca, como la web. Tablas y
   estilos en línea porque es lo único que respetan todos los correos. */
function frame(inner) {
  const base = siteBase()
  return `<!doctype html><html lang="es"><body style="margin:0;background:#0c0c0c;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:#f6f0e0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#1b1b1d;border:2px solid #e23e57;border-radius:12px">
<tr><td align="center" style="padding:24px 24px 8px">${base ? `<img src="${base}/logo-nonno.png" width="96" height="96" alt="La Pizza de Nonno" style="display:block;border:0">` : '<strong style="font-size:20px">LA PIZZA DE NONNO</strong>'}</td></tr>
<tr><td style="padding:8px 24px 24px">${inner}</td></tr>
</table>
<p style="color:#8a8578;font-size:12px;margin:16px 0 0">La Pizza de Nonno · Sangonera la Verde · Santo Ángel</p>
</td></tr></table></body></html>`
}

const button = (href, label) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px auto 0"><tr><td style="background:#2aa7ff;border-radius:8px">
<a href="${esc(href)}" style="display:inline-block;padding:14px 26px;color:#0c0c0c;font-weight:bold;text-decoration:none;font-size:15px">${esc(label)}</a></td></tr></table>`

/** Correo con el ticket del pedido. */
export function orderMail(order) {
  const location = getLocation(order.location_id)
  const delivery = order.mode === 'delivery'
  const token = trackToken(order)
  const link = siteBase() && token ? `${siteBase()}${trackPath(token)}` : ''
  const when = delivery
    ? (order.eta_at ? `Te lo llevamos hacia las <strong>${esc(hourOf(order.eta_at))}</strong>` : 'Te lo llevamos en cuanto salga del horno')
    : (order.ready_at ? `Recógelo en <strong>${esc(location?.name || order.location_name)}</strong> a las <strong>${esc(hourOf(order.ready_at))}</strong>` : `Recógelo en <strong>${esc(location?.name || order.location_name)}</strong>`)

  const lines = (order.items || []).map((i) => `<tr>
<td style="padding:6px 0;vertical-align:top;width:28px;font-weight:bold">${i.qty}×</td>
<td style="padding:6px 0;vertical-align:top">${esc(i.name)}${i.size ? ` <span style="color:#8a8578">${esc(i.size)}</span>` : ''}
${i.removed?.length ? `<div style="color:#ff5c7c;font-size:13px">Sin ${esc(i.removed.join(', sin '))}</div>` : ''}
${i.extras?.length ? `<div style="color:#5fd38d;font-size:13px">+ ${esc(i.extras.join(', + '))}</div>` : ''}
${i.note ? `<div style="color:#8a8578;font-size:13px">"${esc(i.note)}"</div>` : ''}</td>
<td style="padding:6px 0;vertical-align:top;text-align:right;white-space:nowrap">${esc(euros(i.total))}</td></tr>`).join('')

  const row = (label, value) => `<tr><td colspan="2" style="padding:2px 0;color:#c9c3b3">${label}</td><td style="padding:2px 0;text-align:right;color:#c9c3b3">${value}</td></tr>`
  const extras = [
    Number(order.discount) ? row('Descuento recogida', `−${esc(euros(order.discount))}`) : '',
    Number(order.points_discount) ? row(`Puntos Club Nonno (${Number(order.points_redeemed) || 0})`, `−${esc(euros(order.points_discount))}`) : '',
    Number(order.delivery_fee) ? row('Envío', `+${esc(euros(order.delivery_fee))}`) : '',
  ].join('')

  const html = frame(`
<p style="margin:0;text-align:center;color:#2aa7ff;font-size:13px;letter-spacing:2px">PEDIDO RECIBIDO</p>
<p style="margin:6px 0 0;text-align:center;font-size:40px;font-weight:bold;color:#ffd23f">${esc(order.ref)}</p>
<p style="margin:8px 0 0;text-align:center;font-size:16px">${when}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;border-top:1px dashed #555;border-bottom:1px dashed #555;font-size:15px">${lines}</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;font-size:14px">${extras}
<tr><td colspan="2" style="padding-top:8px;font-size:18px;font-weight:bold">TOTAL</td><td style="padding-top:8px;text-align:right;font-size:18px;font-weight:bold">${esc(euros(order.total))}</td></tr></table>
<p style="margin:12px 0 0;color:#c9c3b3;font-size:13px">Se paga en el local o al recibir el pedido.${delivery && order.address ? `<br>Entrega en: ${esc(order.address)}` : ''}</p>
${link ? button(link, 'VER CÓMO VA MI PEDIDO') : ''}
<p style="margin:20px 0 0;text-align:center;color:#c9c3b3;font-size:13px">¿Alguna duda? Llámanos al ${esc(location?.phones?.[0] || '')}</p>`)

  const text = [
    `La Pizza de Nonno - pedido ${order.ref} recibido.`,
    delivery ? (order.eta_at ? `Te lo llevamos hacia las ${hourOf(order.eta_at)}.` : '') : `Recógelo en ${location?.name || order.location_name}${order.ready_at ? ` a las ${hourOf(order.ready_at)}` : ''}.`,
    ...(order.items || []).map((i) => `${i.qty}x ${i.name} ${euros(i.total)}`),
    `TOTAL ${euros(order.total)}`,
    link ? `Sigue tu pedido: ${link}` : '',
  ].filter(Boolean).join('\n')

  return { subject: `Tu pedido ${order.ref} en La Pizza de Nonno`, html, text }
}

/** Correo para cambiar la contraseña. */
export function resetMail(link) {
  const html = frame(`
<p style="margin:0;text-align:center;font-size:20px;font-weight:bold">Cambia tu contraseña</p>
<p style="margin:12px 0 0;text-align:center;font-size:15px;color:#c9c3b3">Pulsa el botón para elegir una contraseña nueva. El enlace caduca en 1 hora.</p>
${button(link, 'ELEGIR CONTRASEÑA NUEVA')}
<p style="margin:20px 0 0;text-align:center;color:#8a8578;font-size:12px">Si no lo has pedido tú, ignora este correo: tu contraseña no cambia.</p>`)
  return {
    subject: 'Cambia tu contraseña de La Pizza de Nonno',
    html,
    text: `Para elegir una contraseña nueva entra aquí (caduca en 1 hora): ${link}\nSi no lo has pedido tú, ignora este correo.`,
  }
}
