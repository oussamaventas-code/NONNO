import { useCallback, useEffect, useRef, useState } from 'react'
import { Bell, BellOff, RefreshCw, LogOut, Power, ChefHat, Store, Printer, ClipboardList, Truck, Euro, BookOpen, Settings, Maximize, Undo2, Wallet, LayoutDashboard, Percent, MoreHorizontal, X } from 'lucide-react'
import Counter from './Counter'
import Routes from './Routes'
import Stock from './Stock'
import Carta from './Carta'
import CashClose from './CashClose'
import TodayBoard from './TodayBoard'
import { useMenuOverrides } from '../hooks/useMenuOverrides'
import Billing from './Billing'
import Discounts from './Discounts'
import { readQueue, enqueue, dequeue, isConnectionError } from './offlineQueue'
import { printTicket } from './printTicket'
import { fetchOrders, updateOrder, createOrder, logout, getPushConfig, savePushSubscription, fetchStoreStatus, setStoreStatus, testSms } from './api'
import { useOrderAlert } from './useOrderAlert'
import KitchenBoard from './KitchenBoard'
import { price } from '../lib/format'
import { LOCATIONS } from '../data/locations'

/* Pestañas del panel y qué equipo ve cuáles. Cada ordenador o tablet
   se configura una vez (menú ⚙ → Este equipo) y solo enseña lo suyo:
   la cocina no necesita el TPV, ni el mostrador el tablero del horno. */
const ALL_TABS = [
  /* Solo dirección: las dos sedes de un vistazo */
  { id: 'hoy', label: 'Hoy', Icon: LayoutDashboard },
  { id: 'cocina', label: 'Cocina', Icon: ChefHat },
  { id: 'mostrador', label: 'Mostrador', Icon: Store },
  { id: 'reparto', label: 'Reparto', Icon: Truck },
  { id: 'stock', label: 'Stock', Icon: ClipboardList },
  { id: 'caja', label: 'Caja', Icon: Wallet },
  { id: 'carta', label: 'Carta', Icon: BookOpen },
  /* Solo dirección: es dinero, no algo que vea el mostrador de un local. */
  { id: 'facturacion', label: 'Facturación', Icon: Euro },
  /* Solo dirección: rebajan precios en todas las sedes. */
  { id: 'descuentos', label: 'Descuentos', Icon: Percent },
]

/* Móvil: las que van siempre en la barra de abajo (si este equipo las
   tiene). El resto se abre desde «Más». */
const MOBILE_FIRST = ['hoy', 'cocina', 'mostrador', 'descuentos']
const MOBILE_SLOTS = 4

const DEVICE_MODES = [
  { id: 'completo', label: 'Todo', hint: 'Enseña todas las pestañas.', tabs: null },
  { id: 'cocina', label: 'Cocina', hint: 'Solo el tablero del horno y el stock.', tabs: ['cocina', 'stock'] },
  { id: 'mostrador', label: 'Mostrador', hint: 'TPV, reparto, caja, carta y facturación.', tabs: ['mostrador', 'reparto', 'caja', 'carta', 'facturacion', 'descuentos'] },
]

/* Cada cuánto vuelve a sonar un pedido nuevo que nadie ha marcado como visto */
const REPEAT_ALARM_MS = 10000
/* Tiempo para deshacer un cambio de estado */
const UNDO_MS = 10000

/* 4 s: lo bastante rápido para que cocina y mostrador no se
   desincronicen sin machacar la API. Se refuerza con una recarga
   inmediata al volver a la pestaña (ver más abajo). */
const POLL_MS = 4000

const PREF_VIEW = 'nonno.panel.view'
const PREF_DEVICE = 'nonno.panel.device'
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
  const [viewPref, setView] = useState(() => readPref(PREF_VIEW, esDireccion ? 'hoy' : 'cocina'))
  const [deviceMode, setDeviceMode] = useState(() => readPref(PREF_DEVICE, 'completo'))
  const [menuOpen, setMenuOpen] = useState(false)
  /* Móvil: hoja «Más» con el resto de secciones */
  const [moreOpen, setMoreOpen] = useState(false)
  const [confirmClose, setConfirmClose] = useState(null)
  const [undo, setUndo] = useState(null)
  const [testPhone, setTestPhone] = useState('')
  const [testResult, setTestResult] = useState(null)
  const [autoPrint, setAutoPrint] = useState(() => readPref(PREF_AUTOPRINT, false))

  /* Carta corregida (precios, ocultos, agotados): el mostrador vende con ella.
     `menuVersion` repinta el panel cuando cambia. */
  const menuVersion = useMenuOverrides()
  const [, setMenuTick] = useState(0)
  const refreshMenu = useCallback(() => setMenuTick((n) => n + 1), [])
  void menuVersion

  const { play, unlock, ready: soundReady } = useOrderAlert()
  const knownIds = useRef(new Set())
  const firstLoad = useRef(true)
  const printedKeys = useRef(new Set())
  const autoPrintOn = useRef(false)

  /* ── Carga y sondeo ──────────────────────────────────────────── */
  const load = useCallback(async () => {
    try {
      /* La dirección ve las dos sedes: necesita más margen */
      const { orders: list } = await fetchOrders(esDireccion ? 160 : 80)
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
  const handleStatus = async (id, status, extra = {}, { silent = false } = {}) => {
    setBusyId(id)
    const before = orders.find((o) => o.id === id)
    try {
      const { order } = await updateOrder(id, status ? { status, ...extra } : extra)
      setOrders((prev) => prev.map((o) => (o.id === id ? order : o)))
      /* Solo se puede deshacer el avance en el horno: entregar o cancelar
         reparte puntos del Club Nonno y no se revierte con un toque. */
      if (!silent && before && status && ['horno', 'listo'].includes(status) && ['nuevo', 'horno'].includes(before.status)) {
        setUndo({ id, ref: order.ref, from: before.status, to: status, label: status === 'horno' ? 'EN EL HORNO' : 'LISTO', at: Date.now() })
      }
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
  const changeDevice = (next) => { setDeviceMode(next); writePref(PREF_DEVICE, next) }
  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen?.()
    else document.documentElement.requestFullscreen?.().catch(() => {})
    setMenuOpen(false)
  }
  const undoLast = () => {
    if (!undo) return
    const { id, from } = undo
    setUndo(null)
    handleStatus(id, from, {}, { silent: true })
  }
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

  /* Pestañas de este equipo, y la vista efectiva (si la guardada ya no
     le toca a este equipo, se cae a la primera que sí). */
  const modeTabs = DEVICE_MODES.find((m) => m.id === deviceMode)?.tabs
  const tabs = ALL_TABS.filter((t) => (!modeTabs || modeTabs.includes(t.id)) && (!['facturacion', 'hoy', 'descuentos'].includes(t.id) || esDireccion))
  const view = tabs.some((t) => t.id === viewPref) ? viewPref : tabs[0].id
  autoPrintOn.current = autoPrint && view === 'cocina'

  /* Móvil: barra de abajo (4 secciones fijas y «Más» con el resto) */
  const needsMore = tabs.length > MOBILE_SLOTS + 1
  const bottomTabs = needsMore
    ? [...tabs.filter((t) => MOBILE_FIRST.includes(t.id)), ...tabs.filter((t) => !MOBILE_FIRST.includes(t.id))].slice(0, MOBILE_SLOTS)
    : tabs
  const moreTabs = tabs.filter((t) => !bottomTabs.includes(t))
  const viewTab = tabs.find((t) => t.id === view)

  /* Estado de la tienda de cada sede que este panel gestiona */
  const storeList = (esDireccion ? LOCATIONS.map((l) => l.id) : [scope]).map((id) => ({
    id,
    name: LOCATIONS.find((l) => l.id === id)?.name || id,
    abierta: storeStatuses[id]?.is_open === true,
  }))

  /* Pedidos nuevos que nadie ha visto todavía: suenan hasta que se marquen */
  /* Un pedido programado para dentro de mucho no suena hasta que se acerca su hora */
  const farOff = (o) => o.scheduled_for && o.ready_at && Date.parse(o.ready_at) - Date.now() > 45 * 60000
  const unseen = porSede.filter((o) => o.status === 'nuevo' && !o.seen_at && !farOff(o) && Date.now() - Date.parse(o.created_at) < 3600000)
  const unseenCount = unseen.length

  /* La alarma se repite hasta que alguien marque el pedido como visto
     (el equipo de mostrador no la repite: ahí se atiende al cliente). */
  useEffect(() => {
    if (!unseenCount || deviceMode === 'mostrador') return undefined
    const timer = setInterval(play, REPEAT_ALARM_MS)
    return () => clearInterval(timer)
  }, [unseenCount, deviceMode, play])

  useEffect(() => {
    document.title = unseenCount ? `(${unseenCount}) Nuevo pedido · Nonno` : 'Panel de cocina · Nonno'
  }, [unseenCount])

  /* El aviso de deshacer se apaga solo */
  useEffect(() => {
    if (!undo) return undefined
    const timer = setTimeout(() => setUndo(null), UNDO_MS)
    return () => clearTimeout(timer)
  }, [undo])

  const today = porSede.filter(
    (o) => new Date(o.created_at).toDateString() === new Date().toDateString()
      && o.status !== 'cancelado'
  )
  const facturado = today.reduce((sum, o) => sum + Number(o.total || 0), 0)
  const pendientes = porSede.filter((o) => o.status === 'nuevo').length

  return (
    <div className="min-h-screen bg-masa overflow-x-clip pb-[calc(4.75rem+env(safe-area-inset-bottom))] md:pb-0">
      {/* Móvil: la cinta de sede se queda en una raya de su color */}
      <div className={`md:hidden h-1.5 ${sede?.banda || 'bg-tomate'}`} aria-hidden="true" />
      {/* Cinta de sede: imposible confundir de cocina */}
      <p className={`hidden md:block ${sede?.banda || 'bg-tomate'} ${sede?.texto || 'text-crema'} text-center font-sans font-medium uppercase text-[0.72rem] sm:text-sm h-9 leading-9 px-3 truncate`}>
        {{ hoy: 'HOY', mostrador: 'MOSTRADOR', stock: 'STOCK', reparto: 'REPARTO', caja: 'CIERRE DE CAJA', carta: 'CARTA', facturacion: 'FACTURACIÓN', descuentos: 'DESCUENTOS' }[view] || 'COCINA'} · {sede ? sede.nombre : 'TODAS LAS SEDES'}
      </p>
      <div className="checker hidden md:block" aria-hidden="true" />

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
        {/* ── Móvil: una sola línea. Sección, sede, tienda y ajustes ── */}
        <div className="md:hidden">
          <div className="flex items-center gap-3 px-4 h-14">
            <img src="/logo-nonno.png" alt="" width="36" height="36" className="h-9 w-9 flex-shrink-0 rounded-full object-cover border border-tomate" />
            <div className="min-w-0 flex-1">
              <p className="font-sans font-extrabold uppercase text-lg leading-none text-carbon truncate">{viewTab?.label || 'Cocina'}</p>
              <p className="mt-1 mono normal-case text-carbon/55 truncate">
                {sede ? sede.nombre : sedeVista === 'todas' ? 'Todas las sedes' : LOCATIONS.find((l) => l.id === sedeVista)?.name}
              </p>
            </div>
            {/* Tienda abierta o cerrada: se cambia en ajustes */}
            <button
              onClick={() => setMenuOpen(true)}
              className={[
                'flex-shrink-0 flex items-center gap-1.5 rounded-full border px-3 h-9 text-xs font-extrabold uppercase tracking-wide',
                storeList.every((x) => x.abierta) ? 'border-albahaca text-albahaca' : storeList.some((x) => x.abierta) ? 'border-horno text-horno' : 'border-tomate text-tomate',
              ].join(' ')}
              aria-label="Abrir o cerrar la tienda"
            >
              <span className={['w-2 h-2 rounded-full', storeList.some((x) => x.abierta) ? 'bg-albahaca' : 'bg-tomate'].join(' ')} />
              {storeList.length > 1
                ? `${storeList.filter((x) => x.abierta).length}/${storeList.length} abiertas`
                : storeList[0]?.abierta ? 'Abierta' : 'Cerrada'}
            </button>
            <button
              onClick={() => setMenuOpen((o) => !o)}
              aria-expanded={menuOpen}
              aria-label="Ajustes del panel"
              className="flex-shrink-0 w-10 h-10 rounded-md border border-tomate/60 flex items-center justify-center text-tomate"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
          {/* Dirección: qué sede mirar, en tres botones que caben siempre */}
          {esDireccion && view !== 'descuentos' && (
            <div className="grid grid-cols-3 gap-1.5 px-4 pb-3">
              {[{ id: 'todas', label: 'Todas' }, ...LOCATIONS.map((l) => ({ id: l.id, label: l.name.replace(' la Verde', '') }))].map((x) => (
                <button
                  key={x.id}
                  onClick={() => setSedeVista(x.id)}
                  className={['ptab soft !min-h-[38px] !px-1 !text-[0.68rem] truncate', sedeVista === x.id ? 'is-on' : ''].join(' ')}
                >
                  {x.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="shell py-3 hidden md:block">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <img
                src="/logo-nonno.png"
                alt=""
                width="56"
                height="56"
                className="h-11 w-11 rounded-full object-cover border border-tomate"
              />
              <div className="hidden sm:block">
                <p className="font-sans font-extrabold uppercase text-base tracking-tight text-tomate leading-none">
                  LA PIZZA DE <em className="font-serif italic font-semibold">NONNO</em>
                </p>
                <p className="mono text-carbon/55 mt-1.5">
                  {sede ? sede.nombre.toUpperCase() : 'TODAS LAS SEDES'}
                </p>
              </div>
            </div>

            {tabs.length > 1 && (
              <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Vista del panel">
                {tabs.map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    role="tab"
                    aria-selected={view === id}
                    onClick={() => changeView(id)}
                    className="ptab"
                  >
                    <Icon className="w-4 h-4" /> {label}
                    {id === 'cocina' && pendientes > 0 && (
                      <span className="rounded-full bg-queso px-1.5 text-[0.7rem] leading-5 text-carbon">{pendientes}</span>
                    )}
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2">
              {/* Estado de la tienda: siempre a la vista, se cambia desde el menú */}
              {storeList.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setMenuOpen(true)}
                  className={[
                    'ptab soft',
                    s.abierta ? '!bg-albahaca !border-albahaca !text-masa' : '!border-tomate !text-tomate bg-tomate/10',
                  ].join(' ')}
                  title="Abrir o cerrar la tienda (menú ⚙)"
                >
                  <Power className="w-3.5 h-3.5" />
                  {esDireccion ? `${s.name} · ` : ''}{s.abierta ? 'ABIERTA' : 'CERRADA'}
                </button>
              ))}
              <button
                onClick={() => setMenuOpen((o) => !o)}
                aria-expanded={menuOpen}
                aria-label="Menú del panel"
                className="w-10 h-10 rounded-md border border-tomate/60 flex items-center justify-center text-tomate hover:bg-tomate/10 transition-colors"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>

          {(esDireccion || view === 'mostrador') && (
            <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
              {esDireccion ? (
                <div className="hide-scrollbar flex gap-2 overflow-x-auto">
                  {[{ id: 'todas', label: 'TODAS LAS SEDES' },
                    ...LOCATIONS.map((l) => ({ id: l.id, label: l.name.toUpperCase() })),
                  ].map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSedeVista(s.id)}
                      className={['ptab soft', sedeVista === s.id ? 'is-on' : ''].join(' ')}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              ) : <span />}
              <span className="mono normal-case text-carbon/60">
                <strong className="text-carbon">{today.length}</strong> pedidos hoy · <strong className="text-carbon">{price(facturado)}</strong>
              </span>
            </div>
          )}
        </div>

        {/* Menú del panel: lo que se toca poco vive aquí, no en la cabecera */}
        {menuOpen && (
          <>
            <button className="fixed inset-0 z-40 cursor-default" aria-label="Cerrar menú" onClick={() => { setMenuOpen(false); setConfirmClose(null) }} />
            <div className="absolute right-3 sm:right-8 top-full z-50 mt-2 w-[min(22rem,calc(100vw-1.5rem))] pframe shadow-ember">
              <div className="pframe-in p-4 flex flex-col gap-4 max-h-[80vh] overflow-y-auto">
                <div>
                  <p className="mono text-tomate mb-2">TIENDA</p>
                  <div className="flex flex-col gap-2">
                    {storeList.map((s) => (
                      <div key={s.id}>
                        {confirmClose === s.id ? (
                          <div className="rounded-md border border-tomate bg-tomate/10 p-3">
                            <p className="text-sm font-bold text-tomate">¿Cerrar {s.name}? La web dejará de aceptar pedidos.</p>
                            <div className="mt-2 flex gap-2">
                              <button onClick={() => { toggleStore(s.id, false); setConfirmClose(null) }} className="ptab soft !bg-tomate !border-tomate !text-masa flex-1">Sí, cerrar</button>
                              <button onClick={() => setConfirmClose(null)} className="ptab soft flex-1">No</button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => (s.abierta ? setConfirmClose(s.id) : toggleStore(s.id, true))}
                            disabled={togglingStore === s.id}
                            className={['ptab w-full justify-start disabled:opacity-50', s.abierta ? '!bg-albahaca !border-albahaca !text-masa' : ''].join(' ')}
                          >
                            <Power className="w-4 h-4" />
                            {s.name} · {s.abierta ? 'ABIERTA (tocar para cerrar)' : 'CERRADA (tocar para abrir)'}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mono text-tomate mb-2">ESTE EQUIPO</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {DEVICE_MODES.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => changeDevice(m.id)}
                        aria-pressed={deviceMode === m.id}
                        className="ptab soft"
                        title={m.hint}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                  <p className="mono normal-case text-carbon/50 mt-1.5">{DEVICE_MODES.find((m) => m.id === deviceMode)?.hint}</p>
                </div>

                <div className="flex flex-col gap-2">
                  <p className="mono text-tomate">AJUSTES</p>
                  <button
                    onClick={toggleAutoPrint}
                    aria-pressed={autoPrint}
                    title="Imprime la comanda de cada pedido nuevo o modificado en la impresora de este equipo"
                    className={['ptab w-full justify-start', autoPrint ? '!bg-albahaca !border-albahaca !text-masa' : ''].join(' ')}
                  >
                    <Printer className="w-4 h-4" /> {autoPrint ? 'Comandas automáticas: SÍ' : 'Comandas automáticas: NO'}
                  </button>
                  {pushState === 'activo' ? (
                    <span className="ptab w-full justify-start !border-albahaca !text-albahaca pointer-events-none">
                      <Bell className="w-4 h-4" /> Avisos del navegador activos
                    </span>
                  ) : pushState !== 'no-disponible' && (
                    <button onClick={enablePush} className="ptab w-full justify-start">
                      <BellOff className="w-4 h-4" /> Activar avisos del navegador
                    </button>
                  )}
                  {/* SMS de prueba: para comprobar al abrir que los avisos salen */}
                  <div className="rounded-md border border-tomate/40 p-2.5">
                    <p className="mono normal-case text-carbon/60 mb-1.5">Probar los avisos a clientes (WhatsApp / SMS)</p>
                    <div className="flex gap-1.5">
                      <input
                        type="tel"
                        inputMode="tel"
                        value={testPhone}
                        onChange={(e) => { setTestPhone(e.target.value); setTestResult(null) }}
                        placeholder="Tu móvil"
                        aria-label="Móvil para el SMS de prueba"
                        className="pfield !py-2 text-sm"
                      />
                      <button
                        onClick={async () => {
                          setTestResult({ sending: true })
                          try { setTestResult(await testSms(testPhone)) } catch (err) { setTestResult({ ok: false, error: err.message }) }
                        }}
                        disabled={!testPhone.trim() || testResult?.sending}
                        className="ptab soft disabled:opacity-50"
                      >
                        Enviar
                      </button>
                    </div>
                    {testResult && !testResult.sending && (
                      <p className={['mt-1.5 text-xs font-semibold', testResult.ok ? 'text-albahaca' : 'text-tomate'].join(' ')}>
                        {testResult.ok
                          ? testResult.via === 'whatsapp'
                            ? 'Enviado por WhatsApp. Si en un minuto no llega, mira Twilio → Monitor → Logs.'
                            : `SMS enviado por ${testResult.provider === 'twilio' ? 'Twilio' : 'el Android del local'}. Mira el móvil.`
                          : testResult.error || (testResult.skipped === 'no-es-movil' ? 'Ese número no es un móvil.' : 'No ha salido.')}
                      </p>
                    )}
                    {testResult?.sending && <p className="mt-1.5 text-xs text-carbon/60">Enviando…</p>}
                  </div>
                  <button onClick={toggleFullscreen} className="ptab w-full justify-start">
                    <Maximize className="w-4 h-4" /> Pantalla completa
                  </button>
                  <button onClick={() => { load(); setMenuOpen(false) }} className="ptab w-full justify-start">
                    <RefreshCw className="w-4 h-4" /> Actualizar ahora
                  </button>
                  <button onClick={handleLogout} className="ptab w-full justify-start">
                    <LogOut className="w-4 h-4" /> Salir
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </header>

      <main className="shell py-4 md:py-8">
        {/* Sin un toque, el navegador no deja sonar la alarma de pedido nuevo */}
        {!soundReady && ['cocina', 'mostrador', 'hoy'].includes(view) && (
          <button
            onClick={() => { unlock(); play() }}
            className="mb-6 w-full flex items-center justify-center gap-2 rounded-md border-2 border-tomate bg-queso px-4 py-3 font-sans font-extrabold uppercase text-sm tracking-wide text-carbon animate-pulse"
          >
            <Bell className="w-5 h-5 text-tomate" /> Toca aquí para activar el sonido de los pedidos nuevos
          </button>
        )}
        {error && (
          <p className="palert mb-6">
            {error}
          </p>
        )}

        {view === 'descuentos' && esDireccion ? (
          <Discounts onError={setError} onChanged={refreshMenu} />
        ) : view === 'hoy' && esDireccion ? (
          <TodayBoard
            orders={orders}
            storeStatuses={storeStatuses}
            onOpenSede={(id) => { setSedeVista(id); changeView('cocina') }}
            onError={setError}
          />
        ) : view === 'facturacion' && esDireccion ? (
          <Billing locationId={sedeVista === 'todas' ? null : sedeVista} onError={setError} />
        ) : view === 'stock' ? (
          <Stock locationIds={locationIds} onError={setError} />
        ) : view === 'caja' ? (
          <CashClose locationIds={locationIds} onError={setError} />
        ) : view === 'carta' ? (
          <Carta locationIds={locationIds} esDireccion={esDireccion} onError={setError} onChanged={refreshMenu} />
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
        ) : (
          <KitchenBoard
            orders={porSede}
            busyId={busyId}
            onStatus={handleStatus}
            onUpdated={upsertOrder}
          />
        )}
      </main>

      {/* Deshacer: unos segundos para corregir un toque equivocado */}
      {undo && (
        <div className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] md:bottom-5 left-1/2 z-50 -translate-x-1/2 w-[min(28rem,calc(100vw-1.5rem))]" role="status">
          <div className="pframe !bg-forno shadow-ember">
            <div className="pframe-in !border-masa/40 flex items-center justify-between gap-3 px-4 py-3 text-masa">
              <p className="text-sm font-semibold">
                <span className="font-mono">{undo.ref}</span> → {undo.label}
                {undo.to === 'listo' && <span className="block mono normal-case text-masa/60">El cliente ya tiene el SMS de “listo”.</span>}
              </p>
              <button onClick={undoLast} className="ptab soft !bg-masa !border-masa !text-tomate">
                <Undo2 className="w-4 h-4" /> DESHACER
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Móvil: barra de secciones abajo, al alcance del pulgar ── */}
      {tabs.length > 1 && (
        <nav
          className="md:hidden fixed inset-x-0 bottom-0 z-40 bg-masa/95 backdrop-blur border-t border-tomate/60 pb-[env(safe-area-inset-bottom)]"
          aria-label="Secciones del panel"
        >
          <div className="grid" style={{ gridTemplateColumns: `repeat(${bottomTabs.length + (moreTabs.length ? 1 : 0)}, minmax(0, 1fr))` }}>
            {bottomTabs.map(({ id, label, Icon }) => {
              const on = view === id
              const badge = id === 'cocina' ? (unseenCount || pendientes) : 0
              return (
                <button
                  key={id}
                  onClick={() => { changeView(id); setMoreOpen(false) }}
                  aria-current={on ? 'page' : undefined}
                  className={['relative flex flex-col items-center justify-center gap-1 h-16 min-w-0 px-1', on ? 'text-[rgb(72_190_255)]' : 'text-carbon/60'].join(' ')}
                >
                  {on && <span className="absolute top-0 inset-x-3 h-0.5 rounded-full bg-[rgb(72_190_255)] shadow-[0_0_8px_rgb(72_190_255)]" aria-hidden="true" />}
                  <Icon className="w-6 h-6" strokeWidth={on ? 2.4 : 2} />
                  <span className="text-[0.66rem] font-bold uppercase tracking-wide truncate max-w-full">{label}</span>
                  {badge > 0 && (
                    <span className={['absolute top-1.5 left-1/2 ml-2 min-w-[1.25rem] h-5 rounded-full px-1 text-[0.7rem] font-extrabold leading-5 text-masa', unseenCount ? 'bg-tomate animate-pulse' : 'bg-albahaca'].join(' ')}>
                      {badge}
                    </span>
                  )}
                </button>
              )
            })}
            {moreTabs.length > 0 && (
              <button
                onClick={() => setMoreOpen((o) => !o)}
                aria-expanded={moreOpen}
                className={['relative flex flex-col items-center justify-center gap-1 h-16 min-w-0', moreOpen || moreTabs.some((t) => t.id === view) ? 'text-[rgb(72_190_255)]' : 'text-carbon/60'].join(' ')}
              >
                <MoreHorizontal className="w-6 h-6" />
                <span className="text-[0.66rem] font-bold uppercase tracking-wide">Más</span>
              </button>
            )}
          </div>
        </nav>
      )}

      {/* Hoja «Más»: el resto de secciones en cuadros grandes */}
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-30" role="dialog" aria-label="Más secciones">
          <button className="absolute inset-0 bg-black/60" aria-label="Cerrar" onClick={() => setMoreOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-crema border-t-2 border-tomate px-4 pt-3 pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between mb-3">
              <p className="mono text-tomate">MÁS SECCIONES</p>
              <button onClick={() => setMoreOpen(false)} className="w-10 h-10 flex items-center justify-center text-carbon/60" aria-label="Cerrar"><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              {moreTabs.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  onClick={() => { changeView(id); setMoreOpen(false) }}
                  aria-pressed={view === id}
                  className="ptab !min-h-[5.5rem] flex-col !gap-2 !text-[0.72rem]"
                >
                  <Icon className="w-7 h-7" /> {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
