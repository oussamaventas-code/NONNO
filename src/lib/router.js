import { useEffect, useState } from 'react'
import { scrollToSection } from './scroll'

/* Enrutado mínimo de la web pública: "/" (landing) y "/carta".
   Cambia de página sin recargar, así el carrito sigue intacto. */

const EVENT = 'nonno:navigate'

export const currentPath = () => window.location.pathname.replace(/\/+$/, '') || '/'

export function navigate(path) {
  if (path === currentPath()) return
  window.history.pushState({}, '', path)
  window.dispatchEvent(new Event(EVENT))
  window.scrollTo({ top: 0, behavior: 'instant' })
}

export function usePath() {
  const [path, setPath] = useState(currentPath)
  useEffect(() => {
    const update = () => setPath(currentPath())
    window.addEventListener(EVENT, update)
    window.addEventListener('popstate', update)
    return () => {
      window.removeEventListener(EVENT, update)
      window.removeEventListener('popstate', update)
    }
  }, [])
  return path
}

/** Sigue un enlace de NAV_LINKS: página ({ href }) o sección de la landing ({ id }). */
export function followLink(link) {
  if (link.href) return navigate(link.href)
  if (currentPath() === '/') return scrollToSection(link.id)
  navigate('/')
  // Se espera a que la landing se pinte antes de bajar a la sección
  setTimeout(() => scrollToSection(link.id), 60)
}
