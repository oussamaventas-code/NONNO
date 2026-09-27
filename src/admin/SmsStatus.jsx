import { useState } from 'react'
import { MessageSquare, MessageSquareWarning } from 'lucide-react'
import { updateOrder } from './api'

const LABEL = { recibido: 'confirmación', listo: 'aviso de listo', cancelado: 'aviso de cancelación' }

/**
 * Estado de los SMS al cliente. Si alguno no salió (móvil del local
 * apagado, sin cobertura…), se ve aquí con un botón para reintentar:
 * el plan B es llamar al cliente.
 */
export default function SmsStatus({ order, onUpdated, onError }) {
  const [busy, setBusy] = useState(false)
  const entries = Object.entries(order.sms || {})
  if (!entries.length) return null

  const failed = entries.filter(([, r]) => !r.ok && !r.skipped)
  const notMobile = entries.some(([, r]) => r.skipped === 'no-es-movil')

  const retry = async (kind) => {
    setBusy(true)
    try {
      const { order: updated } = await updateOrder(order.id, { resendSms: kind })
      onUpdated(updated)
    } catch (err) {
      onError?.(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (failed.length) {
    return (
      <p className="flex flex-wrap items-center gap-2 rounded-xl bg-tomate/10 px-3 py-2 text-sm text-tomate">
        <MessageSquareWarning className="w-4 h-4 flex-shrink-0" />
        No salió el SMS de {failed.map(([k]) => LABEL[k]).join(' y ')} ({failed[0][1].error}).
        <button onClick={() => retry(failed[0][0])} disabled={busy} className="font-semibold underline disabled:opacity-50">
          {busy ? 'Reintentando…' : 'Reintentar'}
        </button>
        <span className="text-tomate/70">o llama al cliente.</span>
      </p>
    )
  }
  if (notMobile) {
    return (
      <p className="flex items-center gap-2 text-xs text-carbon/55">
        <MessageSquare className="w-3.5 h-3.5" /> Sin SMS: el teléfono no es un móvil.
      </p>
    )
  }
  return (
    <p className="flex items-center gap-2 text-xs text-albahaca">
      <MessageSquare className="w-3.5 h-3.5" /> SMS enviado: {entries.filter(([, r]) => r.ok).map(([k]) => LABEL[k]).join(', ')}
    </p>
  )
}
