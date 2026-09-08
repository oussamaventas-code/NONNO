/**
 * Capa global de ruido: textura de "papel artesanal" sobre toda la web.
 * SVG feTurbulence, muy sutil (0.05), pointer-events: none.
 */
export default function Grain() {
  return (
    <div className="grain-overlay" aria-hidden="true">
      <svg width="100%" height="100%">
        <filter id="nonno-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#nonno-grain)" />
      </svg>
    </div>
  )
}
