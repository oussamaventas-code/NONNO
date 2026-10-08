/* ═══════════════════════════════════════════════════════════════
   Instalar la web como app en el móvil del cliente.

   · Android / Chrome: el navegador avisa con `beforeinstallprompt`
     al cargar; se guarda y se lanza cuando el cliente pulsa INSTALAR.
     Hay que escucharlo desde el arranque o se pierde.
   · iPhone: Apple no deja instalar desde un botón; se le enseña
     cómo (Compartir → Añadir a pantalla de inicio). Allí la app no
     comparte datos con Safari, así que NO se le da el manifiesto: sin
     él, el icono abre la página en la que estaba (su ticket).
   ═══════════════════════════════════════════════════════════════ */

const EVENT = 'nonno:install'
const DISMISS_KEY = 'nonno.instalar.no'
let deferred = null

export const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

export const isInstalled = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true

const isMobile = () => /android|iphone|ipad|ipod/i.test(navigator.userAgent) || isIOS()

/** Se llama una vez al arrancar la web pública. */
export function setupInstall() {
  const head = document.head
  const add = (tag, attrs) => {
    const el = document.createElement(tag)
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v))
    head.appendChild(el)
  }

  if (isIOS()) {
    add('meta', { name: 'apple-mobile-web-app-capable', content: 'yes' })
    add('meta', { name: 'mobile-web-app-capable', content: 'yes' })
    add('meta', { name: 'apple-mobile-web-app-title', content: 'Nonno' })
    add('meta', { name: 'apple-mobile-web-app-status-bar-style', content: 'black' })
    document.querySelector('link[rel="apple-touch-icon"]')?.setAttribute('href', '/app/apple-touch-icon.png')
  } else {
    add('link', { rel: 'manifest', href: '/api/site-manifest' })
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e
    window.dispatchEvent(new Event(EVENT))
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    window.dispatchEvent(new Event(EVENT))
  })

  /* Chrome solo ofrece instalar si hay service worker. El mismo del
     panel: no cachea nada y solo atiende avisos del personal. */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}))
  }
}

/**
 * Qué se le puede ofrecer a este cliente:
 *   'prompt' → botón INSTALAR (Android/Chrome)
 *   'ios'    → pasos de Compartir → Añadir a pantalla de inicio
 *   'manual' → móvil sin aviso del navegador: menú ⋮ → Instalar
 *   null     → nada (ya instalada, escritorio, o lo ha cerrado)
 */
export function installMode() {
  if (isInstalled() || isDismissed()) return null
  if (deferred) return 'prompt'
  if (isIOS()) return 'ios'
  return isMobile() ? 'manual' : null
}

/** Abre el aviso del navegador. Devuelve true si la instala. */
export async function promptInstall() {
  if (!deferred) return false
  const e = deferred
  deferred = null
  e.prompt()
  const { outcome } = await e.userChoice.catch(() => ({ outcome: 'dismissed' }))
  window.dispatchEvent(new Event(EVENT))
  return outcome === 'accepted'
}

function isDismissed() {
  try { return localStorage.getItem(DISMISS_KEY) === '1' } catch { return false }
}

export function dismissInstall() {
  try { localStorage.setItem(DISMISS_KEY, '1') } catch { /* modo privado */ }
  window.dispatchEvent(new Event(EVENT))
}

export const INSTALL_EVENT = EVENT
