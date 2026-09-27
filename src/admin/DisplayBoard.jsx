import { useCallback, useEffect, useRef, useState } from 'react'
import { Maximize, WifiOff } from 'lucide-react'
import { getLocation, LOCATIONS } from '../data/locations'
import { hourOf } from '../lib/kitchenSlots'
import { fetchDisplay } from './api'
import { useOrderAlert } from './useOrderAlert'
import { isConnectionError } from './offlineQueue'

/* ═══════════════════════════════════════════════════════════════
   PANTALLA DEL LOCAL (TV)
   Para que el cliente que espera sepa cómo va su pedido:
   "En preparación" y "¡Listo! Recoge tu pedido". Solo pedidos para
   recoger, con número y nombre abreviado.

   PLAN B: si se corta la conexión, la pantalla se queda con lo último
   que sabía (con un aviso discreto) y sigue reintentando sola.
   ═══════════════════════════════════════════════════════════════ */

const POLL_MS = 4000
const FLASH_MS = 15000
const MAX_PREP = 12
const MAX_READY = 8

/** "NN-4821" → { prefix: "NN", number: "4821" } */
const splitRef = (ref) => {
  const i = String(ref).lastIndexOf('-')
  return i > 0 ? { prefix: ref.slice(0, i), number: ref.slice(i + 1) } : { prefix: '', number: ref }
}

export default function DisplayBoard({ scope, sedeEnRuta, onSignedOut }) {
  const locationId = scope !== 'all' ? scope : (getLocation(sedeEnRuta) ? sedeEnRuta : LOCATIONS[0].id)
  const [orders, setOrders] = useState([])
  const [offline, setOffline] = useState(false)
  const [flash, setFlash] = useState(() => new Set())
  const [now, setNow] = useState(Date.now())
  const [started, setStarted] = useState(false)

  const { play, unlock } = useOrderAlert()
  const lastStatus = useRef(null)

  const load = useCallback(async () => {
    try {
      const data = await fetchDisplay(locationId)
      setOffline(false)

      /* Los que acaban de pasar a "listo" parpadean y suenan. */
      const prev = lastStatus.current
      const justReady = prev
        ? data.orders.filter((o) => o.status === 'listo' && prev.get(o.id) !== 'listo').map((o) => o.id)
        : []
      lastStatus.current = new Map(data.orders.map((o) => [o.id, o.status]))
      if (justReady.length) {
        play()
        setFlash((f) => new Set([...f, ...justReady]))
        setTimeout(() => setFlash((f) => new Set([...f].filter((id) => !justReady.includes(id)))), FLASH_MS)
      }
      setOrders(data.orders)
    } catch (err) {
      if (err.status === 401) { onSignedOut(); return }
      if (isConnectionError(err)) setOffline(true)
    }
  }, [locationId, play, onSignedOut])

  useEffect(() => {
    load()
    const timer = setInterval(load, POLL_MS)
    return () => clearInterval(timer)
  }, [load])

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000)
    return () => clearInterval(timer)
  }, [])

  /* Que la TV no apague la pantalla (si el navegador lo permite). */
  useEffect(() => {
    let lock = null
    const request = async () => {
      try { lock = await navigator.wakeLock?.request('screen') } catch { /* no soportado */ }
    }
    const onVisible = () => { if (document.visibilityState === 'visible') request() }
    request()
    document.addEventListener('visibilitychange', onVisible)
    return () => { document.removeEventListener('visibilitychange', onVisible); lock?.release?.() }
  }, [])

  const start = async () => {
    unlock()
    setStarted(true)
    try { await document.documentElement.requestFullscreen?.() } catch { /* sin pantalla completa */ }
  }

  const preparing = orders.filter((o) => o.status === 'preparando')
  const ready = orders.filter((o) => o.status === 'listo')
  const location = getLocation(locationId)

  return (
    <div className="h-screen overflow-hidden bg-forno text-crema flex flex-col cursor-none select-none">
      <header className="flex items-center justify-between px-[3vw] py-[2vh] border-b border-crema/10">
        <div>
          <p className="font-sans font-extrabold uppercase tracking-tight text-[2.2vw] leading-none">
            LA PIZZA DE <em className="font-serif italic font-semibold text-horno">NONNO</em>
          </p>
          <p className="mono text-crema/50 text-[1vw] mt-1">{location?.name.toUpperCase()}</p>
        </div>
        <p className="font-mono font-bold text-[3vw] leading-none text-crema/90">{hourOf(now)}</p>
      </header>

      <main className="flex-1 min-h-0 grid grid-cols-[1.15fr_1fr]">
        {/* En preparación */}
        <section className="min-h-0 px-[3vw] py-[3vh] flex flex-col">
          <h2 className="flex items-center gap-[1vw] font-sans font-extrabold uppercase text-[2.4vw] text-horno">
            <span className="inline-block w-[1vw] h-[1vw] rounded-full bg-horno animate-pulse-dot" />
            En preparación
          </h2>
          {preparing.length === 0 ? (
            <p className="mt-[4vh] font-serif italic text-[2vw] text-crema/40">Ahora mismo no hay pedidos en el horno.</p>
          ) : (
            <ul className="mt-[3vh] grid grid-cols-3 gap-[1.2vw] content-start">
              {preparing.slice(0, MAX_PREP).map((o) => {
                const { prefix, number } = splitRef(o.ref)
                return (
                  <li key={o.id} className="rounded-[1.5vw] bg-crema/5 border border-crema/10 px-[1.2vw] py-[1.5vh]">
                    <p className={['font-mono font-bold leading-none', number.length > 4 ? 'text-[2.4vw]' : 'text-[3.4vw]'].join(' ')}>
                      <span className="text-[1.1vw] text-crema/40 align-top mr-[0.3vw]">{prefix}</span>{number}
                    </p>
                    <p className="mt-[0.8vh] text-[1.2vw] text-crema/70 truncate">{o.name}</p>
                    {o.readyAt && <p className="mono normal-case text-[1vw] text-horno/90">hacia las {hourOf(o.readyAt)}</p>}
                  </li>
                )
              })}
            </ul>
          )}
          {preparing.length > MAX_PREP && (
            <p className="mt-[2vh] mono normal-case text-[1.2vw] text-crema/50">y {preparing.length - MAX_PREP} más en el horno…</p>
          )}
        </section>

        {/* Listos */}
        <section className="min-h-0 bg-albahaca px-[3vw] py-[3vh] flex flex-col">
          <h2 className="font-sans font-extrabold uppercase text-[2.4vw] leading-none">
            ¡Listo! <span className="text-crema/80">Recoge tu pedido</span>
          </h2>
          {ready.length === 0 ? (
            <p className="mt-[4vh] font-serif italic text-[2vw] text-crema/60">Enseguida saldrán los primeros.</p>
          ) : (
            <ul className="mt-[3vh] grid grid-cols-2 gap-[1.2vw] content-start">
              {ready.slice(0, MAX_READY).map((o) => {
                const { prefix, number } = splitRef(o.ref)
                const isNew = flash.has(o.id)
                return (
                  <li
                    key={o.id}
                    className={[
                      'rounded-[1.5vw] bg-crema text-carbon px-[1.4vw] py-[1.8vh] transition-all',
                      isNew ? 'ring-[0.4vw] ring-horno animate-pulse' : '',
                    ].join(' ')}
                  >
                    <p className={['font-mono font-bold leading-none', number.length > 4 ? 'text-[3.2vw]' : 'text-[4.4vw]'].join(' ')}>
                      <span className="text-[1.3vw] text-carbon/40 align-top mr-[0.3vw]">{prefix}</span>{number}
                    </p>
                    <p className="mt-[0.8vh] text-[1.5vw] font-semibold truncate">{o.name}</p>
                  </li>
                )
              })}
            </ul>
          )}
          {ready.length > MAX_READY && (
            <p className="mt-[2vh] mono normal-case text-[1.2vw] text-crema/80">y {ready.length - MAX_READY} más listos en el mostrador</p>
          )}
        </section>
      </main>

      <footer className="flex items-center justify-between px-[3vw] py-[1.5vh] border-t border-crema/10 text-[1vw] text-crema/50">
        <p>Tu número de pedido está en tu ticket y en el SMS de confirmación.</p>
        {offline && (
          <p className="flex items-center gap-[0.5vw] text-horno">
            <WifiOff className="w-[1.1vw] h-[1.1vw]" /> Sin conexión: mostrando la última información
          </p>
        )}
      </footer>

      {/* Un toque la primera vez: activa el sonido y la pantalla completa. */}
      {!started && (
        <button
          onClick={start}
          className="cursor-pointer fixed bottom-[8vh] right-[3vw] flex items-center gap-2 rounded-full bg-crema text-carbon px-5 py-3 text-sm font-semibold shadow-float"
        >
          <Maximize className="w-4 h-4" /> Pantalla completa y sonido
        </button>
      )}
    </div>
  )
}
