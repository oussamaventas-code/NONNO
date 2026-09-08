import { useEffect, useState } from 'react'

/**
 * Detecta si la página ha pasado un umbral. Usa un centinela y un
 * IntersectionObserver: cero listeners de scroll, cero jank.
 */
export function useScrolled(threshold = 80) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const sentinel = document.createElement('div')
    sentinel.setAttribute('aria-hidden', 'true')
    Object.assign(sentinel.style, {
      position: 'absolute',
      top: `${threshold}px`,
      left: '0',
      width: '1px',
      height: '1px',
      pointerEvents: 'none',
    })
    document.body.appendChild(sentinel)

    const observer = new IntersectionObserver(
      ([entry]) => setScrolled(!entry.isIntersecting),
      { threshold: 0 }
    )
    observer.observe(sentinel)

    return () => {
      observer.disconnect()
      sentinel.remove()
    }
  }, [threshold])

  return scrolled
}
