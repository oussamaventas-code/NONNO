import { useEffect } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Accesibilidad de paneles y modales: foco atrapado dentro, Escape
 * cierra y el foco vuelve a donde estaba al abrirlo.
 */
export function useFocusTrap(ref, active, onClose) {
  useEffect(() => {
    if (!active || !ref.current) return
    const node = ref.current
    const previous = document.activeElement

    const first = node.querySelector(FOCUSABLE)
    if (first) first.focus({ preventScroll: true })

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose?.()
        return
      }
      if (e.key !== 'Tab') return

      const items = Array.from(node.querySelectorAll(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null
      )
      if (!items.length) return

      const firstItem = items[0]
      const lastItem = items[items.length - 1]

      if (e.shiftKey && document.activeElement === firstItem) {
        e.preventDefault()
        lastItem.focus()
      } else if (!e.shiftKey && document.activeElement === lastItem) {
        e.preventDefault()
        firstItem.focus()
      }
    }

    node.addEventListener('keydown', onKeyDown)
    return () => {
      node.removeEventListener('keydown', onKeyDown)
      if (previous instanceof HTMLElement) previous.focus({ preventScroll: true })
    }
  }, [ref, active, onClose])
}
