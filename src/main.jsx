import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { StoreProvider } from './store/StoreContext'
import { AccountProvider } from './store/AccountContext'
import App from './App'
import { setupInstall } from './lib/installApp'
import './styles/index.css'

/* El panel de cocina solo lo carga quien entra en /admin: no lastra
   la web pública, que es la que tiene que abrir rápido en un móvil. */
const Admin = lazy(() => import('./admin/Admin'))
const DisplayBoard = lazy(() => import('./admin/DisplayBoard'))
const DriverPortal = lazy(() => import('./driver/DriverPortal'))

/* /admin        → login normal
   /superadmin   → el mismo panel con la puerta del super admin (las dos sedes)
   /admin/sangonera, /admin/santo-angel → cada local tiene su enlace.
   /pantalla/sangonera → pantalla de pedidos para la TV del local.
   /repartidor   → portal del repartidor (PIN, escanear el QR del ticket, cobrar).
   La dirección solo decide qué se ve en el login: quien manda sigue
   siendo la contraseña. */
const ruta = window.location.pathname.replace(/\/+$/, '')
const seccion = ['/admin', '/superadmin', '/pantalla', '/repartidor'].find((b) => ruta === b || ruta.startsWith(`${b}/`))
const sedeEnRuta = seccion && ruta.startsWith(`${seccion}/`) ? ruta.slice(seccion.length + 1) : null

/* La web del cliente se instala como app. El panel también, con su
   propio icono ("Nonno Panel"): en iPhone es la única forma de que le
   lleguen al jefe las notificaciones (pedido nuevo, "¿cerramos?"). */
if (!seccion) setupInstall()
else if (seccion === '/admin' || seccion === '/superadmin') {
  const add = (tag, attrs) => document.head.appendChild(Object.assign(document.createElement(tag), attrs))
  add('link', { rel: 'manifest', href: '/manifest-panel.webmanifest' })
  add('meta', { name: 'apple-mobile-web-app-capable', content: 'yes' })
  add('meta', { name: 'apple-mobile-web-app-title', content: 'Nonno Panel' })
  document.querySelector('link[rel="apple-touch-icon"]')?.setAttribute('href', '/app/apple-touch-icon.png')
} else if (seccion === '/repartidor') {
  const add = (tag, attrs) => document.head.appendChild(Object.assign(document.createElement(tag), attrs))
  add('link', { rel: 'manifest', href: '/manifest-reparto.webmanifest' })
  add('meta', { name: 'apple-mobile-web-app-capable', content: 'yes' })
  add('meta', { name: 'apple-mobile-web-app-title', content: 'Nonno Reparto' })
  document.title = 'Nonno · Repartidores'
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {seccion ? (
      <Suspense
        fallback={
          <div className="min-h-screen bg-masa flex items-center justify-center">
            <p className="mono text-carbon/40">ABRIENDO…</p>
          </div>
        }
      >
        {seccion === '/repartidor' ? <DriverPortal /> : seccion === '/pantalla'
          ? <Admin sedeEnRuta={sedeEnRuta} base="/pantalla" title="PANTALLA DE PEDIDOS" Inside={DisplayBoard} />
          : seccion === '/superadmin'
            ? <Admin sedeEnRuta={sedeEnRuta} base="/superadmin" title="SUPER ADMIN" />
            : <Admin sedeEnRuta={sedeEnRuta} />}
      </Suspense>
    ) : (
      <StoreProvider>
        <AccountProvider>
          <App />
        </AccountProvider>
      </StoreProvider>
    )}
  </StrictMode>
)
