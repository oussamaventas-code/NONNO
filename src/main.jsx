import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { StoreProvider } from './store/StoreContext'
import App from './App'
import './styles/index.css'

/* El panel de cocina solo lo carga quien entra en /admin: no lastra
   la web pública, que es la que tiene que abrir rápido en un móvil. */
const Admin = lazy(() => import('./admin/Admin'))
const DisplayBoard = lazy(() => import('./admin/DisplayBoard'))

/* /admin        → login normal
   /admin/sangonera, /admin/santo-angel → cada local tiene su enlace.
   /pantalla/sangonera → pantalla de pedidos para la TV del local.
   La dirección solo decide qué se ve en el login: quien manda sigue
   siendo la contraseña. */
const ruta = window.location.pathname.replace(/\/+$/, '')
const seccion = ['/admin', '/pantalla'].find((b) => ruta === b || ruta.startsWith(`${b}/`))
const sedeEnRuta = seccion && ruta.startsWith(`${seccion}/`) ? ruta.slice(seccion.length + 1) : null

/* El panel de cocina conserva la paleta clara de siempre (crema + tomate):
   se lee mejor con el horno y el papel de los tickets. El neón es solo
   para la web pública. */
if (seccion) document.documentElement.classList.add('tema-clasico')

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
        {seccion === '/pantalla'
          ? <Admin sedeEnRuta={sedeEnRuta} base="/pantalla" title="PANTALLA DE PEDIDOS" Inside={DisplayBoard} />
          : <Admin sedeEnRuta={sedeEnRuta} />}
      </Suspense>
    ) : (
      <StoreProvider>
        <App />
      </StoreProvider>
    )}
  </StrictMode>
)
