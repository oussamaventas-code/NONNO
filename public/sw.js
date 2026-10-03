/* Service worker del panel de cocina.
   Solo hace una cosa: recibir los avisos (pedido nuevo, "¿cerramos?")
   y mostrarlos aunque el panel esté cerrado. No cachea nada. */

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { /* payload no JSON */ }

  const title = data.title || 'Nuevo pedido'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || 'Ha entrado un pedido en Nonno.',
      tag: data.ref || 'nonno-order',
      renotify: true,
      requireInteraction: true,
      vibrate: [200, 100, 200],
      icon: '/app/icono-192.png',
      data: { url: data.url || '/admin' },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url || '/admin', self.location.origin).href

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => c.url.startsWith(url))
      if (open) return open.focus()
      return self.clients.openWindow(url)
    })
  )
})
