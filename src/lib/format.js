import { SITE } from '../data/site'

/* Formato de moneda y microdatos. Un único punto de verdad. */

const nf = new Intl.NumberFormat(SITE.locale, {
  style: 'currency',
  currency: SITE.currency,
  minimumFractionDigits: 2,
})

/** 12.5 -> "12,50 €" */
export const price = (value) => nf.format(Number(value || 0))

/** 12.5 -> "12,50" (sin símbolo, para tipografía mono en tickets) */
export const priceRaw = (value) =>
  Number(value || 0).toFixed(2).replace('.', ',')

/** 4.9 -> "4,9" */
export const decimal = (value, digits = 1) =>
  Number(value || 0).toFixed(digits).replace('.', ',')

/** Marca de tiempo corta para tickets: "21:04" */
export const clock = (date = new Date()) =>
  date.toLocaleTimeString(SITE.locale, { hour: '2-digit', minute: '2-digit' })

/** Referencia legible de pedido: "NN-4821" */
export const orderRef = () =>
  `NN-${Math.floor(1000 + Math.random() * 9000)}`

/** "3" -> "03" para numeración editorial */
export const pad = (n) => String(n).padStart(2, '0')
