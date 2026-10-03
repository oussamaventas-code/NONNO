import { price } from './format'
import { hourOf } from './kitchenSlots'

/* ═══════════════════════════════════════════════════════════════
   Ticket del pedido como imagen, para que el cliente lo guarde en el
   móvil (galería) o se lo mande por WhatsApp. Se dibuja en un canvas:
   sin librerías y sin depender de la conexión.
   ═══════════════════════════════════════════════════════════════ */

const W = 1080
const PAD = 72
const INK = '#141414'
const SOFT = '#6b6b6b'
const RED = '#d6334f'
const GREEN = '#1f8a4c'

const loadImage = (src) => new Promise((resolve) => {
  const img = new Image()
  img.onload = () => resolve(img)
  img.onerror = () => resolve(null)
  img.src = src
})

/* Corta un texto en líneas que caben en `max` píxeles */
function wrap(ctx, text, max) {
  const words = String(text).split(' ')
  const lines = []
  let line = ''
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (ctx.measureText(test).width > max && line) { lines.push(line); line = w } else line = test
  }
  if (line) lines.push(line)
  return lines
}

/**
 * Dibuja el ticket. `order` es lo que devuelve el pedido (payload) y
 * `arrivalAt` la hora de recogida o de llegada.
 * @returns {Promise<Blob>} imagen PNG
 */
export async function ticketImage(order, arrivalAt) {
  const logo = await loadImage('/logo-nonno.png')
  const delivery = order.mode === 'delivery'
  const items = order.items || []

  /* Dos pasadas: la primera mide el alto, la segunda pinta */
  const draw = (ctx, paint) => {
    let y = PAD
    const text = (str, { size = 38, weight = 400, color = INK, align = 'left', x, family = 'Arial, Helvetica, sans-serif' } = {}) => {
      ctx.font = `${weight} ${size}px ${family}`
      if (paint) {
        ctx.fillStyle = color
        ctx.textAlign = align
        ctx.fillText(str, x ?? (align === 'center' ? W / 2 : align === 'right' ? W - PAD : PAD), y)
      }
    }
    const gap = (n) => { y += n }
    const rule = () => {
      gap(24)
      if (paint) {
        ctx.strokeStyle = '#bbbbbb'; ctx.setLineDash([12, 10]); ctx.lineWidth = 3
        ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(W - PAD, y); ctx.stroke(); ctx.setLineDash([])
      }
      gap(52)
    }

    if (logo) {
      if (paint) ctx.drawImage(logo, (W - 240) / 2, y, 240, 240)
      gap(290)
    } else {
      gap(50); text('LA PIZZA DE NONNO', { size: 56, weight: 700, align: 'center' }); gap(40)
    }
    text(order.location?.name || '', { size: 36, color: SOFT, align: 'center' }); gap(70)
    text('PEDIDO', { size: 34, weight: 700, color: SOFT, align: 'center' }); gap(110)
    text(order.ref || '', { size: 120, weight: 700, align: 'center' }); gap(70)
    text(delivery ? 'A DOMICILIO' : 'PARA RECOGER', { size: 40, weight: 700, color: RED, align: 'center' }); gap(56)
    if (arrivalAt) {
      text(`${delivery ? 'Llega hacia las' : 'Lista a las'} ${hourOf(arrivalAt)}`, { size: 44, weight: 700, align: 'center' }); gap(20)
    }
    rule()

    for (const i of items) {
      ctx.font = `700 40px Arial, Helvetica, sans-serif`
      const nameLines = wrap(ctx, `${i.qty}× ${i.name}${i.size ? ` (${i.size})` : ''}`, W - PAD * 2 - 220)
      nameLines.forEach((l, n) => {
        text(l, { size: 40, weight: 700 })
        if (n === 0) text(price(i.total), { size: 40, weight: 700, align: 'right' })
        gap(54)
      })
      if (i.removed?.length) {
        ctx.font = '400 34px Arial, Helvetica, sans-serif'
        wrap(ctx, `Sin ${i.removed.join(', sin ')}`, W - PAD * 2 - 60).forEach((l) => { text(l, { size: 34, color: RED, x: PAD + 60 }); gap(46) })
      }
      if (i.extras?.length) {
        ctx.font = '400 34px Arial, Helvetica, sans-serif'
        wrap(ctx, `+ ${i.extras.join(', + ')}`, W - PAD * 2 - 60).forEach((l) => { text(l, { size: 34, color: GREEN, x: PAD + 60 }); gap(46) })
      }
      if (i.note) { text(`"${i.note}"`, { size: 32, color: SOFT, x: PAD + 60 }); gap(46) }
      gap(14)
    }
    rule()

    const row = (label, value) => { text(label, { size: 36, color: SOFT }); text(value, { size: 36, color: SOFT, align: 'right' }); gap(52) }
    if (Number(order.discount)) row('Descuento recogida', `−${price(order.discount)}`)
    if (Number(order.pointsDiscount)) row('Puntos Club Nonno', `−${price(order.pointsDiscount)}`)
    if (Number(order.deliveryFee)) row('Envío', `+${price(order.deliveryFee)}`)
    gap(10)
    text('TOTAL', { size: 56, weight: 700 }); text(price(order.total), { size: 56, weight: 700, align: 'right' }); gap(70)
    text('Se paga en el local o al recibir el pedido', { size: 32, color: SOFT, align: 'center' }); gap(50)
    if (order.customer?.name) { text(order.customer.name, { size: 34, align: 'center' }); gap(48) }
    if (delivery && order.customer?.address) {
      ctx.font = '400 32px Arial, Helvetica, sans-serif'
      wrap(ctx, order.customer.address, W - PAD * 2).forEach((l) => { text(l, { size: 32, color: SOFT, align: 'center' }); gap(44) })
    }
    gap(30)
    text('¡Gracias por elegir a Nonno!', { size: 44, weight: 700, color: RED, align: 'center' })
    return y + PAD
  }

  const measure = document.createElement('canvas').getContext('2d')
  const H = Math.ceil(draw(measure, false))
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)
  /* Filete rojo de la marca alrededor */
  ctx.strokeStyle = RED; ctx.lineWidth = 12
  ctx.strokeRect(18, 18, W - 36, H - 36)
  ctx.textBaseline = 'alphabetic'
  draw(ctx, true)
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
}

/**
 * Guarda el ticket en el móvil: en el móvil abre "Compartir" (Guardar
 * imagen, WhatsApp…); si no se puede, lo descarga como archivo.
 * @returns {Promise<boolean>} true si se ha guardado o compartido
 */
export async function saveTicket(order, arrivalAt) {
  const blob = await ticketImage(order, arrivalAt)
  if (!blob) return false
  const name = `ticket-nonno-${order.ref || 'pedido'}.png`
  const file = new File([blob], name, { type: 'image/png' })

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: `Ticket ${order.ref}` })
      return true
    } catch (err) {
      /* Cerró el menú de compartir sin elegir nada: se descarga igual */
      if (err?.name !== 'AbortError') console.warn('No se pudo compartir el ticket', err)
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
  return true
}
