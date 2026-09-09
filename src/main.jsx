import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { StoreProvider } from './store/StoreContext'
import App from './App'
import './styles/index.css'

/* El panel de cocina solo lo carga quien entra en /admin: no lastra
   la web pública, que es la que tiene que abrir rápido en un móvil. */
const Admin = lazy(() => import('./admin/Admin'))

const isAdmin = window.location.pathname.replace(/\/+$/, '') === '/admin'

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
        <Admin />
      </Suspense>
    ) : (
      <StoreProvider>
        <App />
      </StoreProvider>
    )}
  </StrictMode>
)
