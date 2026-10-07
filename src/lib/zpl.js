import { hourOf } from './kitchenSlots.js'
import { LOGO_RASTER } from './escposLogo.js'
import { price, wrap, hora, CHANNEL, sections, paymentText } from './escpos.js'
import { IVA_RATE, vatOf, fiscalOf } from './fiscal.js'
import { invoiceNumber } from './orderNumber.js'

/* ═══════════════════════════════════════════════════════════════
   ETIQUETAS EN ZPL (Zebra GC420t y compañía, 10×15 cm, 203 ppp)

   Los mismos papeles que escpos.js pero en el idioma de las Zebra:
   cada papel es una o varias etiquetas de 800×1199 puntos. Si un
   pedido no cabe, sigue en otra etiqueta con "(sigue)". Las Zebra no
   pitan ni cortan: se arranca la etiqueta a mano.
   ═══════════════════════════════════════════════════════════════ */

const W = 800 // 10 cm
const H = 1199 // 15 cm
const M = 24 // margen
const CW = 0.58 // ancho medio de una letra de la fuente 0, respecto a su alto (por lo alto)
const S = { s: 26, m: 32, l: 44, xl: 60, xxl: 110 }

/* ^ y ~ son órdenes en ZPL: nunca pueden ir dentro de un texto */
const clean = (t) => String(t ?? '').normalize('NFC').replace(/[\^~]/g, ' ').replace(/[  ]/g, ' ')
const fits = (width, size) => Math.max(4, Math.floor(width / (size * CW)))

/* Logo de escposLogo.js (GS v 0 = cabecera de 8 bytes + puntos, 1 = negro, igual que ^GF) */
const LOGO = (() => {
  const b = Buffer.from(LOGO_RASTER, 'base64')
  const row = b[4] | (b[5] << 8)
  const rows = b[6] | (b[7] << 8)
  const hex = b.subarray(8, 8 + row * rows).toString('hex').toUpperCase()
  return { row, rows, dots: row * 8, hex }
})()

class Label {
  constructor(more) {
    this.pages = []
    this.cur = []
    this.y = M
    this.more = more // texto de cabecera si sigue en otra etiqueta
    this.side = 0 // ancho reservado a la derecha (QR al lado del texto)
    this.left = 0 // ancho reservado a la izquierda (logo al lado del número)
  }
  get width() { return W - 2 * M - this.side - this.left }
  get x() { return M + this.left }
  need(h) {
    if (this.y + h <= H - M || !this.cur.length) return this
    this.pages.push(this.cur)
    this.cur = []
    this.y = M
    if (this.more) this.text(`${this.more} (sigue)`, { size: S.m, align: 'C' }).rule()
    return this
  }
  gap(n = 12) { this.y += n; return this }
  /** Texto partido al ancho; align L | C | R. */
  text(t, { size = S.m, align = 'L' } = {}) {
    for (const l of wrap(clean(t), fits(this.width, size))) {
      this.need(size + 6)
      this.cur.push(`^FO${this.x},${this.y}^A0N,${size},${size}^FB${this.width},1,0,${align}^FD${l}^FS`)
      this.y += size + Math.round(size * 0.22)
    }
    return this
  }
  /** Izquierda y derecha en la misma línea (precio a la derecha). */
  cols(left, right, size = S.m) {
    const r = clean(right)
    const rw = Math.ceil(r.length * size * CW) + 12
    const lines = wrap(clean(left), fits(W - 2 * M - rw, size))
    lines.forEach((l, i) => {
      this.need(size + 6)
      this.cur.push(`^FO${M},${this.y}^A0N,${size},${size}^FD${l}^FS`)
      if (i === 0) this.cur.push(`^FO${M},${this.y}^A0N,${size},${size}^FB${W - 2 * M},1,0,R^FD${r}^FS`)
      this.y += size + Math.round(size * 0.22)
    })
    return this
  }
  rule(th = 3) {
    this.need(th + 16).gap(4)
    this.cur.push(`^FO${M},${this.y}^GB${W - 2 * M},${th},${th}^FS`)
    return this.gap(th + 12)
  }
  /** Rótulo en negativo a todo el ancho: ENTRANTES, SIN CEBOLLA… */
  banner(t, size = S.xl) {
    for (const l of wrap(clean(t), fits(W - 2 * M - 20, size))) {
      const h = size + 20
      this.need(h + 8)
      this.cur.push(`^FO${M},${this.y}^GB${W - 2 * M},${h},${h}^FS`)
      this.cur.push(`^FO${M},${this.y + 12}^A0N,${size},${size}^FB${W - 2 * M},1,0,C^FR^FD${l}^FS`)
      this.y += h + 8
    }
    return this
  }
  /** Recuadro (PENDIENTE DE PAGO, NO PREPARAR…). */
  box(t, size = S.l) {
    const lines = wrap(clean(t), fits(this.width - 40, size))
    const h = lines.length * (size + 8) + 24
    this.need(h + 10)
    this.cur.push(`^FO${M},${this.y}^GB${this.width},${h},4^FS`)
    lines.forEach((l, i) => this.cur.push(`^FO${M},${this.y + 14 + i * (size + 8)}^A0N,${size},${size}^FB${this.width},1,0,C^FD${l}^FS`))
    return this.gap(h + 10)
  }
  /** Logo centrado o, con fn, a la izquierda y lo que escriba fn() a su derecha. */
  logo(fn) {
    this.need(LOGO.rows + 10)
    const total = LOGO.row * LOGO.rows
    const y0 = this.y
    this.cur.push(`^FO${fn ? M : Math.round((W - LOGO.dots) / 2)},${y0}^GFA,${total},${total},${LOGO.row},${LOGO.hex}^FS`)
    if (!fn) return this.gap(LOGO.rows + 10)
    this.left = LOGO.dots + 16
    fn(this)
    this.left = 0
    this.y = Math.max(this.y, y0 + LOGO.rows + 6)
    return this
  }
  /**
   * QR a la derecha y, a su izquierda, lo que escriba fn() (más estrecho).
   * Todo en la misma etiqueta.
   */
  qrBeside(data, caption, fn, mag = 4) {
    const side = 41 * mag // hasta versión 6 (URLs de ~100 letras)
    this.need(side + 8 + caption.length * 22)
    const y0 = this.y
    this.cur.push(`^FO${W - M - side},${y0}^BQN,2,${mag}^FDMA,${clean(data)}^FS`)
    caption.forEach((c, i) => this.cur.push(`^FO${W - M - side - 10},${y0 + side + 4 + i * 22}^A0N,20,20^FB${side + 10},1,0,C^FD${clean(c)}^FS`))
    this.side = side + 20
    fn(this)
    this.side = 0
    this.y = Math.max(this.y, y0 + side + 8 + caption.length * 22)
    return this
  }
  bytes() {
    const pages = this.cur.length ? [...this.pages, this.cur] : this.pages
    /* ^CI28 = UTF-8 · ^MTD = térmico directo (sin cinta) · ^MNY = etiquetas con hueco */
    const zpl = pages.map((p) => `^XA^CI28^MTD^MNY^PW${W}^LL${H}^LH0,0^PON\n${p.join('\n')}\n^XZ`).join('\n')
    return new TextEncoder().encode(zpl)
  }
}

/* En el ticket del cliente (logo) va más apretado para que quepa en una etiqueta */
function head(t, order, { logo = false } = {}) {
  const mode = `${order.mode === 'delivery' ? 'ENTREGA' : 'RECOGIDA'}${CHANNEL[order.channel] ? ` · ${CHANNEL[order.channel]}` : ''}`
  const eta = order.mode === 'delivery' && order.eta_at ? `Llega al cliente: ${hourOf(order.eta_at)}` : ''
  if (logo) {
    /* Logo a la izquierda y el pedido a su lado: ahorra media etiqueta */
    t.logo((t) => {
      t.text(order.location_name || '', { size: S.s, align: 'C' })
      t.text(order.ref, { size: 72, align: 'C' })
      t.text(mode, { size: S.m, align: 'C' })
      if (order.ready_at) t.text(`PARA LAS ${hourOf(order.ready_at)}`, { size: S.m, align: 'C' })
      t.text(`Pedido: ${hora(order.created_at)}`, { size: 22, align: 'C' })
      if (eta) t.text(eta, { size: 22, align: 'C' })
    })
    if (order.edited_at) t.banner(`MODIFICADO ${hourOf(order.edited_at)}`, S.s)
  } else {
    t.text(`LA PIZZA DE NONNO · ${order.location_name || ''}`, { size: S.m, align: 'C' }).rule()
    t.text(order.ref, { size: 96, align: 'C' })
    t.text(mode, { size: S.m, align: 'C' })
    if (order.edited_at) t.banner(`MODIFICADO ${hourOf(order.edited_at)}`, S.m)
    if (order.ready_at) t.text(`PARA LAS ${hourOf(order.ready_at)}`, { size: 56, align: 'C' })
    t.text(`Pedido: ${hora(order.created_at)}${eta ? ` · ${eta}` : ''}`, { size: S.s, align: 'C' })
  }
  t.rule()
}

function items(t, list, { kitchen }) {
  for (const i of list) {
    const name = `${i.qty}x ${i.name}${i.size ? ` (${i.size})` : ''}`
    if (kitchen) t.text(name, { size: S.xl })
    else t.cols(name, price(i.total), 30)
    /* Lo que hay que QUITAR, en negativo: es el error más caro en cocina */
    if (i.removed?.length) t.banner(`SIN ${i.removed.join(' · SIN ').toUpperCase()}`, kitchen ? S.l : S.s)
    if (i.extras?.length) t.text(`  + ${i.extras.join(', ')}`, { size: kitchen ? S.l : S.s })
    if (i.note) t.text(`  "${i.note}"`, { size: kitchen ? S.l : S.s })
    if (kitchen) t.gap(10)
  }
}

/** Comanda de cocina: una etiqueta (o más) por sección. */
export function comandaZpl(order) {
  const parts = []
  const list = sections(order)
  for (const s of list.length ? list : [{ id: 'todo', label: 'PEDIDO', items: order.items || [] }]) {
    const t = new Label(`${order.ref} · ${s.label}`)
    head(t, order)
    t.banner(s.label)
    if (s.id === 'pizzas' && order.oven_slots?.length > 1) {
      t.box(`HORNO: ${order.oven_slots.map((x) => `${hourOf(x.start)} > ${x.pizzas}`).join(' · ')}`, S.m)
    }
    t.gap(6)
    items(t, s.items, { kitchen: true })
    if (order.notes) t.text(`NOTA: ${order.notes}`, { size: S.l })
    t.rule().text(order.customer_name || '', { size: S.m, align: 'C' })
    t.box(paymentText(order))
    parts.push(t.bytes())
  }
  return join(parts)
}

/** Ticket del cliente en una etiqueta: logo, totales y QR del repartidor. */
export function receiptZpl(order, { siteUrl } = {}) {
  const t = new Label(`${order.ref} · ticket`)
  head(t, order, { logo: true })
  const fiscal = fiscalOf(order.location_id)
  if (fiscal) {
    t.text(`Factura simplificada ${invoiceNumber(order)}`, { size: 22, align: 'C' })
    t.text(`${fiscal.name} · NIF ${fiscal.nif}`, { size: 22, align: 'C' })
    if (fiscal.address) t.text(fiscal.address, { size: 22, align: 'C' })
    t.rule(2)
  }
  items(t, order.items || [], { kitchen: false })
  t.rule()
  const discount = Number(order.discount) || 0
  const fee = Number(order.delivery_fee) || 0
  const points = Number(order.points_discount) || 0
  if (discount || fee || points) {
    t.cols('Subtotal', price(order.subtotal), S.s)
    for (const d of order.deals || []) t.text(`Oferta ${d.count > 1 ? `${d.count}x ` : ''}${d.label} por ${price(d.price)}`, { size: S.s })
    if (discount) t.cols('Dto. recogida', `-${price(discount)}`, S.s)
    if (points) t.cols(`Puntos Club Nonno (${Number(order.points_redeemed) || 0})`, `-${price(points)}`, S.s)
    if (fee) t.cols(`Envío ${order.delivery_zone || ''}`, `+${price(fee)}`, S.s)
  }
  t.cols('TOTAL', price(order.total), 52)
  const tax = vatOf(order.total)
  t.text(`IVA ${IVA_RATE} % incluido · Base ${price(tax.base)} · IVA ${price(tax.iva)}`, { size: S.s, align: 'R' }).rule()
  const customer = (t) => {
    t.text(`${order.customer_name || ''}${order.customer_phone ? ` · Tel: ${order.customer_phone}` : ''}`, { size: 28 })
    if (order.address) t.text(`Dir: ${order.address}`, { size: 28 })
    if (order.delivery_zone) t.text(`DISTANCIA: ${order.delivery_zone.toUpperCase()}`, { size: 28 })
    if (order.delivery_verified === false) t.box('DIRECCIÓN SIN VERIFICAR · LLAMAR', S.s)
    if (order.notes) t.text(`Notas: ${order.notes}`, { size: S.s })
    t.box(paymentText(order), S.m)
  }
  if (order.mode === 'delivery' && siteUrl && /^[0-9a-f-]{36}$/i.test(String(order.id || ''))) {
    t.qrBeside(`${siteUrl}/repartidor?p=${order.id}`, ['REPARTIDOR:', 'ESCANEA AL', 'ENTREGAR'], customer)
  } else customer(t)
  t.text('¡Gracias por elegir a Nonno!', { size: S.m, align: 'C' })
  return t.bytes()
}

/** Aviso a cocina de que un pedido ya impreso se ha cancelado. */
export function cancelZpl(order) {
  return new Label().text('CANCELADO', { size: S.xl, align: 'C' }).text(order.ref, { size: S.xxl, align: 'C' })
    .text(order.customer_name || '', { size: S.m, align: 'C' })
    .text(`Cancelado a las ${hourOf(new Date())}`, { size: S.m, align: 'C' })
    .gap(20).box('NO PREPARAR · TIRAR LA COMANDA')
    .bytes()
}

/** Hoja de prueba desde el panel (Impresoras → Imprimir prueba). */
export function testZpl(label) {
  return new Label().logo().text('PRUEBA', { size: S.xl, align: 'C' })
    .text(label, { size: S.m, align: 'C' }).text(hora(new Date().toISOString()), { size: S.m, align: 'C' })
    .text('Tildes: áéíóú ñ Ñ ¿? ¡! €', { size: S.m, align: 'C' }).rule()
    .text('Si lees esto, Nonno Impresora funciona (Zebra).', { size: S.s, align: 'C' })
    .bytes()
}

function join(parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length + 1, 0))
  let o = 0
  for (const p of parts) { out.set(p, o); out[o + p.length] = 0x0a; o += p.length + 1 }
  return out
}
