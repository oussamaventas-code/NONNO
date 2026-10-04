import { useState } from 'react'
import { Pizza, CupSoda, Cookie, UtensilsCrossed } from 'lucide-react'
import { img, srcSet } from '../data/images'

const ICON = {
  bebidas: CupSoda,
  'calzones-dulces': Cookie,
  'nonnitos-dulces': Cookie,
  entrantes: UtensilsCrossed,
}

/**
 * Foto del producto, o un hueco de marca si todavía no tiene foto
 * propia: nunca una imagen rota ni una foto de banco que no es.
 */
export default function ProductImage({ image, category, alt, width = 500, widths, sizes, className = '', iconClassName = 'w-8 h-8' }) {
  /* Si la foto no carga (sin conexión, enlace caído) se pone el hueco de marca */
  const [failed, setFailed] = useState(false)
  if (!image || failed) {
    const Icon = ICON[category] || Pizza
    return (
      <div className={`flex items-center justify-center bg-panel text-tomate ${className}`} role="img" aria-label={alt}>
        <Icon className={iconClassName} strokeWidth={1.5} />
      </div>
    )
  }

  return (
    <img
      src={img(image, width, 80)}
      srcSet={widths ? srcSet(image, widths) : undefined}
      sizes={sizes}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
    />
  )
}
