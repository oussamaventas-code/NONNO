import { useEffect, useState } from 'react'
import { getSession } from '../admin/api'
import NotFoundPage from './NotFoundPage'

/**
 * Control Zero-Trust de Rutas Privadas / Protegidas.
 * Si un cliente o usuario sin autenticar intenta acceder a:
 *   - /superadmin
 *   - /admin (o /admin/sangonera, /admin/santo-angel)
 *   - /pantalla/...
 *   - /repartidor
 * 
 * En lugar de exponer un formulario de login evidente a curiosos o atacantes,
 * comprueba la sesión en el servidor y, si no tiene autorización previa o activa,
 * renderiza el 'NotFoundPage' (404 Fantasma / "Esta página no está en la carta"),
 * ocultando completamente la existencia del panel salvo que el usuario introduzca
 * el parámetro de desbloqueo administrativo (?access=1) o ya cuente con sesión válida.
 */
export default function ProtectedRoute({ section, sedeEnRuta, children }) {
  const [authorized, setAuthorized] = useState(null) // null = comprobando, true = autorizado/login permitido, false = 404 fantasma

  useEffect(() => {
    // Comprobar si el navegador ya cuenta con sesión HttpOnly válida
    getSession()
      .then((session) => {
        if (section === '/superadmin') {
          // Si ya está autenticado como superadmin, pasa directo
          if (session.authenticated && session.role === 'superadmin') {
            setAuthorized(true)
            return
          }
          // Si no está autenticado, solo mostramos el login si el operador conoce la llave de acceso (?access=1 o ?login=1)
          const params = new URLSearchParams(window.location.search)
          if (params.has('access') || params.has('login') || params.has('admin')) {
            setAuthorized(true)
          } else {
            setAuthorized(false)
          }
          return
        }

        if (section === '/admin' || section === '/pantalla') {
          if (session.authenticated && ['superadmin', 'admin', 'cajero'].includes(session.role)) {
            setAuthorized(true)
            return
          }
          const params = new URLSearchParams(window.location.search)
          if (params.has('access') || params.has('login') || params.has('admin') || sedeEnRuta) {
            setAuthorized(true)
          } else {
            setAuthorized(false)
          }
          return
        }

        if (section === '/repartidor') {
          // El portal de repartidores permite login con PIN numérico si lleva ?p= (QR del pedido) o acceso directo
          setAuthorized(true)
          return
        }

        setAuthorized(true)
      })
      .catch(() => {
        const params = new URLSearchParams(window.location.search)
        if (params.has('access') || params.has('login')) setAuthorized(true)
        else setAuthorized(false)
      })
  }, [section, sedeEnRuta])

  if (authorized === null) {
    return (
      <div className="min-h-screen bg-masa flex items-center justify-center">
        <p className="mono text-carbon/40">ABRIENDO…</p>
      </div>
    )
  }

  if (authorized === false) {
    // 404 Fantasma: No revela que la ruta existe
    return <NotFoundPage />
  }

  return children
}
