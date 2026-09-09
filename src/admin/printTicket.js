import { price } from '../lib/format'

/* ═══════════════════════════════════════════════════════════════
   Impresión del ticket de cocina.

   Se abre una ventana con el ticket maquetado a 80 mm (el ancho
   estándar de las impresoras térmicas) y se lanza el diálogo de
   impresión. Sale igual de bien en A4 si no hay térmica.
   ═══════════════════════════════════════════════════════════════ */

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ))

const hora = (iso) =>
  new Date(iso).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })

export function buildTicketHtml(order) {
  const lines = (order.items || []).map((i) => `
    <tr>
      <td class="qty">${i.qty}×</td>
      <td>
        <strong>${esc(i.name)}</strong>
        ${i.size ? `<div class="sub">${esc(i.size)}</div>` : ''}
        ${i.extras?.length ? `<div class="sub">+ ${esc(i.extras.join(', '))}</div>` : ''}
        ${i.note ? `<div class="note">“${esc(i.note)}”</div>` : ''}
      </td>
      <td class="amount">${esc(price(i.total))}</td>
    </tr>`).join('')

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<title>Pedido ${esc(order.ref)}</title>
<style>
  @page { size: 80mm auto; margin: 4mm; }
  /* Papel siempre blanco: el ticket no debe heredar el modo oscuro
     del navegador ni en la vista previa ni al imprimir. */
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  html, body { background: #fff; }
  body {
    width: 72mm; margin: 0 auto; padding: 4mm 0;
    font-family: "Courier New", monospace; font-size: 12px; line-height: 1.35; color: #000;
  }
  h1 { font-size: 15px; margin: 0; letter-spacing: .5px; }
  .center { text-align: center; }
  .rule { border-top: 1px dashed #000; margin: 7px 0; }
  .big { font-size: 20px; font-weight: bold; }
  .mode { font-size: 15px; font-weight: bold; text-transform: uppercase; }
  table { width: 100%; border-collapse: collapse; }
  td { vertical-align: top; padding: 3px 0; }
  .qty { width: 26px; font-weight: bold; }
  .amount { text-align: right; white-space: nowrap; padding-left: 4px; }
  .sub { font-size: 11px; }
  .note { font-size: 11px; font-weight: bold; }
  .total { display: flex; justify-content: space-between; font-size: 16px; font-weight: bold; }
  .field { margin: 2px 0; }
  .foot { font-size: 11px; text-align: center; margin-top: 8px; }
</style></head>
<body>
  <div class="center">
    <h1>LA PIZZA DE NONNO</h1>
    <div>${esc(order.location_name || '')}</div>
  </div>

  <div class="rule"></div>
  <div class="center big">${esc(order.ref)}</div>
  <div class="center mode">${order.mode === 'delivery' ? 'ENTREGA' : 'RECOGIDA'}</div>
  <div class="center">${esc(hora(order.created_at))}</div>
  <div class="rule"></div>

  <table>${lines}</table>

  <div class="rule"></div>
  <div class="total"><span>TOTAL</span><span>${esc(price(order.total))}</span></div>
  <div class="rule"></div>

  <div class="field"><strong>${esc(order.customer_name)}</strong></div>
  <div class="field">Tel: ${esc(order.customer_phone)}</div>
  ${order.address ? `<div class="field">Dir: ${esc(order.address)}</div>` : ''}
  ${order.notes ? `<div class="field">Notas: ${esc(order.notes)}</div>` : ''}

  <div class="rule"></div>
  <div class="foot">PAGO EN EL LOCAL O EN LA ENTREGA<br>Esta web no cobra el pedido</div>
</body></html>`
}

/** Abre el ticket y lanza la impresión. Devuelve false si el navegador la bloqueó. */
export function printTicket(order) {
  const win = window.open('', '_blank', 'width=380,height=640')
  if (!win) return false

  win.document.write(buildTicketHtml(order))
  win.document.close()
  win.focus()

  /* Damos un instante a que aplique los estilos antes de imprimir. */
  setTimeout(() => {
    win.print()
    win.close()
  }, 250)

  return true
}
