import { prefersReducedMotion } from './motion'

/**
 * Lleva la vista a una sección.
 *
 * El scroll suave del navegador depende de su reloj de animación: si
 * está pausado (pestaña en segundo plano, ahorro de energía en iOS) el
 * enlace no llevaría a ninguna parte. Por eso comprobamos que la
 * posición se haya movido y, si no, saltamos de forma instantánea.
 */
export function scrollToSection(id) {
  const el = document.getElementById(id)
  if (!el) return

  const target = el.getBoundingClientRect().top + window.scrollY
  const start = window.scrollY

  if (prefersReducedMotion()) {
    window.scrollTo({ top: target, behavior: 'instant' })
    return
  }

  window.scrollTo({ top: target, behavior: 'smooth' })

  /* Si en medio segundo no se ha movido, el scroll suave no está
     funcionando: saltamos sin animación. */
  setTimeout(() => {
    if (Math.abs(window.scrollY - start) < 2 && Math.abs(target - start) > 4) {
      window.scrollTo({ top: target, behavior: 'instant' })
    }
  }, 500)
}
