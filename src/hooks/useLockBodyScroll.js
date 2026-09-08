import { useLayoutEffect } from 'react'

/**
 * Bloquea el scroll del documento mientras un panel está abierto y
 * compensa el ancho de la barra para que el layout no salte.
 */
export function useLockBodyScroll(locked) {
  useLayoutEffect(() => {
    if (!locked) return
    const { body } = document
    const prevOverflow = body.style.overflow
    const prevPadding = body.style.paddingRight
    const gap = window.innerWidth - document.documentElement.clientWidth

    body.style.overflow = 'hidden'
    if (gap > 0) body.style.paddingRight = `${gap}px`

    return () => {
      body.style.overflow = prevOverflow
      body.style.paddingRight = prevPadding
    }
  }, [locked])
}
