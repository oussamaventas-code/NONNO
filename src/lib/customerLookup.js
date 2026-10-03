/* Reconocer a un cliente por su teléfono en el mostrador.
   Sin dependencias: lo usa el servidor y las pruebas. */

/** Móvil español (6XX o 7XX, con o sin +34) → "+34XXXXXXXXX"; si no lo es, null.
    Los avisos van por SMS, así que un fijo o un número a medias no sirve. */
export function mobileNumber(raw) {
  let digits = String(raw || '').replace(/[^\d+]/g, '')
  if (digits.startsWith('+34')) digits = digits.slice(3)
  else if (digits.startsWith('0034')) digits = digits.slice(4)
  return /^[67]\d{8}$/.test(digits) ? `+34${digits}` : null
}

/** Últimos 9 dígitos: da igual "+34 611 98 18 08", "611981808" o "611 98 18 08". */
export const phoneKey = (phone) => String(phone ?? '').replace(/\D/g, '').slice(-9)

/**
 * Patrón para ilike que casa con ese teléfono escrito de cualquier forma:
 * los 9 dígitos con lo que sea entre medias. "%6%1%1%9%8%1%8%0%8%"
 */
export const phonePattern = (phone) => {
  const key = phoneKey(phone)
  return key.length === 9 ? `%${key.split('').join('%')}%` : null
}

const PICK = ['ref', 'created_at', 'total', 'mode', 'items', 'location_id', 'address', 'delivery_lat', 'delivery_lng', 'delivery_verified', 'delivery_tier', 'delivery_fee']

/**
 * De las filas de pedidos (más recientes primero) saca la ficha del cliente.
 * Solo cuentan los del mismo teléfono y no cancelados. null si no hay ninguno.
 */
export function summarizeCustomer(rows, phone, { keep = 5 } = {}) {
  const key = phoneKey(phone)
  if (key.length < 9) return null
  const own = (rows || []).filter((r) => r.status !== 'cancelado' && phoneKey(r.customer_phone) === key)
  if (!own.length) return null

  const last = own[0]
  const withAddress = own.find((r) => r.mode === 'delivery' && r.address)
  return {
    name: last.customer_name || '',
    phone: last.customer_phone || '',
    count: own.length,
    lastAt: last.created_at,
    address: withAddress ? withAddress.address : null,
    orders: own.slice(0, keep).map((r) => Object.fromEntries(PICK.map((k) => [k, r[k] ?? null]))),
  }
}
