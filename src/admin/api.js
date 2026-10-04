/* Llamadas del panel de cocina a la API. La cookie de sesión viaja
   sola: nunca guardamos credenciales en el navegador. */

async function request(url, options = {}) {
  const res = await fetch(url, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(data.error || 'Error de conexión'), { status: res.status })
  return data
}

export const getSession = () => request('/api/session')

export const login = (password) =>
  request('/api/session', { method: 'POST', body: JSON.stringify({ password }) })

export const logout = () => request('/api/session', { method: 'DELETE' })

/** Todos los pedidos de esta noche (día de servicio) y los que sigan abiertos. */
export const fetchOrders = () => request('/api/orders?today=1')

export const updateOrder = (id, patch) =>
  request(`/api/orders/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })

/** Pedido creado desde el mostrador o por teléfono (payload como el de la web + channel). */
export const createOrder = (payload) =>
  request('/api/orders', { method: 'POST', body: JSON.stringify(payload) })

/** Cambia el contenido de un pedido: { items, mode, customer } */
export const editOrder = (id, edit) =>
  request(`/api/orders/${id}`, { method: 'PATCH', body: JSON.stringify({ edit }) })

export const fetchSlots = (locationId, pizzas) =>
  request(`/api/slots?location=${encodeURIComponent(locationId)}&pizzas=${pizzas}`)

export const fetchStock = (locationId) =>
  request(`/api/stock?location=${encodeURIComponent(locationId)}`)

/** action: 'count' | 'saveItem' | 'deleteItem' (ver api/stock.js) */
export const stockAction = (locationId, action, data) =>
  request('/api/stock', { method: 'POST', body: JSON.stringify({ location: locationId, action, ...data }) })

/** action: 'dispatch' { ids } | 'undo' { routeId } (ver api/routes.js) */
export const routeAction = (locationId, action, data) =>
  request('/api/routes', { method: 'POST', body: JSON.stringify({ location: locationId, action, ...data }) })

export const fetchDisplay = (locationId) =>
  request(`/api/display?location=${encodeURIComponent(locationId)}`)

/** { from, to, location? }. Solo la dirección puede verlo (ver api/billing.js). */
export const fetchBilling = ({ from, to, location }) => {
  const qs = new URLSearchParams({ from, to, ...(location ? { location } : {}) })
  return request(`/api/billing?${qs}`)
}

export const fetchStoreStatus = () => request('/api/store-status')

export const setStoreStatus = (locationId, isOpen) =>
  request('/api/store-status', { method: 'PATCH', body: JSON.stringify({ locationId, isOpen }) })

/** Masas del día de una sede (solo dirección). null = sin límite. */
export const setDoughLimit = (locationId, doughLimit) =>
  request('/api/store-status', { method: 'PATCH', body: JSON.stringify({ locationId, doughLimit }) })

export const getPushConfig = () => request('/api/push')

export const savePushSubscription = (subscription, label) =>
  request('/api/push', { method: 'POST', body: JSON.stringify({ subscription, label }) })


export const removePushSubscription = (endpoint) =>
  request('/api/push', { method: 'DELETE', body: JSON.stringify({ endpoint }) })

export const fetchMenu = () => request('/api/menu')
export const fetchDiscounts = () => request('/api/menu?discounts=all')
export const saveDiscount = (discount) =>
  request('/api/menu', { method: 'POST', body: JSON.stringify({ action: 'discountSave', discount }) })
export const deleteDiscount = (id) =>
  request('/api/menu', { method: 'POST', body: JSON.stringify({ action: 'discountDelete', id }) })

/** action: 'price' { productId, price | portionPrices } · 'hidden' { productId, hidden } ·
    'soldOut' { location, productId, soldOut }. Devuelve las correcciones ya guardadas. */
export const menuAction = (action, data) =>
  request('/api/menu', { method: 'POST', body: JSON.stringify({ action, ...data }) })

/** Ficha del cliente por teléfono: nombre, dirección y sus últimos pedidos. null si es nuevo. */
export const fetchCustomer = (phone) =>
  request(`/api/orders?customer=${encodeURIComponent(phone)}`)

/** Cierre de caja (ver api/_lib/cashHandler.js): lo esperado, el cierre del día y el histórico. */
export const fetchCash = (locationId, day) => {
  const qs = new URLSearchParams({ location: locationId, ...(day ? { day } : {}) })
  return request(`/api/cash?${qs}`)
}

export const saveCash = (locationId, day, data) =>
  request('/api/cash', { method: 'POST', body: JSON.stringify({ location: locationId, day, ...data }) })
