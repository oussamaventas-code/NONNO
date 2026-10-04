import { price } from '../lib/format'
import { STATIONS, stationOf } from '../data/menu'
import { hourOf } from '../lib/kitchenSlots'
import qrcode from 'qrcode-generator'
import { queuePrint } from './api'
/* Logo en blanco y negro puro (la versión neón tiene fondo negro y en
   térmica saldría un borrón). Va incrustado: imprime aunque no haya red. */
import logoTicket from '../assets/logo-ticket.png?inline'

/* ═══════════════════════════════════════════════════════════════
   Impresión del ticket de cocina.

   La comanda de cocina sale en UNA etiqueta por sección con líneas
   (entrantes, pizzas, bebidas): cada puesto coge solo la suya y no
   tiene que leer el pedido entero. El ticket completo con todo el
   pedido es el del cliente, que lo saca el TPV.

   Cada ticket ocupa el ancho del papel del driver (rollo de 80 mm o
   etiqueta de 10×15) y se imprime por separado. El navegador imprime en la
   impresora predeterminada de ESE equipo: el ordenador de cocina
   saca comandas y el del mostrador tickets de cliente. Con Chrome en
   modo kiosco (--kiosk-printing) salen sin diálogo.
   ═══════════════════════════════════════════════════════════════ */

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ))

const hora = (iso) =>
  new Date(iso).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })

/** Agrupa las líneas del pedido por puesto de cocina, en el orden de STATIONS. */
function sections(order) {
  const byStation = new Map()
  ;(order.items || []).forEach((item) => {
    const key = stationOf(item.category) || 'otros'
    if (!byStation.has(key)) byStation.set(key, [])
    byStation.get(key).push(item)
  })

  const ordered = [...STATIONS, { id: 'otros', label: 'OTROS' }]
  return ordered
    .filter((s) => byStation.has(s.id))
    .map((s) => ({ id: s.id, label: s.label, items: byStation.get(s.id) }))
}

function itemsTable(items) {
  return items.map((i) => `
    <tr>
      <td class="qty">${i.qty}×</td>
      <td>
        <strong>${esc(i.name)}</strong>${i.size ? ` <span class="sub">${esc(i.size)}</span>` : ''}
        ${i.removed?.length ? `<div class="remove">SIN ${esc(i.removed.join(' · SIN ').toUpperCase())}</div>` : ''}
        ${i.extras?.length ? `<div class="sub">+ ${esc(i.extras.join(', '))}</div>` : ''}
        ${i.note ? `<div class="note">"${esc(i.note)}"</div>` : ''}
      </td>
      <td class="amount">${esc(price(i.total))}</td>
    </tr>`).join('')
}

const STYLE = `
  /* Siempre en vertical y con el papel que tenga el driver de la
     impresora (rollo de 80 mm o etiqueta de 10×15): así Chrome no lo
     gira en horizontal ni lo encoge a un ancho que no es el suyo. */
  @page { size: portrait; margin: 2mm 3mm; }
  /* Papel siempre blanco: el ticket no debe heredar el modo oscuro
     del navegador ni en la vista previa ni al imprimir. */
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  html, body { background: #fff; }
  body {
    width: 100%; max-width: 100mm; margin: 0 auto; padding: 0;
    font-family: "Courier New", monospace; font-size: 12px; line-height: 1.25; color: #000;
  }
  h1 { font-size: 15px; margin: 0; letter-spacing: .5px; }
  .center { text-align: center; }
  .rule { border-top: 1px dashed #000; margin: 5px 0; }
  .big { font-size: 20px; font-weight: bold; }
  .mode { font-size: 15px; font-weight: bold; text-transform: uppercase; }
  .section { font-size: 16px; font-weight: bold; text-align: center; border: 2px solid #000; padding: 3px 0; margin: 6px 0; }
  .part { font-size: 11px; text-align: center; color: #333; }
  table { width: 100%; border-collapse: collapse; }
  td { vertical-align: top; padding: 2px 0; }
  /* Si el ticket no cabe en una etiqueta, que no parta una línea por la mitad. */
  tr, .total, .payment, .field { break-inside: avoid; }
  .qty { width: 26px; font-weight: bold; }
  .amount { text-align: right; white-space: nowrap; padding-left: 4px; }
  .sub { font-size: 11px; }
  .note { font-size: 11px; font-weight: bold; }
  /* Lo que hay que QUITAR se lee de un vistazo: es el error más caro
     en cocina. Recuadrado y en negrita, no una línea más. */
  .remove {
    font-size: 12px; font-weight: bold;
    border: 1.5px solid #000; padding: 1px 4px; margin: 2px 0;
    display: inline-block;
  }
  .total { display: flex; justify-content: space-between; font-size: 16px; font-weight: bold; }
  .payment { text-align: center; font-size: 13px; font-weight: bold; border: 1.5px solid #000; padding: 3px 0; margin: 6px 0; }
  .field { margin: 2px 0; }
  .foot { font-size: 11px; text-align: center; margin-top: 8px; }
  .logo { display: block; width: 20mm; margin: 0 auto 1px; }
  .qr { text-align: center; margin: 6px 0 2px; }
  .qr svg { width: 30mm; height: 30mm; }
  .qr div { font-size: 10px; }
  .thanks { font-size: 13px; font-weight: bold; text-align: center; margin-top: 4px; }
`

function ticketHead(order, { sectionLabel, part, logo } = {}) {
  return `
  <div class="center">
    ${logo ? `<img class="logo" src="${logoTicket}" alt="La Pizza de Nonno">` : '<h1>LA PIZZA DE NONNO</h1>'}
    <div>${esc(order.location_name || '')}</div>
  </div>

  <div class="rule"></div>
  <div class="center big">${esc(order.ref)}</div>
  <div class="center mode">${order.mode === 'delivery' ? 'ENTREGA' : 'RECOGIDA'}${CHANNEL[order.channel] ? ` · ${CHANNEL[order.channel]}` : ''}</div>
  ${order.edited_at ? `<div class="section">MODIFICADO ${esc(hourOf(order.edited_at))}</div>` : ''}
  <div class="center">Pedido: ${esc(hora(order.created_at))}</div>
  ${order.ready_at ? `<div class="center big">PARA LAS ${esc(hourOf(order.ready_at))}</div>` : ''}
  ${order.mode === 'delivery' && order.eta_at ? `<div class="center">Llega al cliente: ${esc(hourOf(order.eta_at))}</div>` : ''}
  ${part ? `<div class="part">TICKET ${part}</div>` : ''}
  <div class="rule"></div>
  ${sectionLabel ? `<div class="section">${esc(sectionLabel)}</div>` : ''}`
}

const CHANNEL = { mostrador: 'MOSTRADOR', telefono: 'TELÉFONO' }

function ticketFoot(order, { full, customer }) {
  const paymentLine = `<div class="payment">${order.payment_status === 'pagado'
    ? `PAGADO${order.payment_method ? ` · ${esc(order.payment_method.toUpperCase())}` : ''}`
    : 'PENDIENTE DE PAGO'}</div>`
  return `
  ${full ? `
  <div class="field"><strong>${esc(order.customer_name)}</strong>${order.customer_phone ? ` · Tel: ${esc(order.customer_phone)}` : ''}</div>
  ${order.address ? `<div class="field">Dir: ${esc(order.address)}</div>` : ''}
  ${order.delivery_zone ? `<div class="field"><strong>DISTANCIA: ${esc(order.delivery_zone.toUpperCase())}</strong></div>` : ''}
  ${order.delivery_verified === false ? '<div class="payment">DIRECCIÓN SIN VERIFICAR · LLAMAR AL CLIENTE</div>' : ''}
  ${order.notes ? `<div class="field">Notas: ${esc(order.notes)}</div>` : ''}
  ` : `<div class="field center">${esc(order.customer_name)}</div>`}
  ${paymentLine}
  <div class="rule"></div>
  ${customer
    ? '<div class="thanks">¡Gracias por elegir a Nonno!</div>'
    : '<div class="foot">Gracias por elegir a Nonno</div>'}`
}

function page(title, body) {
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>${STYLE}</style></head>
<body>${body}</body></html>`
}

/** Subtotal, oferta de recogida, puntos y envío, solo si hay algo que desglosar. */
function breakdown(order) {
  const discount = Number(order.discount) || 0
  const fee = Number(order.delivery_fee) || 0
  const points = Number(order.points_discount) || 0
  if (!discount && !fee && !points) return ''
  const row = (label, value) => `<div class="field" style="display:flex;justify-content:space-between"><span>${label}</span><span>${value}</span></div>`
  return [
    row('Subtotal', esc(price(order.subtotal))),
    ...(order.deals || []).map((d) => `<div class="sub">Oferta ${d.count > 1 ? `${d.count}x ` : ''}${esc(d.label)} por ${esc(price(d.price))}</div>`),
    discount ? row('Dto. recogida', `-${esc(price(discount))}`) : '',
    points ? row(`Puntos Club Nonno (${Number(order.points_redeemed) || 0})`, `-${esc(price(points))}`) : '',
    fee ? row(`Envío ${esc(order.delivery_zone || '')}`, `+${esc(price(fee))}`) : '',
  ].join('')
}

/** Ticket completo: todas las líneas juntas, tal y como era antes. */
export function buildTicketHtml(order) {
  const body = `
    ${ticketHead(order, { part: sections(order).length > 1 ? 'COMPLETO' : null })}
    <table>${itemsTable(order.items || [])}</table>
    <div class="rule"></div>
    ${breakdown(order)}
    <div class="total"><span>TOTAL</span><span>${esc(price(order.total))}</span></div>
    <div class="rule"></div>
    ${ticketFoot(order, { full: true })}`
  return page(`Pedido ${order.ref}`, body)
}

/** Un ticket por sección (entrantes / pizzas / bebidas / ...). */
export function buildSectionTicketHtml(order, section) {
  /* En la comanda del horno, si el pedido va en varios tramos, cuántas
     pizzas meter en cada uno (el primero es el que hay que empezar ya) */
  const split = section.id === 'pizzas' && order.oven_slots?.length > 1
    ? `<div class="payment">HORNO: ${order.oven_slots.map((s) => `${esc(hourOf(s.start))} → ${s.pizzas}`).join(' · ')}</div>`
    : ''
  const body = `
    ${ticketHead(order, { sectionLabel: section.label })}
    ${split}
    <table>${itemsTable(section.items)}</table>
    <div class="rule"></div>
    ${ticketFoot(order, { full: false })}`
  return page(`Pedido ${order.ref} · ${section.label}`, body)
}

/** Comanda de cocina: una etiqueta por sección con líneas, en el orden de STATIONS. */
export function buildTicketSet(order) {
  const set = sections(order).map((s) => ({ label: s.label, html: buildSectionTicketHtml(order, s) }))
  /* Un pedido sin líneas (no debería pasar) saca al menos el completo. */
  return set.length ? set : [{ label: 'COMPLETO', html: buildTicketHtml(order) }]
}

/* Un único trabajo de impresión a la vez: si entran dos pedidos
   seguidos, sus tickets salen en orden y no mezclados. */
let queue = Promise.resolve()

/**
 * Imprime un ticket desde un iframe oculto. A diferencia de una
 * ventana nueva, no lo bloquea el navegador aunque no venga de un
 * clic (impresión automática de comandas).
 */
function printOne(html) {
  const job = () => new Promise((resolve) => {
    const frame = document.createElement('iframe')
    frame.setAttribute('aria-hidden', 'true')
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden'
    document.body.appendChild(frame)
    const doc = frame.contentDocument
    doc.open()
    doc.write(html)
    doc.close()

    /* Espera a que carguen las imágenes (el logo) y un instante para
       que apliquen los estilos antes de imprimir. */
    const images = [...doc.images].map((img) => img.complete ? null
      : new Promise((done) => { img.onload = img.onerror = done }))
    const loaded = Promise.race([
      Promise.all(images),
      new Promise((done) => setTimeout(done, 2000)),
    ])
    loaded.then(() => setTimeout(() => {
      let ok = true
      try {
        frame.contentWindow.focus()
        frame.contentWindow.print()
      } catch {
        ok = false
      }
      setTimeout(() => { frame.remove(); resolve(ok) }, 500)
    }, 250))
  })
  queue = queue.then(job, job)
  return queue
}

/** Cualquier otra hoja a 80 mm (p. ej. la lista de la compra). `bodyHtml` ya viene escapado. */
export const printDocument = (title, bodyHtml) => printOne(page(title, bodyHtml))

/** Ticket de cliente del mostrador: un único ticket completo, sin secciones de cocina. */
/**
 * QR del repartidor: va en el ticket de los pedidos a domicilio. Al
 * llegar a la casa lo escanea con la cámara del móvil, se abre su
 * portal con ESE pedido y marca entregado y cobrado (efectivo/tarjeta).
 */
export function driverQr(order) {
  if (order.mode !== 'delivery' || !/^[0-9a-f-]{36}$/i.test(String(order.id || '')) || typeof window === 'undefined') return ''
  const qr = qrcode(0, 'M')
  qr.addData(`${window.location.origin}/repartidor?p=${order.id}`)
  qr.make()
  return `<div class="qr">${qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true })}<div>REPARTIDOR: ESCANEA AL ENTREGAR</div></div>`
}

export function buildReceiptHtml(order) {
  const body = `
    ${ticketHead(order, { logo: true })}
    <table>${itemsTable(order.items || [])}</table>
    <div class="rule"></div>
    ${breakdown(order)}
    <div class="total"><span>TOTAL</span><span>${esc(price(order.total))}</span></div>
    <div class="rule"></div>
    ${ticketFoot(order, { full: true, customer: true })}
    ${driverQr(order)}`
  return page(`Ticket ${order.ref}`, body)
}

/* ── Nonno Impresora ────────────────────────────────────────────
   Si el local tiene instalado el programa de impresión, los papeles
   los imprime él (sin Chrome): aquí solo se piden a la cola. Si no lo
   tiene, se imprime desde el navegador como siempre. El panel avisa
   de qué sedes lo tienen con cada carga de pedidos. */
let agents = {}
export const setPrintAgents = (map) => { agents = map || {} }
/** ¿Imprime este pedido el programa del local? (los pedidos sin enviar, no) */
export const viaAgent = (order) => Boolean(agents[order?.location_id]) && /^[0-9a-f-]{36}$/i.test(String(order?.id || ''))

const browserReceipt = (order) => printOne(buildReceiptHtml(order))
async function browserTicket(order) {
  const results = await Promise.all(buildTicketSet(order).map((t) => printOne(t.html)))
  return results.every(Boolean)
}

/** Ticket del cliente: al programa del local si lo hay; si falla, por el navegador. */
export async function printReceipt(order, { browser = false } = {}) {
  if (!browser && viaAgent(order)) {
    try { if ((await queuePrint(order.id, 'ticket')).queued) return true } catch { /* plan B: navegador */ }
  }
  return browserReceipt(order)
}

/**
 * Comanda de cocina (una hoja por sección). Devuelve false si el
 * navegador bloqueó la impresión.
 */
export async function printTicket(order, { browser = false } = {}) {
  if (!browser && viaAgent(order)) {
    try { if ((await queuePrint(order.id, 'comanda')).queued) return true } catch { /* plan B: navegador */ }
  }
  return browserTicket(order)
}
