import { discountFromRow, isLive } from './discounts.js'

/* Traduce las filas de las tablas menu_overrides, menu_soldout, menu_ingredient_soldout y discounts al
   formato que entiende src/data/menu.js (setMenuOverrides). Sin
   dependencias, para poder usarlo igual en el servidor y en pruebas. */

const money = (v) => {
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null
}

export function overridesFromRows(overrideRows = [], soldOutRows = [], ingredientRows = [], discountRows = []) {
  const prices = {}
  const hidden = []
  for (const r of overrideRows) {
    if (r.hidden) hidden.push(r.product_id)
    const price = money(r.price)
    const portionPrices = {}
    for (const [id, v] of Object.entries(r.portion_prices || {})) {
      const m = money(v)
      if (m !== null) portionPrices[id] = m
    }
    const hasPortions = Object.keys(portionPrices).length > 0
    if (price !== null || hasPortions) {
      prices[r.product_id] = { price, portionPrices: hasPortions ? portionPrices : null }
    }
  }
  const soldOut = {}
  for (const r of soldOutRows) (soldOut[r.location_id] ||= []).push(r.product_id)
  const ingredients = {}
  for (const r of ingredientRows) (ingredients[r.location_id] ||= []).push(r.ingredient_key)
  /* Al público solo le llegan los descuentos en vigor */
  const discounts = discountRows.map(discountFromRow).filter((d) => isLive(d))
    .map(({ id, name, kind, value, target, targetIds, endsAt }) => ({ id, name, kind, value, target, targetIds, endsAt, active: true }))
  return { prices, hidden, soldOut, ingredients, discounts }
}
