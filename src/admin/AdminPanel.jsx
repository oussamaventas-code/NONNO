import { useCallback, useEffect, useRef, useState } from 'react'
import { Bell, BellOff, RefreshCw, LogOut, Pizza, Power, ChefHat, Store, Printer, ClipboardList, Truck, Euro } from 'lucide-react'
import Counter from './Counter'
import Routes from './Routes'
import Stock from './Stock'
import Billing from './Billing'
import { readQueue, enqueue, dequeue, isConnectionError } from './offlineQueue'
import { printTicket } from './printTicket'
import { fetchOrders, updateOrder, createOrder, logout, getPushConfig, savePushSubscription, fetchStoreStatus, setStoreStatus } from './api'
import { useOrderAlert } from './useOrderAlert'
import OrderCard from './OrderCard'
import { price } from '../lib/format'
import { LOCATIONS } from '../data/locations'

const FILTERS = [
  { id: 'activos', label: 'ACTIVOS' },
  { id: 'nuevo', label: 'NUEVOS' },
  { id: 'horno', label: 'EN EL HORNO' },
  { id: 'listo', label: 'LISTOS' },
  { id: 'todos', label: 'TODOS' },
]

/* 4 s: lo bastante rápido para que cocina y mostrador no se
   desincronicen sin machacar la API. Se refuerza con una recarga
   inmediata al volver a la pestaña (ver más abajo). */
const POLL_MS = 4000

const PREF_VIEW = 'nonno.panel.view'
const PREF_AUTOPRINT = 'nonno.panel.autoprint'
const readPref = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? fallback : JSON.parse(raw)
  } catch {
    return fallback
  }
}
const writePref = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* modo privado: solo dura la sesión */ }
}

/* Últimos pedidos cargados, por si se abre el panel sin conexión. */
const cacheKey = (scope) => `nonno.panel.cache.${scope}`

/* Un pedido modificado vuelve a imprimirse: la clave cambia con la edición. */
const printKey = (o) => `${o.id}:${o.edited_at || ''}`

/* Cada sede tiene su color y su cinta superior: nadie debe dudar ni
   un segundo de qué cocina está mirando. */
const SEDES = {
  sangonera: { nombre: 'Sangonera la Verde', banda: 'bg-tomate', texto: 'text-crema' },
  'santo-angel': { nombre: 'Santo Ángel', banda: 'bg-albahaca', texto: 'text-crema' },
}

/** Convierte la clave VAPID a los bytes que espera el navegador. */
function urlBase64ToUint8Array(base64) {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

export default function AdminPanel({ scope, onSignedOut }) {
  /* Solo la dirección (sesión con las dos sedes) ve la facturación:
     es dinero, no algo que necesite el mostrador de un local. */
  const esDireccion = scope === 'all'

  /* Plan B: al abrir sin conexión se ven los últimos pedidos guardados. */
  const [orders, setOrders] = useState(() => readPref(cacheKey(scope), { orders: [] }).orders)
  const [offlineSince, setOfflineSince] = useState(null)
  const [queue, setQueue] = useState(readQueue)
  const [filter, setFilter] = useState('activos')
  /* Solo lo usa la dirección: las sedes no eligen, ven la suya y ya. */
  const [sedeVista, setSedeVista] = useState('todas')
  const [error, setError] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pushState, setPushState] = useState('desconocido')
  const [storeStatuses, setStoreStatuses] = useState({})
  const [togglingStore, setTogglingStore] = useState(null)
  /* Cada equipo recuerda su papel: el ordenador de cocina y el del
     mostrador imprimen cosas distintas en su propia impresora. La
     preferencia es del navegador, no de la sesión: si en ese mismo
     equipo entra luego una sede sin permiso de ver facturación, no
     se queda ahí abierta. */
  const [view, setView] = useState(() => {
    const saved = readPref(PREF_VIEW, 'cocina')
    return saved === 'facturacion' && !esDireccion ? 'cocina' : saved
  })
  const [autoPrint, setAutoPrint] = useState(() => readPref(PREF_AUTOPRINT, false))

  const { play } = useOrderAlert()
  const knownIds = useRef(new Set())
  const firstLoad = useRef(true)
  const printedKeys = useRef(new Set())
  const autoPrintOn = useRef(false)
  autoPrintOn.current = autoPrint && view === 'cocina'

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

      /* Comandas automáticas (solo en el equipo de cocina): cada pedido
         activo sin imprimir sale una vez, y otra vez si se modifica.
         Al abrir el panel no se imprime lo que ya había. */
      const pendingPrint = list.filter((o) =>
        !o.printed_at && !['entregado', 'cancelado'].includes(o.status)
        && !printedKeys.current.has(printKey(o)))
      pendingPrint.forEach((o) => printedKeys.current.add(printKey(o)))
      if (!firstLoad.current && autoPrintOn.current) {
        pendingPrint.forEach((o) => {
          printTicket(o)
          updateOrder(o.id, { printed: true }).catch(() => {})
        })
      }
      firstLoad.current = false

      setOrders(list)
      setOfflineSince(null)
      writePref(cacheKey(scope), { orders: list, at: Date.now() })
      syncQueue()
    } catch (err) {
      if (err.status === 401) { onSignedOut(); return }
      /* Sin conexión: se sigue enseñando lo último que se cargó y se
         reintenta en cada vuelta. El aviso lo pinta la cabecera. */
      if (isConnectionError(err)) setOfflineSince((t) => t || Date.now())
      else setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [play, onSignedOut, scope])

  /* Pedidos del mostrador tomados sin conexión: se envían en cuanto
     el servidor vuelve a responder. Su clave única evita duplicados. */
  const syncing = useRef(false)
  const syncQueue = async () => {
    if (syncing.current) return
    const pending = readQueue().filter((e) => !e.error)
    if (!pending.length) return
    syncing.current = true
    for (const entry of pending) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const { order } = await createOrder(entry.payload)
        dequeue(entry.payload.clientKey)
        if (order) {
          knownIds.current.add(order.id)
          printedKeys.current.add(printKey(order))
          /* Su comanda ya salió en papel: que cocina no la vuelva a imprimir. */
          updateOrder(order.id, { printed: true }).catch(() => {})
          setOrders((prev) => [order, ...prev.filter((o) => o.id !== order.id)])
        }
      } catch (err) {
        if (isConnectionError(err)) break
        /* El servidor lo rechaza (dato que falta, etc.): se queda
           apuntado para que alguien lo revise; la comanda ya salió. */
        enqueue({ ...entry, error: err.message })
      }
    }
    syncing.current = false
    setQueue(readQueue())
  }

  useEffect(() => {
    load()
    const timer = setInterval(load, POLL_MS)
    return () => clearInterval(timer)
  }, [load])

  /* El título vuelve a la normalidad al volver a la pestaña, y se
     recarga al instante: si el panel estuvo minimizado o en segundo
     plano, no hay que esperar al siguiente sondeo para ponerse al día. */
  useEffect(() => {
    const onFocus = () => {
      document.title = 'Panel de cocina · Nonno'
      load()
    }
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load])

  /* ── Apertura de la tienda ───────────────────────────────────── */
  const loadStoreStatus = useCallback(async () => {
    try {
      const { statuses } = await fetchStoreStatus()
      setStoreStatuses(statuses || {})
    } catch {
      /* No se bloquea el panel por esto: el toggle simplemente no aparece bien */
    }
  }, [])

  useEffect(() => {
    loadStoreStatus()
    const timer = setInterval(loadStoreStatus, 15000)
    return () => clearInterval(timer)
  }, [loadStoreStatus])

  const toggleStore = async (locationId, next) => {
    setTogglingStore(locationId)
    try {
      const { status } = await setStoreStatus(locationId, next)
      setStoreStatuses((prev) => ({ ...prev, [locationId]: status }))
    } catch (err) {
      setError(err.message)
    } finally {
      setTogglingStore(null)
    }
  }

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

  /* Pedido creado o cambiado desde el mostrador: entra ya en la lista
     sin esperar al sondeo, y sin sonar en el equipo que lo ha creado. */
  const upsertOrder = (order) => {
    if (order.offline) { setQueue(readQueue()); return }
    knownIds.current.add(order.id)
    setOrders((prev) => (prev.some((o) => o.id === order.id)
      ? prev.map((o) => (o.id === order.id ? order : o))
      : [order, ...prev]))
  }

  const changeView = (next) => { setView(next); writePref(PREF_VIEW, next) }
  const toggleAutoPrint = () => {
    setAutoPrint((on) => { writePref(PREF_AUTOPRINT, !on); return !on })
  }

  const handleLogout = async () => {
    await logout().catch(() => {})
    onSignedOut()
  }

  /* ── Datos derivados ─────────────────────────────────────────── */
  const sede = SEDES[scope]

  /* El servidor ya envía solo lo que esta sesión puede ver. La
     dirección, que las ve todas, puede además filtrar por sede. */
  const porSede = esDireccion && sedeVista !== 'todas'
    ? orders.filter((o) => o.location_id === sedeVista)
    : orders

  /* Sedes en las que este panel puede crear pedidos */
  const locationIds = !esDireccion ? [scope]
    : sedeVista !== 'todas' ? [sedeVista]
      : LOCATIONS.map((l) => l.id)

  const visible = porSede.filter((o) => {
    if (filter === 'todos') return true
    if (filter === 'activos') return !['entregado', 'cancelado'].includes(o.status)
    return o.status === filter
  })
  /* Pendientes en el orden en que tienen que salir del horno. */
  if (filter !== 'todos') {
    const when = (o) => Date.parse(o.ready_at || o.created_at)
    visible.sort((a, b) => when(a) - when(b))
  }

  const today = porSede.filter(
    (o) => new Date(o.created_at).toDateString() === new Date().toDateString()
      && o.status !== 'cancelado'
  )
  const facturado = today.reduce((sum, o) => sum + Number(o.total || 0), 0)
  const pendientes = porSede.filter((o) => o.status === 'nuevo').length

  return (
    <div className="min-h-screen bg-masa">
      {/* Cinta de sede: imposible confundir de cocina */}
      <p className={`${sede?.banda || 'bg-tomate'} ${sede?.texto || 'text-crema'} text-center font-sans font-medium uppercase text-[0.72rem] sm:text-sm h-9 leading-9 px-3 truncate`}>
        {{ mostrador: 'MOSTRADOR', stock: 'STOCK', reparto: 'REPARTO', facturacion: 'FACTURACIÓN' }[view] || 'COCINA'} · {sede ? sede.nombre : 'TODAS LAS SEDES'}
      </p>
      <div className="checker" aria-hidden="true" />

      {/* Plan B visible: nadie trabaja creyendo que el panel está al día */}
      {offlineSince && (
        <div className="bg-forno text-masa px-4 py-3 text-center" role="alert">
          <p className="font-sans font-bold text-sm">
            SIN CONEXIÓN CON EL SERVIDOR desde las {new Date(offlineSince).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
          </p>
          <p className="text-xs text-crema/70 mt-0.5">
            Se ven los últimos pedidos guardados y se reintenta solo. En el mostrador los pedidos se pueden seguir tomando: sale la comanda en papel y se envían al volver la conexión.
            Los clientes de la web ven la opción de pedir por WhatsApp o por teléfono.
          </p>
        </div>
      )}
      {queue.length > 0 && (
        <div className="bg-queso text-carbon border-y border-tomate px-4 py-2 text-sm">
          <p className="font-semibold text-center">
            {queue.filter((e) => !e.error).length > 0 && `${queue.filter((e) => !e.error).length} pedido(s) del mostrador esperando a enviarse. `}
          </p>
          {queue.filter((e) => e.error).map((e) => (
            <p key={e.payload.clientKey} className="text-center">
              {e.order.ref} ({e.order.customer_name}) no se pudo registrar: {e.error}{' '}
              <button
                className="underline"
                onClick={() => { dequeue(e.payload.clientKey); setQueue(readQueue()) }}
              >
                Descartar (ya está en papel)
              </button>
            </p>
          ))}
        </div>
      )}

      <header className="sticky top-0 z-30 bg-masa border-b border-tomate">
        <div className="shell py-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <img
                src="/logo-nonno.png"
                alt=""
                width="56"
                height="56"
                className="h-12 w-12 rounded-full object-cover border border-tomate"
              />
              <div>
                <p className="font-sans font-extrabold uppercase text-base tracking-tight text-tomate leading-none">
                  LA PIZZA DE <em className="font-serif italic font-semibold">NONNO</em>
                </p>
                <p className="mono text-carbon/55 mt-1.5">
                  {sede ? sede.nombre.toUpperCase() : 'TODAS LAS SEDES'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Vista del panel">
                {[
                  { id: 'cocina', label: 'Cocina', Icon: ChefHat },
                  { id: 'mostrador', label: 'Mostrador', Icon: Store },
                  { id: 'reparto', label: 'Reparto', Icon: Truck },
                  { id: 'stock', label: 'Stock', Icon: ClipboardList },
                  /* Solo dirección: es dinero, no algo que vea el mostrador de un local. */
                  ...(esDireccion ? [{ id: 'facturacion', label: 'Facturación', Icon: Euro }] : []),
                ].map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    role="tab"
                    aria-selected={view === id}
                    onClick={() => changeView(id)}
                    className="ptab"
                  >
                    <Icon className="w-4 h-4" /> {label}
                  </button>
                ))}
              </div>

              {view === 'cocina' && (
                <button
                  onClick={toggleAutoPrint}
                  aria-pressed={autoPrint}
                  title="Imprime la comanda de cada pedido nuevo o modificado en la impresora de este equipo"
                  className={[
                    'ptab soft',
                    autoPrint ? '!bg-albahaca !border-albahaca !text-masa' : '',
                  ].join(' ')}
                >
                  <Printer className="w-3.5 h-3.5" /> {autoPrint ? 'Comandas automáticas' : 'Comandas manuales'}
                </button>
              )}

              <button
                onClick={load}
                className="ptab"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Actualizar
              </button>

              {pushState !== 'activo' && pushState !== 'no-disponible' && (
                <button
                  onClick={enablePush}
                  className="ptab !bg-forno !border-forno !text-masa"
                >
                  <BellOff className="w-3.5 h-3.5" /> Activar avisos
                </button>
              )}
              {pushState === 'activo' && (
                <span className="ptab !border-albahaca !text-albahaca pointer-events-none">
                  <Bell className="w-3.5 h-3.5" /> Avisos activos
                </span>
              )}

              <button
                onClick={handleLogout}
                className="w-10 h-10 rounded-md border border-tomate/50 flex items-center justify-center text-tomate hover:bg-tomate/10 transition-colors"
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

          {/* Apertura de la tienda: el interruptor que de verdad abre o
              cierra los pedidos, no solo un adorno visual. */}
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            {(esDireccion ? LOCATIONS.map((l) => l.id) : [scope]).map((locId) => {
              const loc = LOCATIONS.find((l) => l.id === locId)
              const abierta = storeStatuses[locId]?.is_open === true
              const busy = togglingStore === locId
              return (
                <button
                  key={locId}
                  onClick={() => toggleStore(locId, !abierta)}
                  disabled={busy}
                  className={[
                    'ptab disabled:opacity-50',
                    abierta ? '!bg-albahaca !border-albahaca !text-masa' : 'bg-tomate/10',
                  ].join(' ')}
                >
                  <Power className="w-3.5 h-3.5" />
                  {esDireccion ? `${loc?.name.toUpperCase()} · ` : ''}
                  {abierta ? 'ABIERTA — TOCA PARA CERRAR' : 'CERRADA — TOCA PARA ABRIR'}
                </button>
              )
            })}
          </div>

          {/* Cambiar de sede solo lo puede hacer la dirección */}
          {esDireccion && (
            <div className="mt-4 hide-scrollbar flex gap-2 overflow-x-auto border-b border-tomate/25 pb-3">
              {[{ id: 'todas', label: 'TODAS LAS SEDES' },
                ...LOCATIONS.map((l) => ({ id: l.id, label: l.name.toUpperCase() }))
              ].map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSedeVista(s.id)}
                  className={[
                    'ptab soft',
                    sedeVista === s.id
                      ? 'is-on'
                      : '',
                  ].join(' ')}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}

          {view === 'cocina' && <div className="mt-4 hide-scrollbar flex gap-2 overflow-x-auto">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={[
                  'ptab soft',
                  filter === f.id
                    ? 'is-on'
                    : '',
                ].join(' ')}
              >
                {f.label}
              </button>
            ))}
          </div>}
        </div>
      </header>

      <main className="shell py-8">
        {error && (
          <p className="palert mb-6">
            {error}
          </p>
        )}

        {view === 'facturacion' && esDireccion ? (
          <Billing locationId={sedeVista === 'todas' ? null : sedeVista} onError={setError} />
        ) : view === 'stock' ? (
          <Stock locationIds={locationIds} onError={setError} />
        ) : loading ? (
          <p className="mono text-carbon/40 py-16 text-center">CARGANDO PEDIDOS…</p>
        ) : view === 'reparto' ? (
          <Routes orders={porSede} locationIds={locationIds} onSaved={upsertOrder} onError={setError} />
        ) : view === 'mostrador' ? (
          <Counter
            orders={[
              ...queue.map((e) => e.order).filter((o) => locationIds.includes(o.location_id)),
              ...porSede,
            ]}
            locationIds={locationIds}
            defaultLocationId={locationIds[0]}
            onSaved={upsertOrder}
            onError={setError}
          />
        ) : visible.length === 0 ? (
          <div className="py-20 text-center">
            <span className="inline-flex w-16 h-16 rounded-full border border-tomate/50 items-center justify-center text-tomate/60 mb-4">
              <Pizza className="w-7 h-7" strokeWidth={1.5} />
            </span>
            <p className="font-serif italic font-semibold text-xl text-tomate">
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
                onUpdated={upsertOrder}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
