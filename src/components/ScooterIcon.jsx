/* Moto de reparto con su caja, dibujada como los iconos de lucide
   (que no trae moto): mismo trazo, tamaño y color heredado. */
export default function ScooterIcon({ className = '', strokeWidth = 2, ...rest }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...rest}
    >
      <circle cx="5.5" cy="17.5" r="2.5" />
      <circle cx="18.5" cy="17.5" r="2.5" />
      <rect x="2" y="5.5" width="6.5" height="5" rx="1" />
      <path d="M3 15v-1.5a1 1 0 0 1 1-1h6.5l2.5 5h3" />
      <path d="M18.5 17.5 15.5 6.5h-2" />
    </svg>
  )
}
