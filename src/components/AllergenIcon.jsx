import { getAllergen } from '../data/allergens'

/* Pictogramas de los 14 alérgenos, dibujados a trazo como los iconos de
   lucide que usa el resto de la web (24×24, currentColor). */
const PATHS = {
  gluten: (
    <>
      <path d="M12 22V9" />
      <path d="M12 13c-2.5 0-4-1.6-4-4 2.5 0 4 1.6 4 4Z" />
      <path d="M12 13c2.5 0 4-1.6 4-4-2.5 0-4 1.6-4 4Z" />
      <path d="M12 17.5c-2.5 0-4-1.6-4-4 2.5 0 4 1.6 4 4Z" />
      <path d="M12 17.5c2.5 0 4-1.6 4-4-2.5 0-4 1.6-4 4Z" />
      <path d="M12 9c-1.3-1-1.3-4 0-6.5 1.3 2.5 1.3 5.5 0 6.5Z" />
    </>
  ),
  crustaceos: (
    <>
      <ellipse cx="12" cy="14.5" rx="5" ry="3.5" />
      <path d="M7.5 6.5c-2 .5-3 2.5-2 4.5M5.5 11l2.2-.6M7.5 6.5 9 9" />
      <path d="M16.5 6.5c2 .5 3 2.5 2 4.5M18.5 11l-2.2-.6M16.5 6.5 15 9" />
      <path d="M8 17.5 6 20M10.5 18l-1 2.5M13.5 18l1 2.5M16 17.5l2 2.5" />
      <path d="M10.5 11.5v-1M13.5 11.5v-1" />
    </>
  ),
  pescado: (
    <>
      <path d="M3 12c3-4.5 9-6 14-2.5L21 6v12l-4-3.5C12 18 6 16.5 3 12Z" />
      <circle cx="7.5" cy="11" r=".6" fill="currentColor" />
      <path d="M11 9.5c.8 1.6.8 3.4 0 5" />
    </>
  ),
  moluscos: (
    <>
      <path d="M12 20 4.5 11.5a7.5 7.5 0 0 1 15 0Z" />
      <path d="M12 20V5.5M12 20 8 6.4M12 20l4-13.6M12 20 5.4 9M12 20l6.6-11" />
      <path d="M10 20h4" />
    </>
  ),
  cacahuetes: (
    <>
      <path d="M9.5 3.5a4 4 0 0 1 5 5c-.6.9-.6 1.8 0 2.7a4 4 0 1 1-5.6 5.6c-.9-.6-1.8-.6-2.7 0a4 4 0 0 1-2.7-7 4 4 0 0 1 3-1.1c.8 0 1.5-.4 1.9-1.1Z" transform="rotate(10 12 12)" />
      <path d="M9 9.5h.01M12 12.5h.01M8 14h.01M13.5 8h.01" strokeWidth="2.4" />
    </>
  ),
  soja: (
    <>
      <path d="M6 19c-1.5-3 0-8 4-11s8.5-4 10-2.5c1.5 1.5.5 6-2.5 10S9 20.5 6 19Z" />
      <circle cx="9.5" cy="15" r="1.7" />
      <circle cx="13" cy="11.5" r="1.7" />
      <circle cx="16.5" cy="8" r="1.7" />
      <path d="M6 19 3 21" />
    </>
  ),
  lacteos: (
    <>
      <path d="M9 2.5h6M9.5 2.5v3L7 9.5V20a1.5 1.5 0 0 0 1.5 1.5h7A1.5 1.5 0 0 0 17 20V9.5l-2.5-4v-3" />
      <path d="M7 13c1.7-1 3.3-1 5 0s3.3 1 5 0" />
    </>
  ),
  'frutos-cascara': (
    <>
      <path d="M12 3c5 0 8 3.5 8 8.5S16.5 21 12 21 4 17 4 11.5 7 3 12 3Z" />
      <path d="M12 3v18" />
      <path d="M8.5 8c1 .8 1 2 0 3s-1 2.3 0 3.3M15.5 8c-1 .8-1 2 0 3s1 2.3 0 3.3" />
    </>
  ),
  apio: (
    <>
      <path d="M9 21.5V11M12 21.5V9.5M15 21.5V11" />
      <path d="M9 11c-2.5 0-4-1.5-4-4 1.6 0 3 .6 4 1.6M15 11c2.5 0 4-1.5 4-4-1.6 0-3 .6-4 1.6" />
      <path d="M12 9.5c-1.8 0-3-1.7-3-3.8 0-2.1 1.2-3.2 3-3.2s3 1.1 3 3.2c0 2.1-1.2 3.8-3 3.8Z" />
      <path d="M7.5 21.5h9" />
    </>
  ),
  huevos: (
    <>
      <path d="M12 2.5c3.6 0 6.5 5.5 6.5 10.5a6.5 6.5 0 0 1-13 0c0-5 2.9-10.5 6.5-10.5Z" />
      <path d="M9 14.5a3 3 0 0 0 3 3" />
    </>
  ),
  altramuces: (
    <>
      <ellipse cx="8" cy="9" rx="4.3" ry="3.6" />
      <ellipse cx="16" cy="9" rx="4.3" ry="3.6" />
      <ellipse cx="12" cy="16.5" rx="4.3" ry="3.6" />
      <path d="M7 8.5c.7-.6 1.5-.6 2.2 0M15 8.5c.7-.6 1.5-.6 2.2 0M11 16c.7-.6 1.5-.6 2.2 0" />
    </>
  ),
  sesamo: (
    <>
      <path d="M7 4.5c2 0 3 2.2 3 4.3S8.7 12 7 12 4 10.9 4 8.8 5 4.5 7 4.5Z" />
      <path d="M17.5 7c1.9.7 2.1 3.1 1.4 5.1s-2.5 2.9-4.1 2.3-2-2.3-1.2-4.3S15.6 6.3 17.5 7Z" />
      <path d="M9.5 13.5c1.9.6 2.2 3 1.5 5s-2.4 3-4 2.5-2.1-2.2-1.4-4.2 2-3.9 3.9-3.3Z" />
    </>
  ),
  mostaza: (
    <>
      <path d="M9 9h6l1 11a1.5 1.5 0 0 1-1.5 1.5h-5A1.5 1.5 0 0 1 8 20Z" />
      <path d="M10 9V6.5h4V9M11.2 6.5 12 2.5l.8 4" />
      <path d="M9.6 14h4.8" />
    </>
  ),
  sulfitos: (
    <>
      <path d="M7.5 2.5h9l-.5 6a4 4 0 0 1-8 0Z" />
      <path d="M12 12.5v8M8.5 21.5h7" />
      <path d="M8 6.5h8" />
    </>
  ),
}

/**
 * Pictograma de un alérgeno. `tone`:
 *   contains  círculo relleno (el plato lo lleva)
 *   traces    círculo a trazos (puede contener trazas)
 *   off       apagado (no lo lleva)
 */
export default function AllergenIcon({ id, tone = 'contains', size = 'md', title, className = '' }) {
  const a = getAllergen(id)
  if (!a) return null
  const box = { sm: 'w-7 h-7', md: 'w-10 h-10', lg: 'w-12 h-12' }[size]
  const icon = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-7 h-7' }[size]
  const look = {
    contains: 'bg-tomate text-papel border-tomate',
    traces: 'bg-masa text-tomate border-tomate border-dashed',
    off: 'bg-transparent text-carbon/20 border-carbon/15',
  }[tone]
  return (
    <span
      className={`inline-flex flex-shrink-0 items-center justify-center rounded-full border-[1.5px] ${box} ${look} ${className}`}
      role="img"
      aria-label={title ?? a.label}
      title={title ?? a.label}
    >
      <svg
        viewBox="0 0 24 24"
        className={icon}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {PATHS[id]}
      </svg>
    </span>
  )
}
