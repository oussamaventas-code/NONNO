import { useState } from 'react'
import { useAccount } from '../store/AccountContext'
import { navigate } from '../lib/router'

/**
 * /cuenta/contrasena?t=… — el enlace del correo "Cambia tu contraseña".
 * Elige una contraseña nueva y queda dentro de su cuenta.
 */
export default function NewPassword() {
  const { resetPassword, openAccount } = useAccount()
  const token = new URLSearchParams(window.location.search).get('t') || ''
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setError('')
    const r = await resetPassword(token, password)
    setBusy(false)
    if (!r.ok) return setError(r.data.error || 'No ha salido. Pide otro enlace.')
    setDone(true)
  }

  return (
    <section className="mx-auto max-w-md px-4 py-16">
      <div className="frame">
        <div className="frame-in p-6">
          {done ? (
            <>
              <p className="font-display font-bold text-2xl text-tomate">Contraseña cambiada</p>
              <p className="mt-2 text-carbon/75">Ya estás dentro de tu cuenta.</p>
              <button onClick={() => { navigate('/'); openAccount() }} className="btn-retro mt-6"><span>Ver mi cuenta</span></button>
            </>
          ) : !token ? (
            <>
              <p className="font-display font-bold text-2xl text-tomate">Enlace no válido</p>
              <p className="mt-2 text-carbon/75">Abre el enlace tal cual te llegó al correo, o pide otro desde "Mi cuenta".</p>
              <button onClick={() => { navigate('/'); openAccount() }} className="btn-retro mt-6"><span>Ir a mi cuenta</span></button>
            </>
          ) : (
            <form onSubmit={submit}>
              <p className="font-display font-bold text-2xl text-tomate">Elige tu contraseña nueva</p>
              <label className="mt-6 flex flex-col gap-1.5">
                <span className="font-sans font-semibold uppercase text-xs tracking-wider text-tomate">Contraseña nueva <span className="normal-case font-normal text-carbon/50">(mínimo 6)</span></span>
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={6}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-md border border-tomate bg-crema px-4 h-12 text-carbon outline-none focus:ring-2 focus:ring-tomate/40"
                />
              </label>
              {error && <p className="mt-3 text-sm font-semibold text-tomate" role="alert">{error}</p>}
              <button className="btn-retro mt-6" disabled={busy}><span>{busy ? 'Guardando…' : 'Guardar contraseña'}</span></button>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}
