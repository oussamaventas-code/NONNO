import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { StoreProvider } from './store/StoreContext'
import App from './App'
import './styles/index.css'

/* El panel de cocina solo lo carga quien entra en /admin: no lastra
   la web pública, que es la que tiene que abrir rápido en un móvil. */
const Admin = lazy(() => import('./admin/Admin'))

/* /admin        → login normal
   /admin/sangonera, /admin/santo-angel → cada local tiene su enlace.
   La dirección solo decide qué se ve en el login: quien manda sigue
   siendo la contraseña. */
const ruta = window.location.pathname.replace(/\/+$/, '')
const isAdmin = ruta === '/admin' || ruta.startsWith('/admin/')
const sedeEnRuta = ruta.startsWith('/admin/') ? ruta.slice('/admin/'.length) : null

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isAdmin ? (
      <Suspense
        fallback={
          <div className="min-h-screen bg-masa flex items-center justify-center">
            <p className="mono text-carbon/40">ABRIENDO EL PANEL…</p>
          </div>
        }
      >
        <Admin sedeEnRuta={sedeEnRuta} />
      </Suspense>
    ) : (
      <StoreProvider>
        <App />
      </StoreProvider>
    )}
  </StrictMode>
)
