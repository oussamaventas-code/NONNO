import { useEffect, useRef, useState } from 'react'
import { X, Star, Smartphone, LogOut, FileText, Gift } from 'lucide-react'
import { useAccount } from '../store/AccountContext'
import { useLockBodyScroll } from '../hooks/useLockBodyScroll'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { LOYALTY, discountFor } from '../data/loyalty'
import { price } from '../lib/format'
import { openReceipt } from '../lib/receipt'

const STATUS = { nuevo: 'Recibido', horno: 'En el horno', listo: 'Listo', entregado: 'Entregado', cancelado: 'Cancelado' }
const REASON = { pedido: 'Pedido', canje: 'Canje', devolucion: 'Devolución', anulacion: 'Anulación', ajuste: 'Ajuste' }
const day = (iso) => new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Madrid' })

/**
 * "Mi cuenta" del Club Nonno: entrar con el móvil (código por SMS) y,
 * dentro, los puntos, los pedidos con su tique y los movimientos.
 */
export default function AccountDrawer() {
  const account = useAccount()
  const { isOpen, closeAccount, status } = account
  const dialogRef = useRef(null)

  useLockBodyScroll(isOpen)
  useFocusTrap(dialogRef, isOpen, closeAccount)

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[105] flex items-end sm:items-stretch sm:justify-end">
      <button className="absolute inset-0 bg-forno/70 backdrop-blur-sm" onClick={closeAccount} aria-label="Cerrar" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-title"
        className="relative w-full sm:w-[27rem] max-h-[92dvh] sm:max-h-none sm:h-full overflow-y-auto bg-masa rounded-t-block sm:rounded-none border-t sm:border-t-0 sm:border-l border-tomate"
      >
        <div className="sticky top-0 z-10 bg-masa flex items-center justify-between px-6 pt-6 pb-4 border-b border-tomate">
          <h2 id="account-title" className="font-display italic font-bold text-2xl text-tomate">{LOYALTY.name}</h2>
          <button onClick={closeAccount} className="w-10 h-10 rounded-full flex items-center justify-center text-tomate hover:bg-tomate/10" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-6">
          {status === 'loading' && <p className="text-forno/60">Cargando…</p>}
          {status === 'off' && <ClubOff />}
          {status === 'guest' && <Login />}
          {status === 'member' && <Member />}
        </div>
      </div>
    </div>
  )
}

/* ── Cómo funciona ───────────────────────────────────────────── */
function Rules() {
  return (
    <ul className="flex flex-col gap-2 font-sans text-sm text-forno/80">
      <li className="flex gap-2"><Star className="w-4 h-4 mt-0.5 text-tomate fill-tomate flex-shrink-0" strokeWidth={0} />{LOYALTY.pointsPerEuro} punto por cada euro de tus pedidos, al entregártelos.</li>
      <li className="flex gap-2"><Gift className="w-4 h-4 mt-0.5 text-tomate flex-shrink-0" />{LOYALTY.redeemStep} puntos = {price(LOYALTY.stepValue)} de descuento en tu próximo pedido online.</li>
      <li className="flex gap-2"><Smartphone className="w-4 h-4 mt-0.5 text-tomate flex-shrink-0" />Sin contraseñas: entras con tu móvil y un código por SMS.</li>
    </ul>
  )
}

function ClubOff() {
  return (
    <div className="text-center">
      <p className="font-display font-bold text-2xl text-tomate">Muy pronto</p>
      <p className="mt-2 text-forno/70">El {LOYALTY.name} se está preparando. Así funcionará:</p>
      <div className="mt-6 text-left"><Rules /></div>
    </div>
  )
}

/* ── Entrar: móvil → código ──────────────────────────────────── */
function Login() {
  const { sendCode, verify } = useAccount()
  const [step, setStep] = useState('phone')
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [devCode, setDevCode] = useState(null)
  const [wait, setWait] = useState(0)
  const codeRef = useRef(null)

  useEffect(() => {
    if (wait <= 0) return undefined
    const t = setTimeout(() => setWait((w) => w - 1), 1000)
    return () => clearTimeout(t)
  }, [wait])

  const requestCode = async (e) => {
    e?.preventDefault()
    setBusy(true); setError('')
    const { ok, data } = await sendCode(phone)
    setBusy(false)
    if (!ok) {
      setError(data.error || 'No hemos podido mandar el código.')
      if (data.wait) setWait(data.wait)
      return
    }
    setDevCode(data.devCode || null)
    setStep('code'); setCode(''); setWait(60)
    setTimeout(() => codeRef.current?.focus(), 50)
  }

  const submitCode = async (e) => {
    e.preventDefault()
    setBusy(true); setError('')
    const { ok, data } = await verify(phone, code, name)
    setBusy(false)
    if (!ok) setError(data.error || 'No hemos podido comprobar el código.')
  }

  const input = 'w-full rounded-md border border-tomate bg-crema px-4 h-12 text-forno placeholder:text-forno/35 outline-none focus:ring-2 focus:ring-tomate/40'

  return (
    <div>
      <p className="font-display font-bold text-2xl text-forno leading-tight">Gana puntos con cada pizza</p>
      <div className="mt-4"><Rules /></div>

      {step === 'phone' ? (
        <form onSubmit={requestCode} className="mt-8 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="font-sans font-semibold uppercase text-xs tracking-wider text-tomate">Tu móvil</span>
            <input className={input} type="tel" inputMode="tel" autoComplete="tel" placeholder="600 000 000" value={phone} onChange={(e) => setPhone(e.target.value)} required />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-sans font-semibold uppercase text-xs tracking-wider text-tomate">Tu nombre <span className="normal-case font-normal text-forno/50">(si es tu primera vez)</span></span>
            <input className={input} autoComplete="given-name" placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          {error && <p className="text-sm text-tomate font-semibold" role="alert">{error}</p>}
          <button className="btn-retro self-start" disabled={busy || wait > 0}>
            <span>{busy ? 'Enviando…' : wait > 0 ? `Espera ${wait} s` : 'Enviarme el código'}</span>
          </button>
        </form>
      ) : (
        <form onSubmit={submitCode} className="mt-8 flex flex-col gap-4">
          <p className="text-forno/80">Te hemos mandado un SMS al <strong>{phone}</strong> con un código de {LOYALTY.codeLength} cifras.</p>
          {devCode && (
            <p className="rounded-md bg-queso border border-forno/30 px-3 py-2 text-sm text-forno">
              Modo pruebas (sin SMS configurado): tu código es <strong>{devCode}</strong>
            </p>
          )}
          <label className="flex flex-col gap-1.5">
            <span className="font-sans font-semibold uppercase text-xs tracking-wider text-tomate">Código</span>
            <input
              ref={codeRef}
              className={`${input} text-center text-2xl tracking-[0.5em] font-bold`}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={LOYALTY.codeLength}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              required
            />
          </label>
          {error && <p className="text-sm text-tomate font-semibold" role="alert">{error}</p>}
          <button className="btn-retro self-start" disabled={busy || code.length < LOYALTY.codeLength}>
            <span>{busy ? 'Comprobando…' : 'Entrar'}</span>
          </button>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <button type="button" onClick={() => requestCode()} disabled={wait > 0 || busy} className="text-tomate underline underline-offset-4 disabled:no-underline disabled:text-forno/40">
              {wait > 0 ? `Reenviar en ${wait} s` : 'Reenviar el código'}
            </button>
            <button type="button" onClick={() => { setStep('phone'); setError('') }} className="text-tomate underline underline-offset-4">Cambiar de móvil</button>
          </div>
        </form>
      )}
    </div>
  )
}

/* ── Dentro: puntos, pedidos y movimientos ───────────────────── */
function Member() {
  const { customer, orders, ledger, points, logout, updateName } = useAccount()
  const [tab, setTab] = useState('pedidos')
  const [name, setName] = useState('')
  const toNext = LOYALTY.redeemStep - (points % LOYALTY.redeemStep)
  const available = discountFor(points)
  const earnedByOrder = Object.fromEntries(ledger.filter((l) => l.reason === 'pedido').map((l) => [l.order_id, l.delta]))

  return (
    <div>
      {customer.name ? (
        <p className="font-display font-bold text-2xl text-forno">Hola, {customer.name}</p>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) updateName(name) }} className="flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="¿Cómo te llamas?" className="flex-1 rounded-md border border-tomate bg-crema px-3 h-11 outline-none" />
          <button className="rounded-md bg-tomate text-masa px-4 font-semibold">Guardar</button>
        </form>
      )}
      <p className="mt-1 text-sm text-forno/60">{customer.phone.replace(/^\+34(\d{3})(\d{2})(\d{2})(\d{2})$/, '$1 $2 $3 $4')}</p>

      {/* Tarjeta de puntos */}
      <div className="frame mt-6">
        <div className="frame-in bg-crema p-5 text-center">
          <p className="font-sans font-semibold uppercase text-xs tracking-wider text-tomate">Tus puntos</p>
          <p className="font-display font-bold text-6xl text-tomate leading-none mt-2">{points}</p>
          <p className="mt-3 text-forno font-semibold">
            {available > 0 ? `Tienes ${price(available)} de descuento para tu próximo pedido` : `Te faltan ${toNext} puntos para tus primeros ${price(LOYALTY.stepValue)}`}
          </p>
          <div className="mt-4 h-2.5 rounded-full bg-tomate/15 overflow-hidden" aria-hidden="true">
            <div className="h-full bg-tomate rounded-full" style={{ width: `${((points % LOYALTY.redeemStep) / LOYALTY.redeemStep) * 100}%` }} />
          </div>
          <p className="mt-2 text-xs text-forno/60">{toNext} puntos para los siguientes {price(LOYALTY.stepValue)}</p>
        </div>
      </div>

      <div className="mt-8 flex gap-6 border-b border-tomate/30" role="tablist">
        {[['pedidos', 'Mis pedidos'], ['puntos', 'Movimientos']].map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={['pb-2 font-sans font-semibold uppercase text-sm tracking-wider border-b-2 -mb-px', tab === id ? 'text-tomate border-tomate' : 'text-forno/50 border-transparent'].join(' ')}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'pedidos' && (
        <ul className="mt-4 flex flex-col gap-3">
          {orders.length === 0 && <li className="text-forno/60 text-sm">Todavía no tienes pedidos con esta cuenta. Pide con tu sesión abierta y aparecerán aquí.</li>}
          {orders.map((o) => (
            <li key={o.id} className="rounded-md border border-tomate/40 bg-crema p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-forno">{o.ref} · {price(o.total)}</p>
                  <p className="text-xs text-forno/60">{day(o.created_at)} · {o.location_name} · {o.mode === 'delivery' ? 'Domicilio' : 'Recogida'}</p>
                </div>
                <span className={['text-xs font-semibold uppercase', o.status === 'cancelado' ? 'text-forno/50' : 'text-albahaca'].join(' ')}>{STATUS[o.status]}</span>
              </div>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-tomate font-semibold">
                  {earnedByOrder[o.id] ? `+${earnedByOrder[o.id]} puntos` : o.status === 'cancelado' ? '' : 'Puntos al entregarlo'}
                  {o.points_redeemed > 0 ? ` · usaste ${o.points_redeemed}` : ''}
                </span>
                <button onClick={() => openReceipt(o)} className="inline-flex items-center gap-1 text-tomate underline underline-offset-4">
                  <FileText className="w-4 h-4" /> Tique
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {tab === 'puntos' && (
        <ul className="mt-4 divide-y divide-tomate/20">
          {ledger.length === 0 && <li className="text-forno/60 text-sm py-2">Aún no hay movimientos.</li>}
          {ledger.map((l) => (
            <li key={l.id} className="py-3 flex items-center justify-between text-sm">
              <span>
                <span className="font-semibold text-forno">{REASON[l.reason]}</span>
                <span className="block text-xs text-forno/60">{l.note || ''} · {day(l.created_at)}</span>
              </span>
              <span className={['font-bold', l.delta > 0 ? 'text-albahaca' : 'text-tomate'].join(' ')}>{l.delta > 0 ? '+' : ''}{l.delta}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8"><Rules /></div>
      <button onClick={logout} className="mt-8 inline-flex items-center gap-2 text-sm text-forno/60 hover:text-tomate">
        <LogOut className="w-4 h-4" /> Cerrar sesión
      </button>
    </div>
  )
}
