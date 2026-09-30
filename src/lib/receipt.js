import { SITE } from '../data/site'
import { getLocation } from '../data/locations'
import { price } from './format'
import { invoiceNumber } from './orderNumber'
import { LOYALTY } from '../data/loyalty'

/* ═══════════════════════════════════════════════════════════════
   Tique del cliente (factura simplificada / justificante)

   Se abre en una ventana aparte lista para imprimir o guardar en PDF
   ("Imprimir → Guardar como PDF" en el móvil o el ordenador). Los
   importes son los que guardó el servidor, no se recalculan aquí.
   ═══════════════════════════════════════════════════════════════ */

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

const STATUS = { nuevo: 'En preparación', horno: 'En preparación', listo: 'Listo', entregado: 'Entregado', cancelado: 'Cancelado' }

function html(order) {
  const { legalName, nif, vatRate } = SITE.billing || {}
  const isInvoice = Boolean(legalName && nif)
  const location = getLocation(order.location_id)
  const date = new Date(order.created_at).toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Madrid' })
  const total = Number(order.total) || 0
  const base = total / (1 + (vatRate || 0))
  const row = (label, value, cls = '') => `<tr class="${cls}"><td>${label}</td><td class="num">${value}</td></tr>`

  const items = (order.items || []).map((i) => `
    <tr><td>${esc(i.qty)}× ${esc(i.name)}${i.size ? ` <small>(${esc(i.size)})</small>` : ''}
      ${i.extras?.length ? `<br><small>+ ${esc(i.extras.join(', '))}</small>` : ''}
      ${i.removed?.length ? `<br><small>Sin ${esc(i.removed.join(', sin '))}</small>` : ''}
    </td><td class="num">${esc(price(i.total))}</td></tr>`).join('')

  const lines = [
    row('Subtotal', esc(price(order.subtotal ?? total))),
    Number(order.discount) > 0 ? row('Descuento recogida', `−${esc(price(order.discount))}`) : '',
    Number(order.points_discount) > 0 ? row(`Puntos ${LOYALTY.name} (${esc(order.points_redeemed)})`, `−${esc(price(order.points_discount))}`) : '',
    Number(order.delivery_fee) > 0 ? row('Envío', `+${esc(price(order.delivery_fee))}`) : '',
  ].join('')

  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>${isInvoice ? `Factura simplificada ${esc(invoiceNumber(order))}` : `Justificante ${esc(order.ref)}`}</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1d2b4f;max-width:26rem;margin:2rem auto;padding:0 1rem}
  h1{font-size:1.25rem;margin:0}.muted{color:#6b7280;font-size:.85rem;margin:.15rem 0}
  .box{border:1px solid #e23e57;border-radius:8px;padding:1rem;margin-top:1rem}
  table{width:100%;border-collapse:collapse;font-size:.9rem}td{padding:.3rem 0;vertical-align:top}
  .num{text-align:right;white-space:nowrap}.total td{font-weight:700;font-size:1.1rem;border-top:1px solid #1d2b4f;padding-top:.5rem}
  small{color:#6b7280}.doc{font-weight:700;color:#e23e57;text-transform:uppercase;letter-spacing:.08em;font-size:.8rem}
  button{margin-top:1.25rem;width:100%;padding:.8rem;border:0;border-radius:6px;background:#e23e57;color:#fff;font-weight:700;font-size:1rem}
  @media print{button{display:none}body{margin:0}}
</style></head><body>
  <p class="doc">${isInvoice ? 'Factura simplificada' : 'Justificante de pedido'}</p>
  <h1>La Pizza de Nonno · ${esc(location?.name || order.location_name)}</h1>
  ${isInvoice ? `<p class="muted">${esc(legalName)} · NIF ${esc(nif)}</p>` : ''}
  ${location?.address ? `<p class="muted">${esc(location.address)}</p>` : ''}
  ${location?.phones?.[0] ? `<p class="muted">Tel. ${esc(location.phones[0])}</p>` : ''}

  <div class="box">
    <p class="muted"><strong>Pedido ${esc(order.ref)}</strong> · ${esc(date)}</p>
    ${isInvoice ? `<p class="muted">Factura nº ${esc(invoiceNumber(order))}</p>` : ''}
    <p class="muted">${order.mode === 'delivery' ? 'Entrega a domicilio' : 'Recogida en el local'} · ${esc(STATUS[order.status] || order.status)}</p>
    ${order.customer_name ? `<p class="muted">Cliente: ${esc(order.customer_name)}</p>` : ''}
  </div>

  <div class="box"><table>${items}</table></div>

  <div class="box"><table>
    ${lines}
    ${isInvoice ? row(`Base imponible`, esc(price(base))) + row(`IVA ${Math.round((vatRate || 0) * 100)} %`, esc(price(total - base))) : ''}
    ${row('TOTAL', esc(price(total)), 'total')}
  </table>
  <p class="muted">${isInvoice ? '' : 'IVA incluido. '}${order.payment_status === 'pagado' ? `Pagado${order.payment_method ? ` · ${esc(order.payment_method)}` : ''}` : 'Pago en el local o al recibir el pedido'}</p>
  </div>

  <button onclick="window.print()">Imprimir o guardar en PDF</button>
</body></html>`
}

export const receiptHtml = html

/**
 * Abre el tique de un pedido en una ventana nueva. Si el navegador
 * bloquea la ventana, lo imprime desde un marco oculto de la página.
 */
export function openReceipt(order) {
  const win = window.open('', '_blank')
  if (win) {
    win.document.write(html(order))
    win.document.close()
    return
  }
  const frame = document.createElement('iframe')
  frame.style.cssText = 'position:fixed;width:0;height:0;border:0;right:0;bottom:0'
  frame.srcdoc = html(order)
  frame.onload = () => {
    frame.contentWindow.print()
    setTimeout(() => frame.remove(), 60_000)
  }
  document.body.appendChild(frame)
}
