import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check, MessageCircle, RefreshCw, Send } from 'lucide-react'
import { mobileNumber } from '../lib/customerLookup'
import { getLocation } from '../data/locations'
import { fetchNotificationConfig, retryCustomerNotification, sendNotificationTest } from './api'

const EVENT_LABEL = { recibido: 'Pedido recibido', listo: 'Pedido listo', reparto: 'Sale para reparto', cancelado: 'Pedido cancelado' }

export function CustomerNotificationBanner({ orders, onError, onRetried }) {
  const [busy, setBusy] = useState(null)
  const rows = orders.flatMap((order) => Object.entries(order.sms || {})
    .filter(([, value]) => ['fallido', 'sin_configurar'].includes(value?.status))
    .map(([event, value]) => ({ order, event, value })))
  if (!rows.length) return null

  const retry = async ({ order, event }) => {
    const key = `${order.id}:${event}`
    setBusy(key)
    try {
      await retryCustomerNotification(order.id, event)
      await onRetried?.()
    } catch (error) {
      onError(error.message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="border-b border-horno/40 bg-horno/10 px-4 py-3" role="alert">
      <p className="flex flex-wrap items-center justify-center gap-2 text-center text-sm font-bold text-carbon">
        <AlertTriangle className="h-4 w-4 text-horno" />
        {rows.length} aviso{rows.length === 1 ? '' : 's'} a cliente{rows.length === 1 ? '' : 's'} sin enviar
      </p>
      <ul className="mt-2 flex flex-col items-center gap-2">
        {rows.slice(0, 4).map(({ order, event, value }) => {
          const key = `${order.id}:${event}`
          return (
            <li key={key} className="flex w-full max-w-2xl flex-wrap items-center justify-between gap-2 rounded-md border border-horno/25 bg-masa px-3 py-2 text-sm">
              <span className="min-w-0 text-carbon/75"><strong>{order.ref}</strong> · {EVENT_LABEL[event] || event}{value.error ? ` · ${value.error}` : ''}</span>
              <button onClick={() => retry({ order, event })} disabled={busy === key} className="ptab soft !min-h-9 !px-3 disabled:opacity-50">
                <RefreshCw className="h-3.5 w-3.5" /> {busy === key ? 'Enviando…' : 'Reintentar'}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function CustomerNotificationSettings({ locationIds, onError }) {
  const [config, setConfig] = useState(null)
  const [location, setLocation] = useState(locationIds[0] || '')
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    let active = true
    fetchNotificationConfig().then((data) => { if (active) setConfig(data) })
      .catch((error) => { if (active) onError(error.message) })
    return () => { active = false }
  }, [onError])

  useEffect(() => {
    if (!locationIds.includes(location)) setLocation(locationIds[0] || '')
  }, [locationIds.join('|')]) // eslint-disable-line react-hooks/exhaustive-deps

  const templatesMissing = useMemo(() => config?.templates
    ? Object.entries(config.templates).filter(([, ready]) => !ready).map(([event]) => EVENT_LABEL[event] || event)
    : [], [config])

  const sendTest = async (event) => {
    event.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      const result = await sendNotificationTest(location, phone)
      setMessage({ ok: true, text: `El proveedor aceptó la prueba por ${result.channel === 'sms-android' ? 'el móvil del local' : 'Twilio'}.` })
    } catch (error) {
      setMessage({ ok: false, text: error.message })
    } finally {
      setBusy(false)
    }
  }

  const ready = Boolean(config?.sms || config?.whatsapp)
  return (
    <section className="rounded-md border border-tomate/20 bg-masa p-3 text-sm">
      <p className="mono text-tomate">AVISOS A CLIENTES</p>
      <p className="mt-1 font-semibold text-carbon">{config?.databaseReady === false ? 'Falta activar el registro en Supabase' : ready ? 'Envío automático disponible' : config ? 'Mensajes todavía sin configurar' : 'Comprobando configuración…'}</p>
      {config?.databaseReady === false ? (
        <p className="mt-1 text-carbon/65">Ejecuta <code>supabase/notificaciones-cliente.sql</code> en Supabase para guardar los reintentos de forma segura.</p>
      ) : (
        <>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className={['inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold', config?.whatsapp ? 'bg-albahaca/10 text-albahaca' : 'bg-carbon/5 text-carbon/50'].join(' ')}><MessageCircle className="h-3.5 w-3.5" /> WhatsApp {config?.whatsapp ? 'activo' : 'sin configurar'}</span>
            <span className={['inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold', config?.sms ? 'bg-albahaca/10 text-albahaca' : 'bg-carbon/5 text-carbon/50'].join(' ')}><Send className="h-3.5 w-3.5" /> SMS {config?.sms ? 'activo' : 'sin configurar'}</span>
          </div>
          {!ready && <p className="mt-2 text-carbon/65">Configura las credenciales SMS Gateway o Twilio en las variables protegidas de Vercel. Los fallos aparecerán en el panel y se podrán reintentar.</p>}
          {config?.whatsapp && templatesMissing.length > 0 && <p className="mt-2 text-xs text-carbon/55">Plantillas WhatsApp aún no configuradas: {templatesMissing.join(', ')}. Esos avisos usarán SMS si está activo.</p>}
          {config?.databaseReady && config?.sms && (
            <form onSubmit={sendTest} className="mt-3 flex flex-col gap-2 sm:flex-row">
              {locationIds.length > 1 && (
                <label className="sr-only" htmlFor="notification-test-location">Sede para la prueba</label>
              )}
              {locationIds.length > 1 && <select id="notification-test-location" value={location} onChange={(event) => setLocation(event.target.value)} className="pfield !w-auto !py-2">{locationIds.map((id) => <option key={id} value={id}>{getLocation(id)?.name || id}</option>)}</select>}
              <label className="sr-only" htmlFor="notification-test-phone">Móvil para el SMS de prueba</label>
              <input id="notification-test-phone" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Móvil para la prueba" className="pfield min-w-0 flex-1" />
              <button type="submit" disabled={busy || !mobileNumber(phone) || config?.databaseReady === false} className="ptab soft disabled:opacity-45">
                <Send className="h-4 w-4" /> {busy ? 'Enviando…' : 'Enviar SMS de prueba'}
              </button>
            </form>
          )}
          {message && <p role="status" className={['mt-2 flex items-center gap-1.5 text-xs font-semibold', message.ok ? 'text-albahaca' : 'text-tomate'].join(' ')}>{message.ok && <Check className="h-3.5 w-3.5" />}{message.text}</p>}
          {config?.sms && <p className="mt-2 text-xs text-carbon/50">La prueba enviará un SMS real al número escrito; el proveedor puede cobrarlo. Que el proveedor lo acepte no confirma su entrega al móvil.</p>}
        </>
      )}
    </section>
  )
}
