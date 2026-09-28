import { Pizza } from 'lucide-react'
import { TICKER } from '../data/content'

/** Cinta roja con los lemas de la casa pasando en bucle. */
export default function Ticker() {
  const items = [...TICKER, ...TICKER]
  return (
    <div className="overflow-hidden bg-tomate text-masa border-y border-tomate" aria-label={TICKER.join(' · ')}>
      <ul className="animate-marquee flex w-max items-center gap-8 py-3.5" style={{ animationDuration: '45s' }} aria-hidden="true">
        {[...items, ...items].map((t, i) => (
          <li key={i} className="flex items-center gap-8 font-display italic font-bold text-xl sm:text-2xl whitespace-nowrap">
            {t}
            <Pizza className="w-5 h-5 text-queso" strokeWidth={2} />
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Sello circular con texto que gira despacio. */
export function SpinningStamp({ text, className = '' }) {
  return (
    <div className={`pointer-events-none ${className}`} aria-hidden="true">
      <svg viewBox="0 0 120 120" className="w-full h-full animate-spin-slow">
        <defs>
          <path id="stamp-circle" d="M60,60 m-44,0 a44,44 0 1,1 88,0 a44,44 0 1,1 -88,0" />
        </defs>
        <circle cx="60" cy="60" r="58" fill="rgb(var(--c-queso))" stroke="rgb(var(--c-tomate))" strokeWidth="1.5" />
        <circle cx="60" cy="60" r="52" fill="none" stroke="rgb(var(--c-tomate))" strokeWidth="1" />
        <text fill="rgb(var(--c-tomate))" fontFamily="Barlow, sans-serif" fontWeight="700" fontSize="11.5" letterSpacing="2.2">
          <textPath href="#stamp-circle">{text}{text}</textPath>
        </text>
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-3xl">🍕</span>
    </div>
  )
}
