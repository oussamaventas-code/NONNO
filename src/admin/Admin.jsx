import { useCallback, useEffect, useState } from 'react'
import { Lock } from 'lucide-react'
import { getSession, login } from './api'
import { getLocation } from '../data/locations'
import AdminPanel from './AdminPanel'

/* Color de cada local, para que el enlace de cada cocina se
   reconozca de un vistazo antes incluso de entrar. */
const COLOR = {
  sangonera: 'bg-tomate',
  'santo-angel': 'bg-albahaca',
}

/**
 * Puerta de entrada al panel de cocina.
 *
 * /admin                 → login normal
 * /admin/sangonera       → enlace propio del local de Sangonera
 * /admin/santo-angel     → enlace propio del local de Santo Ángel
 *
 * La dirección solo cambia lo que se ve en el login: quien decide qué
 * pedidos se muestran es la contraseña, comprobada en el servidor.
 * Por eso, tras entrar, la dirección se corrige para que coincida con
 * lo que esa clave abre de verdad.
 */
export default function Admin({ sedeEnRuta = null, base = '/admin', title = 'PANEL DE COCINA', Inside = AdminPanel }) {
  const [state, setState] = useState('comprobando') // comprobando | fuera | dentro
  const [configured, setConfigured] = useState(true)
  const [scope, setScope] = useState(null)
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [sending, setSending] = useState(false)

  /* Solo vale si es una sede que existe de verdad */
  const sede = sedeEnRuta ? getLocation(sedeEnRuta) : null

  /** Deja la dirección acorde con lo que abre la contraseña usada. */
  const ajustarRuta = useCallback((abre) => {
    /* La dirección puede ver cualquier sede: se respeta la de la URL. */
    const sedeFinal = abre && abre !== 'all' ? abre : (base === '/pantalla' ? sedeEnRuta : null)
    const destino = sedeFinal ? `${base}/${sedeFinal}` : base
    if (window.location.pathname.replace(/\/+$/, '') !== destino) {
      window.history.replaceState(null, '', destino)
    }
  }, [base, sedeEnRuta])

  useEffect(() => {
    getSession()
      .then((s) => {
        setConfigured(s.configured)
        setScope(s.scope)
        setState(s.authenticated ? 'dentro' : 'fuera')
        if (s.authenticated) ajustarRuta(s.scope)
      })
      .catch(() => setState('fuera'))
  }, [ajustarRuta])

  const submit = async (e) => {
    e.preventDefault()
    setSending(true)
    setError(null)
    try {
      const s = await login(password)
      setPassword('')
      setScope(s.scope)
      setState('dentro')
      ajustarRuta(s.scope)
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
    return <Inside scope={scope} sedeEnRuta={sedeEnRuta} onSignedOut={() => { setScope(null); setState('fuera') }} />
  }

  return (
    <div className="min-h-screen bg-masa flex flex-col">
      {/* Cinta de aviso, igual que la de la web; en el enlace de una sede
          lleva el color de esa cocina para no confundirse. */}
      <p className={`${sede ? (COLOR[sede.id] || 'bg-tomate') : 'bg-tomate'} text-masa text-center font-sans font-medium uppercase text-[0.72rem] sm:text-sm h-9 leading-9 px-3 truncate`}>
        {sede ? `COCINA · ${sede.name}` : title}
      </p>
      <div className="checker" aria-hidden="true" />

      <div className="flex-1 flex items-center justify-center p-5">
        <div className="w-full max-w-sm">
          <div className="text-center mb-7">
            <img
              src="/logo-nonno.png"
              alt="La Pizza de Nonno"
              width="88"
              height="88"
              className="mx-auto h-[5.5rem] w-[5.5rem] rounded-full object-cover border border-tomate"
            />
            <p className="mt-4 font-sans font-extrabold uppercase text-base tracking-tight text-tomate">
              LA PIZZA DE <em className="font-serif italic font-semibold">NONNO</em>
            </p>
            <p className="mono text-tomate mt-1">
              {sede ? `${title} · ${sede.name.toUpperCase()}` : title}
            </p>
          </div>

          <form onSubmit={submit} className="pframe">
            <div className="pframe-in p-6">
              <span className="inline-flex w-11 h-11 rounded-full border border-tomate items-center justify-center text-tomate mb-5">
                <Lock className="w-5 h-5" />
              </span>

              <label htmlFor="admin-password" className="mono text-tomate mb-2 block">
                CONTRASEÑA{sede ? ` DE ${sede.name.toUpperCase()}` : ''}
              </label>
              <input
                id="admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                autoFocus
                className="pfield"
              />

              {!configured && (
                <p className="mt-3 text-xs text-tomate">
                  El panel todavía no tiene contraseña configurada en el servidor.
                </p>
              )}
              {error && <p className="mt-3 text-sm font-semibold text-tomate">{error}</p>}

              <button
                type="submit"
                disabled={sending || !password}
                className="btn w-full bg-tomate text-crema mt-5 disabled:opacity-50"
              >
                <span className="btn-layer bg-forno" />
                <span className="btn-label">{sending ? 'ENTRANDO…' : 'ENTRAR'}</span>
              </button>
            </div>
          </form>

          {sedeEnRuta && !sede && (
            <p className="mono normal-case text-carbon/50 text-center mt-5">
              Esa sede no existe. Entra con tu contraseña igualmente.
            </p>
          )}
        </div>
      </div>

      <div className="checker" aria-hidden="true" />
    </div>
  )
}
