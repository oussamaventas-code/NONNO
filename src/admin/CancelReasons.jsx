import { useEffect } from 'react'

/* Motivos al cancelar un pedido: un toque, sin escribir. Los mismos
   valores que acepta la API (CANCEL_REASONS en api/orders/[id].js). */
export const CANCEL_LABEL = {
  cliente: 'Lo cancela el cliente',
  'sin-producto': 'Nos falta producto',
  error: 'Error al apuntarlo',
  'no-vino': 'No vino a recogerlo',
  otro: 'Otro motivo',
}

/**
 * Sustituye al botón de cancelar: pregunta por qué y, al elegir, cancela.
 * Se cierra solo a los 8 s para que un toque suelto no lo deje abierto.
 */
export default function CancelReasons({ onPick, onBack, disabled }) {
  useEffect(() => {
    const timer = setTimeout(onBack, 8000)
    return () => clearTimeout(timer)
  }, [onBack])

  return (
    <div className="w-full rounded-md border border-tomate bg-tomate/10 p-3">
      <p className="mono text-tomate mb-2">¿POR QUÉ SE CANCELA?</p>
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(CANCEL_LABEL).map(([id, label]) => (
          <button key={id} onClick={() => onPick(id)} disabled={disabled} className="ptab soft !bg-masa disabled:opacity-50">
            {label}
          </button>
        ))}
        <button onClick={onBack} className="ptab soft border-transparent">Volver</button>
      </div>
    </div>
  )
}
