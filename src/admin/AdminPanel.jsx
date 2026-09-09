import { useCallback, useEffect, useRef, useState } from 'react'
import { Bell, BellOff, RefreshCw, LogOut, Pizza } from 'lucide-react'
import { fetchOrders, updateOrder, logout, getPushConfig, savePushSubscription } from './api'
import { useOrderAlert } from './useOrderAlert'
import OrderCard from './OrderCard'
import { price } from '../lib/format'

const FILTERS = [
  { id: 'activos', label: 'ACTIVOS' },
  { id: 'nuevo', label: 'NUEVOS' },
  { id: 'horno', label: 'EN EL HORNO' },
  { id: 'listo', label: 'LISTOS' },
  { id: 'todos', label: 'TODOS' },
]

const POLL_MS = 8000

/** Convierte la clave VAPID a los bytes que espera el navegador. */
function urlBase64ToUint8Array(base64) {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

export default function AdminPanel({ onSignedOut }) {
  const [orders, setOrders] = useState([])
  const [filter, setFilter] = useState('activos')
  const [error, setError] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pushState, setPushState] = useState('desconocido')

  const { play } = useOrderAlert()
  const knownIds = useRef(new Set())
  const firstLoad = useRef(true)

  /* ── Carga y sondeo ──────────────────────────────────────────── */
  const load = useCallback(async () => {
    try {
      const { orders: list } = await fetchOrders(80)
      setError(null)

      const fresh = list.filter((o) => !knownIds.current.has(o.id))
      list.forEach((o) => knownIds.current.add(o.id))

      /* En la primera carga no suena: solo con pedidos realmente nuevos. */
      const entrantes = fresh.filter((o) => o.status === 'nuevo')
      if (!firstLoad.current && entrantes.length) {
        play()
        document.title = `(${entrantes.length}) Nuevo pedido · Nonno`
      }
      firstLoad.current = false

      setOrders(list)
    } catch (err) {
      if (err.status === 401) { onSignedOut(); return }
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [play, onSignedOut])

  useEffect(() => {
    load()
    const timer = setInterval(load, POLL_MS)
    return () => clearInterval(timer)
  }, [load])

  /* El título vuelve a la normalidad al volver a la pestaña */
  useEffect(() => {
    const onFocus = () => { document.title = 'Panel de cocina · Nonno' }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  /* ── Avisos del navegador ────────────────────────────────────── */
  useEffect(() => {
    getPushConfig()
      .then((cfg) => {
        if (!cfg.enabled) return setPushState('no-disponible')
        setPushState(Notification.permission === 'granted' ? 'activo' : 'inactivo')
      })
      .catch(() => setPushState('no-disponible'))
  }, [])

  const enablePush = async () => {
    try {
      const cfg = await getPushConfig()
      if (!cfg.enabled || !cfg.publicKey) return setPushState('no-disponible')

      const permission = await Notification.requestPermission()
      if (permission !== 'granted') return setPushState('denegado')

      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(cfg.publicKey),
      })

      await savePushSubscription(sub.toJSON(), 'Panel de cocina')
      setPushState('activo')
    } catch (err) {
      console.error(err)
      setPushState('error')
    }
  }

  /* ── Acciones sobre un pedido ────────────────────────────────── */
  const handleStatus = async (id, status, extra = {}) => {
    setBusyId(id)
    try {
      const { order } = await updateOrder(id, status ? { status, ...extra } : extra)
      setOrders((prev) => prev.map((o) => (o.id === id ? order : o)))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  const handleLogout = async () => {
    await logout().catch(() => {})
    onSignedOut()
  }

  /* ── Datos derivados ─────────────────────────────────────────── */
  const visible = orders.filter((o) => {
    if (filter === 'todos') return true
    if (filter === 'activos') return !['entregado', 'cancelado'].includes(o.status)
    return o.status === filter
  })

  const today = orders.filter(
    (o) => new Date(o.created_at).toDateString() === new Date().toDateString()
      && o.status !== 'cancelado'
  )
  const facturado = today.reduce((sum, o) => sum + Number(o.total || 0), 0)
  const pendientes = orders.filter((o) => o.status === 'nuevo').length

  return (
    <div className="min-h-screen bg-masa">
      <header className="sticky top-0 z-30 bg-crema/95 backdrop-blur-md border-b border-carbon/10">
        <div className="shell py-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="font-sans font-extrabold uppercase text-sm tracking-tight text-carbon">
                LA PIZZA DE <em className="font-serif italic font-semibold">NONNO</em>
              </p>
              <p className="mono text-carbon/45 mt-0.5">PANEL DE COCINA</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={load}
                className="mono normal-case flex items-center gap-1.5 rounded-full border border-carbon/15 px-3 py-2 text-carbon/70 hover:border-carbon/40 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Actualizar
              </button>

              {pushState !== 'activo' && pushState !== 'no-disponible' && (
                <button
                  onClick={enablePush}
                  className="mono normal-case flex items-center gap-1.5 rounded-full bg-carbon px-3 py-2 text-crema"
                >
                  <BellOff className="w-3.5 h-3.5" /> Activar avisos
                </button>
              )}
              {pushState === 'activo' && (
                <span className="mono normal-case flex items-center gap-1.5 rounded-full border border-albahaca/40 px-3 py-2 text-albahaca">
                  <Bell className="w-3.5 h-3.5" /> Avisos activos
                </span>
              )}

              <button
                onClick={handleLogout}
                className="w-9 h-9 rounded-full flex items-center justify-center text-carbon/50 hover:bg-carbon/5 transition-colors"
                aria-label="Salir"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-5 flex-wrap">
            <span className="mono normal-case text-carbon/60">
              <strong className="text-tomate">{pendientes}</strong> sin atender
            </span>
            <span className="mono normal-case text-carbon/60">
              <strong className="text-carbon">{today.length}</strong> pedidos hoy
            </span>
            <span className="mono normal-case text-carbon/60">
              <strong className="text-carbon">{price(facturado)}</strong> hoy
            </span>
          </div>

          <div className="mt-4 hide-scrollbar flex gap-2 overflow-x-auto">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={[
                  'flex-shrink-0 rounded-full px-4 py-2 min-h-[40px] font-sans font-bold uppercase text-[0.7rem] tracking-wide border transition-colors',
                  filter === f.id
                    ? 'bg-carbon text-crema border-carbon'
                    : 'bg-transparent text-carbon/60 border-carbon/15 hover:border-carbon/40',
                ].join(' ')}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="shell py-8">
        {error && (
          <p className="mb-6 rounded-2xl border border-tomate/30 bg-tomate/5 px-4 py-3 text-sm text-tomate">
            {error}
          </p>
        )}

        {loading ? (
          <p className="mono text-carbon/40 py-16 text-center">CARGANDO PEDIDOS…</p>
        ) : visible.length === 0 ? (
          <div className="py-20 text-center">
            <span className="inline-flex w-16 h-16 rounded-full bg-carbon/5 items-center justify-center text-carbon/25 mb-4">
              <Pizza className="w-7 h-7" strokeWidth={1.5} />
            </span>
            <p className="font-serif italic text-lg text-carbon/60">
              {filter === 'activos' ? 'Ningún pedido pendiente ahora mismo.' : 'Nada por aquí.'}
            </p>
            <p className="mono text-carbon/35 mt-2">EL PANEL SE ACTUALIZA SOLO</p>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {visible.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                busy={busyId === order.id}
                onStatus={handleStatus}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
