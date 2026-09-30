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

  /* Se entra solo con el móvil (sin código) */
  const login = useCallback(async (phone, name) => {
    const result = await call('POST', { action: 'login', phone, name })
    if (result.ok) await refresh()
    return result
  }, [refresh])

  const sendCode = useCallback((phone) => call('POST', { action: 'send-code', phone }), [])

  const verify = useCallback(async (phone, code, name) => {
    const result = await call('POST', { action: 'verify', phone, code, name })
    if (result.ok) await refresh()
    return result
  }, [refresh])

  const updateName = useCallback(async (name) => {
    const result = await call('POST', { action: 'update', name })
    if (result.ok) setAccount((a) => ({ ...a, customer: result.data.customer }))
    return result
  }, [])

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
    refresh, login, sendCode, verify, updateName, logout,
  }), [status, account, open, refresh, login, sendCode, verify, updateName, logout])

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
}

export function useAccount() {
  const ctx = useContext(AccountContext)
  if (!ctx) throw new Error('useAccount debe usarse dentro de <AccountProvider>')
  return ctx
}
