import { hourOf } from './kitchenSlots.js'
import { STATIONS, stationOf } from '../data/menu.js'
import { LOGO_RASTER } from './escposLogo.js'
import { IVA_RATE, vatOf, fiscalOf } from './fiscal.js'
import { invoiceNumber } from './orderNumber.js'

/* ═══════════════════════════════════════════════════════════════
   TICKETS EN ESC/POS (impresoras térmicas de 80 mm, estilo Epson)

   El servidor genera aquí los bytes exactos que entiende la impresora
   y "Nonno Impresora" (el programa del local) solo los manda tal cual:
   sin Chrome, sin ventanas y con corte de papel y pitido. Cambiar el
   diseño de un ticket es cambiar este fichero; el programa del local
   no se toca.

   Ancho: 48 caracteres por línea en letra normal (576 puntos).
   Tildes y ñ: página de códigos WPC1252.
   ═══════════════════════════════════════════════════════════════ */

const COLS = 48
/* Propio (format.js no se puede importar desde el servidor): 12.5 → "12,50 €" */
export const price = (v) => `${(Number(v) || 0).toFixed(2).replace('.', ',')} €`
const ESC = 0x1b
const GS = 0x1d
const LF = 0x0a

/* Caracteres de fuera de Latin-1 que sí tiene la página 1252 */
const CP1252 = { '€': 0x80, '‚': 0x82, '„': 0x84, '…': 0x85, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '™': 0x99 }
const SWAP = { '→': '>', '←': '<', '×': 'x' }

function encode(text) {
  const out = []
  for (const ch of String(text ?? '').normalize('NFC')) {
    const c = SWAP[ch] ?? ch
    const code = c.codePointAt(0)
    if (code === 0xa0 || code === 0x202f) out.push(0x20) // espacios finos del formato de precios
    else if (code < 0x80) out.push(code)
    else if (CP1252[c]) out.push(CP1252[c])
    else if (code >= 0xa0 && code <= 0xff) out.push(code)
    else out.push(0x3f) // "?"
  }
  return out
}

/** Corta un texto en líneas de `width` caracteres sin partir palabras. */
export function wrap(text, width) {
  const lines = []
  for (const para of String(text ?? '').split('\n')) {
    let line = ''
    for (const word of para.split(/\s+/).filter(Boolean)) {
      if (!line) line = word
      else if (line.length + 1 + word.length <= width) line += ` ${word}`
      else { lines.push(line); line = word }
      while (line.length > width) { lines.push(line.slice(0, width)); line = line.slice(width) }
    }
    lines.push(line)
  }
  return lines
}

class Ticket {
  constructor() {
    this.b = [ESC, 0x40, ESC, 0x74, 16] // reiniciar + WPC1252
    this.w = 1
  }
  raw(...bytes) { this.b.push(...bytes); return this }
  align(a) { return this.raw(ESC, 0x61, { l: 0, c: 1, r: 2 }[a]) }
  bold(on) { return this.raw(ESC, 0x45, on ? 1 : 0) }
  invert(on) { return this.raw(GS, 0x42, on ? 1 : 0) }
  size(w = 1, h = w) { this.w = w; return this.raw(GS, 0x21, ((w - 1) << 4) | (h - 1)) }
  feed(n = 1) { for (let i = 0; i < n; i++) this.b.push(LF); return this }
  /** Texto con salto de línea, partido al ancho del tamaño actual. */
  line(text = '') {
    for (const l of wrap(text, Math.floor(COLS / this.w))) this.b.push(...encode(l), LF)
    return this
  }
  /** Una línea tal cual, sin partir ni quitar espacios (rótulos y recuadros). */
  put(text) { this.b.push(...encode(text), LF); return this }
  rule(ch = '-') { const w = this.w; this.size(1).line(ch.repeat(COLS)); return this.size(w) }
  /** Izquierda y derecha en la misma línea (p. ej. "2x Margarita ....... 19,00 €"). */
  cols(left, right) {
    const width = Math.floor(COLS / this.w)
    const r = String(right ?? '')
    const lines = wrap(left, width - r.length - 1)
    lines.forEach((l, i) => {
      const text = i === 0 ? l + ' '.repeat(Math.max(1, width - l.length - r.length)) + r : l
      this.b.push(...encode(text), LF)
    })
    return this
  }
  /** Rótulo en negativo a todo el ancho: ENTRANTES, PIZZAS · HORNO… */
  banner(text, w = 2) {
    const width = Math.floor(COLS / w)
    const t = String(text).slice(0, width)
    const pad = width - t.length
    const padded = ' '.repeat(Math.floor(pad / 2)) + t + ' '.repeat(Math.ceil(pad / 2))
    return this.align('c').size(w, w).bold(true).invert(true).put(padded).invert(false).bold(false).size(1).align('l')
  }
  /** Recuadro de una línea (para "PENDIENTE DE PAGO", "SIN CEBOLLA"…). */
  box(text) {
    const t = ` ${String(text).slice(0, COLS - 4)} `
    return this.align('c').bold(true).put(`+${'-'.repeat(t.length)}+`).put(`|${t}|`).put(`+${'-'.repeat(t.length)}+`).bold(false).align('l')
  }
  logo() { this.b.push(...Buffer.from(LOGO_RASTER, 'base64')); return this.feed() }
  qr(data, cell = 7) {
    const d = encode(data)
    const len = d.length + 3
    return this.align('c')
      .raw(GS, 0x28, 0x6b, 4, 0, 0x31, 0x41, 0x32, 0x00) // modelo 2
      .raw(GS, 0x28, 0x6b, 3, 0, 0x31, 0x43, cell) // tamaño del módulo
      .raw(GS, 0x28, 0x6b, 3, 0, 0x31, 0x45, 0x31) // corrección M
      .raw(GS, 0x28, 0x6b, len & 0xff, len >> 8, 0x31, 0x50, 0x30, ...d)
      .raw(GS, 0x28, 0x6b, 3, 0, 0x31, 0x51, 0x30) // imprimir
      .feed().align('l')
  }
  beep(times = 2) { return this.raw(ESC, 0x42, times, 2) }
  cut() { return this.feed(4).raw(GS, 0x56, 66, 0) }
  bytes() { return Uint8Array.from(this.b) }
}

export const hora = (iso) => new Date(iso).toLocaleString('es-ES', {
  timeZone: 'Europe/Madrid', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
})
export const CHANNEL = { mostrador: 'MOSTRADOR', telefono: 'TELÉFONO' }

/** Líneas del pedido por puesto de cocina, en el orden de STATIONS. */
export function sections(order) {
  const by = new Map()
  for (const item of order.items || []) {
    const key = stationOf(item.category) || 'otros'
    if (!by.has(key)) by.set(key, [])
    by.get(key).push(item)
  }
  return [...STATIONS, { id: 'otros', label: 'OTROS' }]
    .filter((s) => by.has(s.id))
    .map((s) => ({ id: s.id, label: s.label, items: by.get(s.id) }))
}

function head(t, order, { logo = false } = {}) {
  t.align('c')
  if (logo) t.logo()
  else t.size(2, 1).bold(true).line('LA PIZZA DE NONNO').bold(false).size(1)
  t.line(order.location_name || '').rule()
  t.size(3, 3).bold(true).line(order.ref).size(1)
  t.size(2, 1).line(`${order.mode === 'delivery' ? 'ENTREGA' : 'RECOGIDA'}${CHANNEL[order.channel] ? ` · ${CHANNEL[order.channel]}` : ''}`).size(1).bold(false)
  if (order.edited_at) t.feed().banner(`MODIFICADO ${hourOf(order.edited_at)}`, 1)
  t.align('c').line(`Pedido: ${hora(order.created_at)}`)
  if (order.ready_at) t.size(2, 2).bold(true).line(`PARA LAS ${hourOf(order.ready_at)}`).bold(false).size(1)
  if (order.mode === 'delivery' && order.eta_at) t.line(`Llega al cliente: ${hourOf(order.eta_at)}`)
  t.align('l').rule()
}

/** Líneas de comida. En cocina, letra doble para leerlo de lejos. */
function items(t, list, { kitchen }) {
  for (const i of list) {
    const name = `${i.qty}x ${i.name}${i.size ? ` (${i.size})` : ''}`
    if (kitchen) t.size(2, 2).bold(true).line(name).bold(false).size(1)
    else t.bold(true).cols(name, price(i.total)).bold(false)
    /* Lo que hay que QUITAR, en negativo: es el error más caro en cocina */
    if (i.removed?.length) {
      for (const l of wrap(`SIN ${i.removed.join(' · SIN ').toUpperCase()}`, COLS - 2)) t.bold(true).invert(true).put(` ${l} `).invert(false).bold(false)
    }
    if (i.extras?.length) t.bold(kitchen).line(`  + ${i.extras.join(', ')}`).bold(false)
    if (i.note) t.bold(true).line(`  "${i.note}"`).bold(false)
    if (kitchen) t.feed()
  }
}

export const paymentText = (order) => (order.payment_status === 'pagado'
  ? `PAGADO${order.payment_method ? ` · ${order.payment_method.toUpperCase()}` : ''}`
  : 'PENDIENTE DE PAGO')

/**
 * Comanda de cocina: una hoja por sección (entrantes, pizzas, bebidas),
 * cada una cortada para que cada puesto coja la suya. Pita al empezar.
 */
export function comandaBytes(order) {
  const t = new Ticket().beep(2)
  const list = sections(order)
  for (const s of list.length ? list : [{ id: 'todo', label: 'PEDIDO', items: order.items || [] }]) {
    head(t, order)
    t.banner(s.label)
    if (s.id === 'pizzas' && order.oven_slots?.length > 1) {
      t.feed().box(`HORNO: ${order.oven_slots.map((x) => `${hourOf(x.start)} > ${x.pizzas}`).join(' · ')}`)
    }
    t.feed()
    items(t, s.items, { kitchen: true })
    if (order.notes) t.bold(true).line(`NOTA: ${order.notes}`).bold(false)
    t.rule().align('c').line(order.customer_name || '').align('l')
    t.box(paymentText(order))
    t.cut()
  }
  return t.bytes()
}

/** Ticket del cliente: completo, con logo y totales. */
export function receiptBytes(order) {
  const t = new Ticket()
  head(t, order, { logo: true })
  const fiscal = fiscalOf(order.location_id)
  if (fiscal) t.align('c').line('FACTURA SIMPLIFICADA').line(`N.º ${invoiceNumber(order)}`).line(`${fiscal.name} · NIF ${fiscal.nif}`).line(fiscal.address || '').align('l').rule()
  items(t, order.items || [], { kitchen: false })
  t.rule()
  const discount = Number(order.discount) || 0
  const fee = Number(order.delivery_fee) || 0
  const points = Number(order.points_discount) || 0
  if (discount || fee || points) {
    t.cols('Subtotal', price(order.subtotal))
    for (const d of order.deals || []) t.line(`Oferta ${d.count > 1 ? `${d.count}x ` : ''}${d.label} por ${price(d.price)}`)
    if (discount) t.cols('Dto. recogida', `-${price(discount)}`)
    if (points) t.cols(`Puntos Club Nonno (${Number(order.points_redeemed) || 0})`, `-${price(points)}`)
    if (fee) t.cols(`Envío ${order.delivery_zone || ''}`, `+${price(fee)}`)
  }
  t.size(2, 2).bold(true).cols('TOTAL', price(order.total)).bold(false).size(1)
  const tax = vatOf(order.total)
  t.cols(`Base imponible (IVA ${IVA_RATE} %)`, price(tax.base)).cols(`IVA ${IVA_RATE} % incluido`, price(tax.iva)).rule()
  t.bold(true).line(`${order.customer_name || ''}${order.customer_phone ? ` · Tel: ${order.customer_phone}` : ''}`).bold(false)
  if (order.address) t.line(`Dir: ${order.address}`)
  if (order.delivery_zone) t.bold(true).line(`DISTANCIA: ${order.delivery_zone.toUpperCase()}`).bold(false)
  if (order.delivery_verified === false) t.box('DIRECCIÓN SIN VERIFICAR · LLAMAR')
  if (order.notes) t.line(`Notas: ${order.notes}`)
  t.box(paymentText(order))
  t.rule().align('c').bold(true).line('¡Gracias por elegir a Nonno!').bold(false)
  return t.cut().bytes()
}

/** Aviso a cocina de que un pedido ya impreso se ha cancelado. */
export function cancelBytes(order) {
  return new Ticket().beep(3).align('c')
    .size(2, 2).bold(true).line('CANCELADO').size(3, 3).line(order.ref).size(1).bold(false)
    .line(order.customer_name || '').line(`Cancelado a las ${hourOf(new Date())}`)
    .feed().box('NO PREPARAR · TIRAR LA COMANDA')
    .cut().bytes()
}

/** Hoja de prueba desde el panel (Impresoras → Imprimir prueba). */
export function testBytes(label) {
  return new Ticket().beep(1).align('c').logo()
    .size(2, 2).bold(true).line('PRUEBA').size(1).bold(false)
    .line(label).line(hora(new Date().toISOString()))
    .line('Tildes: áéíóú ñ Ñ ¿? ¡! €').rule()
    .line('Si lees esto, Nonno Impresora funciona.')
    .cut().bytes()
}
