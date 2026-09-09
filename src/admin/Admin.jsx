import { useEffect, useState } from 'react'
import { Lock } from 'lucide-react'
import { getSession, login } from './api'
import AdminPanel from './AdminPanel'

/**
 * Puerta de entrada al panel de cocina (/admin).
 * Una contraseña compartida; la sesión dura 30 días para que el
 * ordenador del local no tenga que entrar cada mañana.
 */
export default function Admin() {
  const [state, setState] = useState('comprobando') // comprobando | fuera | dentro
  const [configured, setConfigured] = useState(true)
  const [scope, setScope] = useState(null)
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    getSession()
      .then((s) => {
        setConfigured(s.configured)
        setScope(s.scope)
        setState(s.authenticated ? 'dentro' : 'fuera')
      })
      .catch(() => setState('fuera'))
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    setSending(true)
    setError(null)
    try {
      const s = await login(password)
      setPassword('')
      setScope(s.scope)
      setState('dentro')
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  if (state === 'comprobando') {
    return (
      <div className="min-h-screen bg-masa flex items-center justify-center">
        <p className="mono text-carbon/40">ABRIENDO EL PANEL…</p>
      </div>
    )
  }

  if (state === 'dentro') {
    return <AdminPanel scope={scope} onSignedOut={() => { setScope(null); setState('fuera') }} />
  }

  return (
    <div className="min-h-screen bg-forno flex items-center justify-center p-5">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <p className="font-sans font-extrabold uppercase text-sm tracking-tight text-crema">
            LA PIZZA DE <em className="font-serif italic font-semibold">NONNO</em>
          </p>
          <p className="mono text-crema/40 mt-1">PANEL DE COCINA</p>
        </div>

        <form onSubmit={submit} className="bg-crema rounded-block p-7">
          <span className="inline-flex w-11 h-11 rounded-full bg-carbon/5 items-center justify-center text-carbon/50 mb-5">
            <Lock className="w-5 h-5" />
          </span>

          <label htmlFor="admin-password" className="mono text-carbon/50 mb-2 block">
            CONTRASEÑA
          </label>
          <input
            id="admin-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            autoFocus
            className="w-full rounded-2xl border border-carbon/12 bg-white/60 px-4 py-3 text-carbon outline-none focus:border-tomate transition-colors"
          />

          {!configured && (
            <p className="mt-3 text-xs text-tomate">
              El panel todavía no tiene contraseña configurada en el servidor.
            </p>
          )}
          {error && <p className="mt-3 text-sm text-tomate">{error}</p>}

          <button
            type="submit"
            disabled={sending || !password}
            className="btn w-full bg-tomate text-crema mt-5 disabled:opacity-50"
          >
            <span className="btn-layer bg-horno" />
            <span className="btn-label">{sending ? 'ENTRANDO…' : 'ENTRAR'}</span>
          </button>
        </form>
      </div>
    </div>
  )
}
