import { useState } from 'react'
import { Printer, RefreshCw, KeyRound, Copy, Check } from 'lucide-react'
import { getLocation } from '../data/locations'
import { hourOf } from '../lib/kitchenSlots'
import { printTest, printRetry, printTakeover, printInstallKey } from './api'
import { printTicket, printReceipt } from './printTicket'

/* ═══════════════════════════════════════════════════════════════
   NONNO IMPRESORA en el panel
   · Aviso arriba si el programa del local no responde o hay papeles
     que no han salido, con "Imprimir aquí" (por Chrome) como plan B.
   · En ⚙: estado de cada impresora, hoja de prueba y el código para
     instalar el programa en el ordenador del local.
   ═══════════════════════════════════════════════════════════════ */

const ROLE = { cocina: 'Cocina', mostrador: 'Mostrador' }

/** Avisos arriba del panel. `printers` llega con cada carga de pedidos. */
export function PrinterBanner({ printers, locationIds, orders, onError }) {
  const [busy, setBusy] = useState(null)
  const problems = locationIds
    .map((id) => ({ id, s: printers[id] }))
    .filter(({ s }) => s && (!s.online || s.failed > 0))
  if (!problems.length) return null

  /* Plan B: este navegador imprime lo pendiente (con su ventana de imprimir si no es un icono de Nonno) */
  const takeover = async (id) => {
    setBusy(id)
    try {
      const { jobs } = await printTakeover(id)
      for (const job of jobs) {
        const order = orders.find((o) => o.id === job.order_id)
        if (!order) continue
        if (job.kind === 'ticket') await printReceipt(order, { browser: true })
        else if (job.kind === 'comanda') await printTicket(order, { browser: true })
      }
    } catch (err) { onError(err.message) } finally { setBusy(null) }
  }
  const retry = async (id) => {
    setBusy(id)
    try { await printRetry(id) } catch (err) { onError(err.message) } finally { setBusy(null) }
  }

  return problems.map(({ id, s }) => (
    <div key={id} className="bg-tomate text-masa px-4 py-3" role="alert">
      <p className="font-sans font-bold text-sm text-center flex items-center justify-center gap-2 flex-wrap">
        <Printer className="w-4 h-4" />
        {!s.online
          ? `IMPRESORA DE ${getLocation(id)?.name?.toUpperCase()} SIN CONEXIÓN desde las ${hourOf(s.seenAt)}`
          : `${s.failed} PAPEL${s.failed === 1 ? '' : 'ES'} NO HA${s.failed === 1 ? '' : 'N'} SALIDO EN ${getLocation(id)?.name?.toUpperCase()}`}
        {s.pending > 0 && ` · ${s.pending} esperando`}
      </p>
      <p className="text-xs text-center text-masa/85 mt-0.5">
        {!s.online
          ? 'Mira que el ordenador del local esté encendido y con internet. Al volver imprime lo pendiente solo.'
          : `¿Sin papel o apagada? ${printerHint(s)}`}
      </p>
      <div className="mt-2 flex justify-center gap-2 flex-wrap">
        {s.online && s.failed > 0 && (
          <button onClick={() => retry(id)} disabled={busy === id} className="rounded-md border border-masa/60 px-3 py-1.5 text-xs font-bold uppercase disabled:opacity-50">
            <RefreshCw className="inline w-3.5 h-3.5 mr-1" /> Reintentar
          </button>
        )}
        <button onClick={() => takeover(id)} disabled={busy === id} className="rounded-md bg-masa text-tomate px-3 py-1.5 text-xs font-bold uppercase disabled:opacity-50">
          <Printer className="inline w-3.5 h-3.5 mr-1" /> {busy === id ? 'Imprimiendo…' : 'Imprimir aquí'}
        </button>
      </div>
    </div>
  ))
}

const printerHint = (s) => Object.entries(s.info || {})
  .filter(([k, v]) => ROLE[k] && v && !v.ok)
  .map(([k, v]) => `${ROLE[k]}: ${v.status}.`).join(' ')

/** Sección "Impresoras" del menú ⚙ */
export function PrinterSettings({ printers, locationIds, onError }) {
  const [msg, setMsg] = useState('')
  const [key, setKey] = useState(null) // { id, key }
  const [copied, setCopied] = useState(false)

  const test = async (id, role) => {
    setMsg('')
    try {
      await printTest(id, role)
      setMsg(`Prueba enviada a ${ROLE[role].toLowerCase()} de ${getLocation(id)?.name}.`)
    } catch (err) { onError(err.message) }
  }
  const showKey = async (id) => {
    try { setKey({ id, key: (await printInstallKey(id)).key }); setCopied(false) } catch (err) { onError(err.message) }
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="mono text-tomate">IMPRESORAS</p>
      {locationIds.map((id) => {
        const s = printers[id]
        return (
          <div key={id} className="rounded-md border border-tomate/30 p-3 text-sm">
            <p className="font-bold text-carbon">{getLocation(id)?.name}</p>
            {!s ? (
              <p className="text-carbon/60 mt-0.5">Sin Nonno Impresora: imprime este navegador.</p>
            ) : (
              <>
                <p className={['mt-0.5 font-semibold', s.online ? 'text-albahaca' : 'text-tomate'].join(' ')}>
                  {s.online ? 'Nonno Impresora conectada' : `Sin conexión desde las ${hourOf(s.seenAt)}`}
                </p>
                {Object.entries(ROLE).map(([role, label]) => s.info?.[role] && (
                  <p key={role} className="text-xs text-carbon/70">
                    {label}: {s.info[role].name || '—'} · <span className={s.info[role].ok ? 'text-albahaca' : 'text-tomate'}>{s.info[role].status}</span>
                  </p>
                ))}
                <div className="mt-2 flex gap-2">
                  <button onClick={() => test(id, 'cocina')} className="ptab soft flex-1">Prueba cocina</button>
                  <button onClick={() => test(id, 'mostrador')} className="ptab soft flex-1">Prueba mostrador</button>
                </div>
              </>
            )}
            {key?.id === id ? (
              <div className="mt-2">
                <p className="text-xs text-carbon/70">Código para el instalador de este local (no lo compartas):</p>
                <div className="mt-1 flex gap-2">
                  <input readOnly value={key.key} onFocus={(e) => e.target.select()} className="pfield !py-1.5 text-xs font-mono flex-1" aria-label="Código de instalación" />
                  <button
                    onClick={async () => { try { await navigator.clipboard.writeText(key.key); setCopied(true) } catch { /* copiar a mano */ } }}
                    className="ptab soft" aria-label="Copiar código"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => showKey(id)} className="mt-2 mono normal-case text-xs text-carbon/60 hover:text-tomate flex items-center gap-1">
                <KeyRound className="w-3.5 h-3.5" /> Código de instalación
              </button>
            )}
          </div>
        )
      })}
      {msg && <p className="text-xs text-albahaca">{msg}</p>}
    </div>
  )
}
