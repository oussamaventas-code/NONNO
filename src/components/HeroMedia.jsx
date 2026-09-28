import { useState } from 'react'
import { useReducedMotion } from '../hooks/useReducedMotion'

/**
 * Hueco del hero: vídeo corto en bucle, mudo, con la foto como póster.
 * Si el vídeo aún no existe (o no carga) se queda la foto, y con
 * "reducir movimiento" activo tampoco se reproduce: solo la foto.
 */
export default function HeroMedia({ video, poster, posterSrcSet, alt, priority = false }) {
  const reduced = useReducedMotion()
  const [failed, setFailed] = useState(false)
  const cls = 'block w-full aspect-[421/540] object-cover'

  if (!video || reduced || failed) {
    return (
      <img
        src={poster}
        srcSet={posterSrcSet}
        sizes="(min-width: 1024px) 30vw, 50vw"
        alt={alt}
        fetchPriority={priority ? 'high' : undefined}
        className={cls}
      />
    )
  }

  return (
    <video
      className={cls}
      poster={poster}
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      aria-label={alt}
      onError={() => setFailed(true)}
    >
      <source src={video} type="video/mp4" onError={() => setFailed(true)} />
    </video>
  )
}
