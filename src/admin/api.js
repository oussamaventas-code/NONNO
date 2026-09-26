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

export const fetchOrders = (limit = 60) => request(`/api/orders?limit=${limit}`)

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

export const fetchStoreStatus = () => request('/api/store-status')

export const setStoreStatus = (locationId, isOpen) =>
  request('/api/store-status', { method: 'PATCH', body: JSON.stringify({ locationId, isOpen }) })

export const getPushConfig = () => request('/api/push')

export const savePushSubscription = (subscription, label) =>
  request('/api/push', { method: 'POST', body: JSON.stringify({ subscription, label }) })

export const removePushSubscription = (endpoint) =>
  request('/api/push', { method: 'DELETE', body: JSON.stringify({ endpoint }) })
