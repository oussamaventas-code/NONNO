import { useState } from 'react'
import { logoSrc } from '../data/siteContent'

/**
 * Ilustración de marca leída de public/ilustraciones/. Mientras el
 * archivo no exista se muestra el logo, para que nunca haya un hueco
 * roto: basta con dejar el PNG con el nombre correcto para que salga.
 */
export default function Illustration({ src, alt = '', className = '', fallbackClassName = '', hideWhenMissing = false }) {
  const [missing, setMissing] = useState(false)

  if (missing) {
    if (hideWhenMissing) return null
    return (
      <img
        src={logoSrc()}
        alt={alt}
        loading="lazy"
        className={`rounded-full object-cover border-4 border-crema shadow-float ${fallbackClassName}`}
      />
    )
  }

  /* Pantallas de alta densidad (móviles, retina) cargan la versión
     @2x que vive al lado: "foto.png" → "foto@2x.png". */
  const src2x = src.replace(/(\.\w+)$/, '@2x$1')
  return (
    <img
      src={src}
      srcSet={`${src} 1x, ${src2x} 2x`}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setMissing(true)}
      className={className}
    />
  )
}
