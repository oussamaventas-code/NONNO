import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

/* ═══════════════════════════════════════════════════════════════
   CLUB NONNO — estado de la cuenta del cliente en la web

   status: 'loading' | 'guest' (sin entrar) | 'member' (dentro)
           | 'off' (el club aún no está activo en el servidor)
   La sesión vive en una cookie httpOnly: aquí solo se guarda lo que
   devuelve /api/account, nunca un token.
   ═══════════════════════════════════════════════════════════════ */

const AccountContext = createContext(null)

async function call(method, body) {
  let res
  try {
    res = await fetch('/api/account', {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
    })
  } catch {
    return { ok: false, status: 0, data: { error: 'Sin conexión. Revisa internet e inténtalo otra vez.' } }
  }
  /* Una respuesta que no es JSON no viene de nuestra API (p. ej. el
     servidor de desarrollo sin /api): se trata como fallo */
  const data = await res.json().catch(() => null)
  if (data === null) return { ok: false, status: res.status, data: { error: 'El servicio no está disponible ahora mismo.' } }
  return { ok: res.ok, status: res.status, data }
}

export function AccountProvider({ children }) {
  const [status, setStatus] = useState('loading')
  const [account, setAccount] = useState({ customer: null, ledger: [], orders: [] })
  const [open, setOpen] = useState(false)

  const refresh = useCallback(async () => {
    const { ok, status: code, data } = await call('GET')
    if (code === 503 && data.code === 'club-off') return setStatus('off')
    /* Sin servidor (desarrollo local sin /api) el club no se ofrece */
    if (!ok) return setStatus((s) => (s === 'loading' ? 'off' : s))
    setAccount({ customer: data.customer, ledger: data.ledger || [], orders: data.orders || [] })
    setStatus(data.customer ? 'member' : 'guest')
  }, [])

  useEffect(() => { refresh() }, [refresh])

  /* Correo y contraseña. Lo que entra (o se crea) deja la sesión en una cookie. */
  const after = useCallback(async (result) => {
    if (result.ok) await refresh()
    return result
  }, [refresh])

  const register = useCallback((fields) => call('POST', { action: 'register', ...fields }).then(after), [after])
  const login = useCallback((email, password) => call('POST', { action: 'login', email, password }).then(after), [after])
  const forgot = useCallback((email) => call('POST', { action: 'forgot', email }), [])
  const resetPassword = useCallback((token, password) => call('POST', { action: 'reset', token, password }).then(after), [after])

  const updateAccount = useCallback(async (patch) => {
    const result = await call('POST', { action: 'update', ...patch })
    if (result.ok) setAccount((a) => ({ ...a, customer: result.data.customer }))
    return result
  }, [])
  const updateName = useCallback((name) => updateAccount({ name }), [updateAccount])

  const logout = useCallback(async () => {
    await call('POST', { action: 'logout' })
    setAccount({ customer: null, ledger: [], orders: [] })
    setStatus('guest')
  }, [])

  const value = useMemo(() => ({
    status,
    ...account,
    points: account.customer?.points || 0,
    isOpen: open,
    openAccount: () => setOpen(true),
    closeAccount: () => setOpen(false),
    refresh, register, login, forgot, resetPassword, updateAccount, updateName, logout,
  }), [status, account, open, refresh, register, login, forgot, resetPassword, updateAccount, updateName, logout])

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
}

export function useAccount() {
  const ctx = useContext(AccountContext)
  if (!ctx) throw new Error('useAccount debe usarse dentro de <AccountProvider>')
  return ctx
}
