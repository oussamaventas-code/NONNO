import { useCallback, useEffect, useRef, useState } from 'react'
import { Bell, BellOff, RefreshCw, LogOut, ChefHat, Store, Printer, ClipboardList, Euro, BookOpen, Settings, Maximize, Wallet, LayoutDashboard, Moon, Sun } from 'lucide-react'
import Counter from './Counter'
import Routes from './Routes'
import Stock from './Stock'
import Carta from './Carta'
import CashClose from './CashClose'
import TodayBoard from './TodayBoard'
import DoughControl from './DoughControl'
import { useMenuOverrides } from '../hooks/useMenuOverrides'
import Billing from './Billing'
import Accounting from './Accounting'
import Discounts from './Discounts'
import { readQueue, enqueue, dequeue, isConnectionError } from './offlineQueue'
import { printTicket, printReceipt, setPrintAgents, viaAgent } from './printTicket'
import { PrinterBanner, PrinterSettings } from './PrinterStatus'
import { fetchOrders, updateOrder, createOrder, logout, getPushConfig, savePushSubscription, fetchStoreStatus, setStoreStatus } from './api'
import { useOrderAlert } from './useOrderAlert'
import KitchenReprint from './KitchenReprint'
import { LOCATIONS } from '../data/locations'

/* ═══════════════════════════════════════════════════════════════
   QUÉ VE CADA UNO
   · Sede (mostrador del local): el MOSTRADOR lo es todo (pedidos,
     cobros, reparto y caja en una pantalla). Aparte, el cierre de caja
     y lo del encargado (agotados, stock, repartidores).
   · Super admin (las dos sedes): su resumen, los mostradores, ventas, carta y
     precios, la facturación para el gestor y lo del encargado. No ve
     tableros de trabajo mezclados. Cada sede tiene su propio admin.
   · Equipo de cocina (?equipo=cocina): solo reimprimir comandas. Los
     pizzeros trabajan con el papel, no con el panel.
   ═══════════════════════════════════════════════════════════════ */
const SEDE_TABS = [
  { id: 'mostrador', label: 'Mostrador', short: 'Mostrador', Icon: Store },
  { id: 'caja', label: 'Cierre de caja', short: 'Caja', Icon: Wallet },
  { id: 'encargado', label: 'Encargado', short: 'Encargado', Icon: ClipboardList },
]
const JEFE_TABS = [
  { id: 'hoy', label: 'Resumen', short: 'Resumen', Icon: LayoutDashboard },
  { id: 'mostrador', label: 'Mostradores', short: 'Mostrador', Icon: Store },
  { id: 'ventas', label: 'Ventas', short: 'Ventas', Icon: Euro },
  { id: 'carta', label: 'Carta y precios', short: 'Carta', Icon: BookOpen },
  { id: 'encargado', label: 'Encargado', short: 'Encargado', Icon: ClipboardList },
]
const COCINA_TABS = [{ id: 'cocina', label: 'Cocina', short: 'Cocina', Icon: ChefHat }]

/* Secciones dentro de una pestaña (botones debajo del título) */
const SUBTABS = {
  ventas: [{ id: 'facturacion', label: 'Facturación' }, { id: 'gestor', label: 'Para el gestor' }, { id: 'cajas', label: 'Cierres de caja' }],
  carta: [{ id: 'carta', label: 'Carta y agotados' }, { id: 'descuentos', label: 'Descuentos' }],
  encargado: [{ id: 'agotados', label: 'Carta y agotados', sede: true }, { id: 'stock', label: 'Stock y compra' }, { id: 'repartidores', label: 'Repartidores' }],
}

/* Pestañas en las que el jefe tiene que mirar UNA sede (no se mezclan) */
const ONE_SEDE = ['mostrador', 'encargado']

const DEVICE_MODES = [
  { id: 'mostrador', label: 'Mostrador', hint: 'El TPV del local: pedidos, cobros, reparto y caja.' },
  { id: 'cocina', label: 'Cocina', hint: 'Solo para reimprimir comandas.' },
]

/* Cada cuánto vuelve a sonar un pedido de la web que nadie ha marcado como visto */
const REPEAT_ALARM_MS = 10000

/* 4 s: lo bastante rápido para que cocina y mostrador no se
   desincronicen sin machacar la API. Se refuerza con una recarga
   inmediata al volver a la pestaña (ver más abajo). */
const POLL_MS = 4000

const PREF_VIEW = 'nonno.panel.view'
const PREF_DEVICE = 'nonno.panel.device'
const PREF_AUTOPRINT = 'nonno.panel.autoprint'
const PREF_AUTORECEIPT = 'nonno.panel.autoreceipt'
/* Modo noche (el negro neón de la web, por defecto) o día (claro). Lo lee
   también index.html antes de pintar, para que no parpadee. */
const PREF_TEMA = 'nonno.panel.tema'
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

/* El icono que crea el instalador de la tienda abre el panel con
   ?equipo=cocina o ?equipo=tpv: ese Chrome queda montado para siempre
   (cada icono tiene su perfil y su impresora) sin tocar ningún ajuste.
     cocina → solo reimprimir comandas
     tpv    → el mostrador */
;(() => {
  try {
    const url = new URL(window.location.href)
    const equipo = url.searchParams.get('equipo')
    if (equipo === 'cocina') {
      writePref(PREF_DEVICE, 'cocina')
      writePref(PREF_AUTOPRINT, true); writePref(PREF_AUTORECEIPT, false)
    } else if (equipo === 'tpv') {
      writePref(PREF_DEVICE, 'mostrador')
      writePref(PREF_AUTOPRINT, false); writePref(PREF_AUTORECEIPT, true)
    } else return
    url.searchParams.delete('equipo')
    window.history.replaceState({}, '', url.pathname + url.search + url.hash)
  } catch { /* sin URL o sin almacenamiento: se queda como estaba */ }
})()

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
  const [loading, setLoading] = useState(true)
  const [pushState, setPushState] = useState('desconocido')
  const [storeStatuses, setStoreStatuses] = useState({})
  /* Nonno Impresora de cada sede (programa del local que imprime sin Chrome) */
  const [printers, setPrinters] = useState({})
  const [togglingStore, setTogglingStore] = useState(null)
  /* Cada equipo recuerda su papel: el ordenador de cocina y el del
     mostrador imprimen cosas distintas en su propia impresora. La
     preferencia es del navegador, no de la sesión: si en ese mismo
     equipo entra luego una sede sin permiso de ver facturación, no
     se queda ahí abierta. */
  const [viewPref, setView] = useState(() => readPref(PREF_VIEW, esDireccion ? 'hoy' : 'mostrador'))
  /* 'completo' era el modo antiguo "todo": hoy es el mostrador */
  const [deviceMode, setDeviceMode] = useState(() => (readPref(PREF_DEVICE, 'mostrador') === 'cocina' ? 'cocina' : 'mostrador'))
  const [subView, setSubView] = useState({})
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmClose, setConfirmClose] = useState(null)
  const [autoPrint, setAutoPrint] = useState(() => readPref(PREF_AUTOPRINT, false))
  const [autoReceipt, setAutoReceipt] = useState(() => readPref(PREF_AUTORECEIPT, false))
  const [tema, setTema] = useState(() => readPref(PREF_TEMA, 'negro'))

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
  const autoReceiptOn = useRef(false)

  /* ── Carga y sondeo ──────────────────────────────────────────── */
  const load = useCallback(async () => {
    try {
      const { orders: list, printers: agents } = await fetchOrders()
      /* Las sedes con Nonno Impresora no imprimen desde aquí: lo hace el programa del local */
      setPrintAgents(agents)
      setPrinters(agents || {})
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
        !o.printed_at && !['entregado', 'cancelado'].includes(o.status) && !viaAgent(o)
        && !printedKeys.current.has(printKey(o)))
      pendingPrint.forEach((o) => printedKeys.current.add(printKey(o)))
      if (!firstLoad.current && autoPrintOn.current) {
        pendingPrint.forEach((o) => {
          printTicket(o)
          updateOrder(o.id, { printed: true }).catch(() => {})
        })
      }
      /* Ticket del cliente automático (equipo del mostrador): sale una vez
         por cada pedido nuevo de la web o del teléfono. Los del mostrador
         ya lo sacan al cobrar. */
      if (!firstLoad.current && autoReceiptOn.current) {
        fresh.filter((o) => o.status === 'nuevo' && o.channel !== 'mostrador' && !viaAgent(o)).forEach((o) => printReceipt(o))
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

  const storeSaved = useCallback((locationId, status) => {
    setStoreStatuses((prev) => ({ ...prev, [locationId]: status }))
  }, [])

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
  const toggleAutoPrint = () => {
    setAutoPrint((on) => { writePref(PREF_AUTOPRINT, !on); return !on })
  }
  const toggleTema = () => {
    const next = tema === 'negro' ? 'claro' : 'negro'
    setTema(next)
    writePref(PREF_TEMA, next)
    document.documentElement.classList.toggle('tema-negro', next === 'negro')
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', next === 'negro' ? '#0C0C0C' : '#FFFAE9')
  }
  const toggleAutoReceipt = () => {
    setAutoReceipt((on) => { writePref(PREF_AUTORECEIPT, !on); return !on })
  }

  const handleLogout = async () => {
    await logout().catch(() => {})
    onSignedOut()
  }

  /* ── Datos derivados ─────────────────────────────────────────── */
  const sede = SEDES[scope]

  /* Pestañas de este equipo, y la vista efectiva (si la guardada ya no
     le toca, se cae a la primera que sí). */
  const tabs = esDireccion ? JEFE_TABS : deviceMode === 'cocina' ? COCINA_TABS : SEDE_TABS
  const view = tabs.some((t) => t.id === viewPref) ? viewPref : tabs[0].id
  const viewTab = tabs.find((t) => t.id === view)
  autoPrintOn.current = autoPrint
  autoReceiptOn.current = autoReceipt

  /* Sección dentro de la pestaña (ventas, carta, encargado) */
  const subs = (SUBTABS[view] || []).filter((x) => !x.sede || !esDireccion)
  const sub = subs.some((x) => x.id === subView[view]) ? subView[view] : subs[0]?.id
  const changeSub = (id) => setSubView((prev) => ({ ...prev, [view]: id }))

  /* La dirección elige sede; en el mostrador y el encargado, siempre
     una (no se mezclan los pedidos de los dos locales). */
  const oneSede = esDireccion && ONE_SEDE.includes(view)
  const sedeActiva = !esDireccion ? scope : oneSede && sedeVista === 'todas' ? LOCATIONS[0].id : sedeVista
  const porSede = sedeActiva === 'todas' ? orders : orders.filter((o) => o.location_id === sedeActiva)
  const locationIds = sedeActiva === 'todas' ? LOCATIONS.map((l) => l.id) : [sedeActiva]
  const sedeOptions = [...(oneSede ? [] : [{ id: 'todas', label: 'Las dos' }]), ...LOCATIONS.map((l) => ({ id: l.id, label: l.name.replace(' la Verde', '') }))]
  const showSedePicker = esDireccion && view !== 'hoy' && !(view === 'carta' && sub === 'descuentos')

  /* Estado de la tienda de cada sede que este panel gestiona */
  const storeList = (esDireccion ? LOCATIONS.map((l) => l.id) : [scope]).map((id) => ({
    id,
    name: LOCATIONS.find((l) => l.id === id)?.name || id,
    short: (LOCATIONS.find((l) => l.id === id)?.name || id).replace(' la Verde', ''),
    abierta: storeStatuses[id]?.is_open === true,
  }))
  /* Abrir es un toque; cerrar pide confirmación (la web deja de aceptar pedidos) */
  const pressStore = (s) => (s.abierta ? setConfirmClose(s.id) : toggleStore(s.id, true))

  /* Pedidos de la web que nadie ha mirado: suenan hasta que el
     mostrador pulse VISTO. Los del mostrador o del teléfono ya los
     ha visto quien los apunta. Un programado para dentro de mucho no
     suena hasta que se acerca su hora. */
  const farOff = (o) => o.scheduled_for && o.ready_at && Date.parse(o.ready_at) - Date.now() > 45 * 60000
  const unseen = porSede.filter((o) => o.channel === 'web' && o.status === 'nuevo' && !o.seen_at && !farOff(o) && Date.now() - Date.parse(o.created_at) < 3600000)
  const unseenCount = unseen.length

  /* La alarma se repite en el mostrador del local (no en cocina ni en el móvil del jefe) */
  useEffect(() => {
    if (!unseenCount || esDireccion || deviceMode === 'cocina') return undefined
    const timer = setInterval(play, REPEAT_ALARM_MS)
    return () => clearInterval(timer)
  }, [unseenCount, esDireccion, deviceMode, play])

  useEffect(() => {
    document.title = unseenCount ? `(${unseenCount}) Nuevo pedido · Nonno` : 'Panel · Nonno'
  }, [unseenCount])

  const sedeNombre = sede ? sede.nombre : sedeActiva === 'todas' ? 'Las dos sedes' : LOCATIONS.find((l) => l.id === sedeActiva)?.name
  const doughLeft = locationIds.length === 1 ? storeStatuses[locationIds[0]]?.dough_left ?? null : null

  return (
    <div className="min-h-screen bg-masa overflow-x-clip pb-[calc(4.75rem+env(safe-area-inset-bottom))] md:pb-0">
      {/* Raya del color de la sede: nadie duda de qué local está mirando */}
      <div className={`h-2 ${sede?.banda || 'bg-carbon'}`} aria-hidden="true" />

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
      <PrinterBanner printers={printers} locationIds={locationIds} orders={orders} onError={setError} />
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

      <header className="sticky top-0 z-30 bg-crema border-b-2 border-carbon">
        <div className="shell flex items-center gap-2.5 md:gap-3 py-2.5 md:py-3">
          <img src="/logo-nonno.png" alt="" width="48" height="48" className="h-10 w-10 md:h-12 md:w-12 flex-shrink-0 rounded-full object-cover border-2 border-tomate" />
          <div className="min-w-0 md:min-w-[9.5rem]">
            <p className="font-sans font-extrabold uppercase text-base md:text-xl leading-none text-carbon truncate">
              {esDireccion ? 'Super admin' : viewTab?.label}
            </p>
            <p className="mt-1 font-mono text-[0.78rem] text-carbon/65 truncate">{sedeNombre}</p>
          </div>

          {/* Pestañas (en el móvil van abajo) */}
          {tabs.length > 1 && (
            <nav className="hidden md:flex flex-wrap gap-1.5 ml-2" aria-label="Secciones del panel">
              {tabs.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  onClick={() => changeView(id)}
                  aria-current={view === id ? 'page' : undefined}
                  className={[
                    'inline-flex items-center gap-2 rounded-lg border-2 px-3.5 min-h-[44px] font-sans font-bold text-[0.95rem] transition-colors',
                    view === id ? 'border-carbon bg-carbon text-masa' : 'border-transparent text-carbon hover:border-carbon/40',
                  ].join(' ')}
                >
                  <Icon className="w-[18px] h-[18px]" /> {label}
                </button>
              ))}
            </nav>
          )}

          <div className="ml-auto flex items-center gap-2">
            {/* Tienda abierta / cerrada: un interruptor de verdad (no en el equipo de cocina) */}
            {(view !== 'cocina' ? storeList : []).map((s) => (
              <button
                key={s.id}
                onClick={() => pressStore(s)}
                disabled={togglingStore === s.id}
                aria-pressed={s.abierta}
                aria-label={`${s.name}: ${s.abierta ? 'abierta, tocar para cerrar' : 'cerrada, tocar para abrir'}`}
                className={[
                  'flex items-center gap-1.5 rounded-full border-2 h-10 sm:h-11 pl-1 pr-2.5 sm:pr-3 font-sans font-extrabold uppercase text-[0.8rem] tracking-wide transition-colors disabled:opacity-50',
                  s.abierta ? 'border-albahaca bg-albahaca text-papel' : 'border-tomate bg-crema text-tomate',
                  storeList.length > 1 ? 'hidden lg:flex' : 'flex',
                ].join(' ')}
              >
                <span className={['w-7 h-7 sm:w-8 sm:h-8 rounded-full', s.abierta ? 'bg-papel' : 'bg-tomate/20'].join(' ')} aria-hidden="true" />
                {storeList.length > 1 ? `${s.short} · ` : ''}{s.abierta ? 'Abierta' : 'Cerrada'}
              </button>
            ))}
            {storeList.length > 1 && (
              <button
                onClick={() => setMenuOpen(true)}
                className={[
                  'lg:hidden flex items-center gap-1.5 rounded-full border-2 px-3 h-11 text-xs font-extrabold uppercase tracking-wide',
                  storeList.every((x) => x.abierta) ? 'border-albahaca text-albahaca' : 'border-tomate text-tomate',
                ].join(' ')}
                aria-label="Abrir o cerrar las tiendas"
              >
                {storeList.filter((x) => x.abierta).length}/{storeList.length} abiertas
              </button>
            )}
            <button
              onClick={toggleTema}
              aria-label={tema === 'negro' ? 'Pasar a modo día' : 'Pasar a modo noche'}
              title={tema === 'negro' ? 'Modo día' : 'Modo noche'}
              className="hidden sm:flex w-11 h-11 flex-shrink-0 rounded-lg border-2 border-carbon/60 items-center justify-center text-carbon hover:border-carbon"
            >
              {tema === 'negro' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button
              onClick={() => setMenuOpen((o) => !o)}
              aria-expanded={menuOpen}
              aria-label="Ajustes de este equipo"
              className="w-11 h-11 flex-shrink-0 rounded-lg border-2 border-carbon/60 flex items-center justify-center text-carbon hover:border-carbon"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Dirección: qué sede mirar (una sola vez, vale para toda la pestaña) */}
        {showSedePicker && (
          <div className="shell pb-3 flex items-center gap-3">
            <span className="hidden sm:inline font-mono text-[0.78rem] text-carbon/65">SEDE</span>
            <div className="grid grid-flow-col auto-cols-fr gap-1.5 w-full sm:w-auto" role="group" aria-label="Sede">
              {sedeOptions.map((x) => (
                <button
                  key={x.id}
                  onClick={() => setSedeVista(x.id)}
                  aria-pressed={sedeActiva === x.id}
                  className={[
                    'min-h-[40px] rounded-lg border-2 px-3 font-sans font-bold text-sm transition-colors',
                    sedeActiva === x.id ? 'border-carbon bg-carbon text-masa' : 'border-carbon/30 text-carbon hover:border-carbon',
                  ].join(' ')}
                >
                  {x.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Menú ⚙: ajustes de ESTE equipo (lo que se toca poco) */}
        {menuOpen && (
          <>
            <button className="fixed inset-0 z-40 cursor-default" aria-label="Cerrar menú" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-3 sm:right-8 top-full z-50 mt-2 w-[min(22rem,calc(100vw-1.5rem))] pframe shadow-ember">
              <div className="pframe-in p-4 flex flex-col gap-4 max-h-[80vh] overflow-y-auto">
                <div>
                  <p className="mono text-tomate mb-2">TIENDA</p>
                  <div className="flex flex-col gap-2">
                    {storeList.map((s) => (
                      <div key={s.id}>
                        <button
                          onClick={() => pressStore(s)}
                          disabled={togglingStore === s.id}
                          className={['ptab w-full justify-start disabled:opacity-50', s.abierta ? '!bg-albahaca !border-albahaca !text-masa' : ''].join(' ')}
                        >
                          {s.name} · {s.abierta ? 'ABIERTA (tocar para cerrar)' : 'CERRADA (tocar para abrir)'}
                        </button>
                        <div className="mt-1.5">
                          <DoughControl locationId={s.id} status={storeStatuses[s.id]} editable={esDireccion} onSaved={storeSaved} onError={setError} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {!esDireccion && (
                  <div>
                    <p className="mono text-tomate mb-2">ESTE EQUIPO ES…</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {DEVICE_MODES.map((m) => (
                        <button key={m.id} onClick={() => changeDevice(m.id)} aria-pressed={deviceMode === m.id} className="ptab soft">
                          {m.label}
                        </button>
                      ))}
                    </div>
                    <p className="mono normal-case text-carbon/60 mt-1.5">{DEVICE_MODES.find((m) => m.id === deviceMode)?.hint}</p>
                  </div>
                )}

                <PrinterSettings printers={printers} locationIds={locationIds} onError={setError} />

                <div className="flex flex-col gap-2">
                  <p className="mono text-tomate">AJUSTES</p>
                  <button onClick={toggleTema} aria-pressed={tema === 'negro'} className="ptab w-full justify-start">
                    {tema === 'negro' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />} {tema === 'negro' ? 'Modo noche (tocar para día)' : 'Modo día (tocar para noche)'}
                  </button>
                  <button
                    onClick={toggleAutoPrint}
                    aria-pressed={autoPrint}
                    title="Solo si el local NO tiene Nonno Impresora: imprime la comanda de cada pedido desde este navegador"
                    className={['ptab w-full justify-start', autoPrint ? '!bg-albahaca !border-albahaca !text-masa' : ''].join(' ')}
                  >
                    <Printer className="w-4 h-4" /> {autoPrint ? 'Comandas desde este equipo: SÍ' : 'Comandas desde este equipo: NO'}
                  </button>
                  <button
                    onClick={toggleAutoReceipt}
                    aria-pressed={autoReceipt}
                    title="Solo si el local NO tiene Nonno Impresora: imprime el ticket de cada pedido de la web o del teléfono desde este navegador"
                    className={['ptab w-full justify-start', autoReceipt ? '!bg-albahaca !border-albahaca !text-masa' : ''].join(' ')}
                  >
                    <Printer className="w-4 h-4" /> {autoReceipt ? 'Tickets desde este equipo: SÍ' : 'Tickets desde este equipo: NO'}
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

      <main className="shell py-4 md:py-6">
        {/* Sin un toque, el navegador no deja sonar el aviso de pedido nuevo */}
        {!soundReady && view === 'mostrador' && (
          <button
            onClick={() => { unlock(); play() }}
            className="mb-5 w-full flex items-center justify-center gap-2 rounded-lg border-2 border-carbon bg-queso px-4 py-3 font-sans font-extrabold uppercase text-sm tracking-wide text-[rgb(29_43_79)] animate-pulse"
          >
            <Bell className="w-5 h-5" /> Toca aquí para activar el sonido de los pedidos nuevos
          </button>
        )}
        {/* Flotando arriba: se ve aunque estés bajado en una columna (si no,
            parece que el botón no ha hecho nada) */}
        {error && (
          <p className="palert !bg-papel !border-2 fixed inset-x-3 top-3 z-[70] mx-auto max-w-xl flex items-start justify-between gap-3 shadow-float" role="alert">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="underline flex-shrink-0">Cerrar</button>
          </p>
        )}

        {/* Secciones dentro de la pestaña */}
        {subs.length > 1 && (
          <div className="mb-5 flex flex-wrap gap-2" role="tablist" aria-label={viewTab?.label}>
            {subs.map((x) => (
              <button
                key={x.id}
                role="tab"
                aria-selected={sub === x.id}
                onClick={() => changeSub(x.id)}
                className={[
                  'min-h-[44px] rounded-lg border-2 px-4 font-sans font-bold transition-colors',
                  sub === x.id ? 'border-tomate bg-tomate text-papel' : 'border-carbon/30 text-carbon hover:border-carbon',
                ].join(' ')}
              >
                {x.label}
              </button>
            ))}
          </div>
        )}

        {view === 'hoy' ? (
          <TodayBoard
            orders={orders}
            storeStatuses={storeStatuses}
            onDoughSaved={storeSaved}
            onOpenSede={(id) => { setSedeVista(id); changeView('mostrador') }}
            onError={setError}
          />
        ) : view === 'ventas' ? (
          sub === 'cajas'
            ? <CashClose locationIds={locationIds} onError={setError} />
            : sub === 'gestor'
              ? <Accounting locationId={sedeActiva === 'todas' ? null : sedeActiva} onError={setError} />
              : <Billing locationId={sedeActiva === 'todas' ? null : sedeActiva} onError={setError} />
        ) : view === 'carta' ? (
          sub === 'descuentos'
            ? <Discounts onError={setError} onChanged={refreshMenu} />
            : <Carta locationIds={locationIds} esDireccion={esDireccion} onError={setError} onChanged={refreshMenu} />
        ) : view === 'encargado' ? (
          sub === 'agotados'
            ? <Carta locationIds={locationIds} esDireccion={esDireccion} onError={setError} onChanged={refreshMenu} />
            : sub === 'repartidores'
              ? <Routes part="repartidores" orders={porSede} locationIds={locationIds} onSaved={upsertOrder} onError={setError} />
              : <Stock locationIds={locationIds} onError={setError} />
        ) : view === 'caja' ? (
          <CashClose locationIds={locationIds} onError={setError} />
        ) : loading ? (
          <p className="mono text-carbon/50 py-16 text-center">CARGANDO PEDIDOS…</p>
        ) : view === 'cocina' ? (
          <KitchenReprint orders={porSede} />
        ) : (
          <Counter
            key={sedeActiva}
            orders={[
              ...queue.map((e) => e.order).filter((o) => locationIds.includes(o.location_id)),
              ...porSede,
            ]}
            locationIds={locationIds}
            defaultLocationId={locationIds[0]}
            doughLeft={doughLeft}
            onSaved={upsertOrder}
            onError={setError}
            onCloseCash={() => (esDireccion ? (setSubView((p) => ({ ...p, ventas: 'cajas' })), changeView('ventas')) : changeView('caja'))}
          />
        )}
      </main>

      {/* Cerrar la tienda: se pregunta antes (la web deja de aceptar pedidos) */}
      {confirmClose && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="cerrar-titulo">
          <button className="absolute inset-0 bg-black/50" aria-label="No cerrar" onClick={() => setConfirmClose(null)} />
          <div className="relative w-full max-w-sm rounded-xl border-2 border-carbon bg-crema p-5 shadow-[5px_5px_0_0_rgb(var(--c-carbon))]">
            <p id="cerrar-titulo" className="font-sans font-extrabold text-xl text-carbon">
              ¿Cerrar {storeList.find((s) => s.id === confirmClose)?.name}?
            </p>
            <p className="mt-2 text-carbon/80">La web dejará de aceptar pedidos hasta que se vuelva a abrir.</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button onClick={() => setConfirmClose(null)} className="psec !min-h-[52px] text-base">No</button>
              <button
                onClick={() => { toggleStore(confirmClose, false); setConfirmClose(null); setMenuOpen(false) }}
                className="pbig bg-tomate"
              >
                Sí, cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Móvil: secciones abajo, al alcance del pulgar ── */}
      {tabs.length > 1 && (
        <nav
          className="md:hidden fixed inset-x-0 bottom-0 z-40 bg-crema/95 backdrop-blur border-t-2 border-carbon pb-[env(safe-area-inset-bottom)]"
          aria-label="Secciones del panel"
        >
          <div className="grid" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
            {tabs.map(({ id, short, Icon }) => {
              const on = view === id
              const badge = id === 'mostrador' ? unseenCount : 0
              return (
                <button
                  key={id}
                  onClick={() => changeView(id)}
                  aria-current={on ? 'page' : undefined}
                  className={['relative flex flex-col items-center justify-center gap-1 h-16 min-w-0 px-1', on ? 'panel-activo' : 'text-carbon/65'].join(' ')}
                >
                  {on && <span className="absolute top-0 inset-x-3 h-[3px] rounded-full bg-[rgb(var(--activo))]" aria-hidden="true" />}
                  <Icon className="w-6 h-6" strokeWidth={on ? 2.4 : 2} />
                  <span className="text-[0.68rem] font-bold uppercase tracking-wide truncate max-w-full">{short}</span>
                  {badge > 0 && (
                    <span className="absolute top-1.5 left-1/2 ml-2 min-w-[1.25rem] h-5 rounded-full px-1 text-[0.7rem] font-extrabold leading-5 text-papel bg-tomate animate-pulse">
                      {badge}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </nav>
      )}
    </div>
  )
}
