import { useState } from 'react'
import { MapPin, LocateFixed, Search, Check, AlertTriangle } from 'lucide-react'
import { deliveryQuote, deliveryTiers, tierLabel, deliveryProblem } from '../lib/delivery'
import { price } from '../lib/format'

/**
 * Dirección de entrega y precio del envío por distancia.
 *
 * 1. Se escribe la dirección y se comprueba, o se usa la ubicación
 *    del móvil. Con el punto localizado, el precio sale solo.
 * 2. PLAN B: si el buscador no la encuentra o no responde, el cliente
 *    elige su distancia a mano y el pedido queda "sin verificar".
 *    Si falla el GPS o el buscador pero hay coordenadas, la distancia
 *    se calcula igualmente aquí mismo: no depende de nadie.
 *
 * 3. ZONAS: si la dirección es de la otra sede, la web ofrece cambiar
 *    (onSwitchSede); el panel (anySede) puede seguir, con un aviso.
 *
 * value: { address, coords, tier }   onChange(patch)
 */
export default function DeliveryPicker({ locationId, value, onChange, invalid, compact = false, anySede = false, onSwitchSede }) {
  const [status, setStatus] = useState('idle') // idle | busy | found | not-found | unavailable | gps-denied
  const [found, setFound] = useState(null)
  const tiers = deliveryTiers(locationId)

  const quote = value.coords || Number.isInteger(value.tier)
    ? deliveryQuote(locationId, { coords: value.coords, tier: value.tier, anySede })
    : null
  const showManual = ['not-found', 'unavailable', 'gps-denied'].includes(status) || Number.isInteger(value.tier)

  const geocode = async (params) => {
    const res = await fetch(`/api/geocode?${new URLSearchParams({ location: locationId, ...params })}`)
    if (!res.ok) return { ok: false, reason: 'unavailable' }
    return res.json()
  }

  const search = async () => {
    if (!value.address.trim()) return
    setStatus('busy')
    try {
      const r = await geocode({ q: value.address })
      if (!r.ok) { setStatus(r.reason === 'not-found' ? 'not-found' : 'unavailable'); return }
      setFound(r.label)
      onChange({ coords: r.coords, tier: null })
      setStatus('found')
    } catch {
      setStatus('unavailable')
    }
  }

  const useGps = () => {
    if (!navigator.geolocation) { setStatus('gps-denied'); return }
    setStatus('busy')
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        onChange({ coords, tier: null })
        try {
          const r = await geocode({ lat: coords.lat, lng: coords.lng })
          if (r.ok) {
            setFound(r.label)
            if (!value.address.trim()) onChange({ address: r.label, coords, tier: null })
          }
        } catch { /* sin dirección escrita, pero la distancia ya está calculada */ }
        setStatus('found')
      },
      () => setStatus('gps-denied'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    )
  }

  const field = 'w-full rounded-2xl border bg-white/60 px-4 py-3 text-sm text-carbon placeholder:text-carbon/35 outline-none transition-colors'

  return (
    <div className="flex flex-col gap-3">
      <label className="block">
        <span className={compact ? 'mono normal-case text-carbon/50 text-xs' : 'mono text-carbon/50 mb-2 block'}>
          DIRECCIÓN DE ENTREGA
        </span>
        <input
          value={value.address}
          onChange={(e) => { onChange({ address: e.target.value, coords: null, tier: null }); setStatus('idle') }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); search() } }}
          placeholder="Calle, número y pueblo"
          className={[field, compact ? 'mt-1' : '', invalid && !quote?.ok ? 'border-tomate' : 'border-carbon/12 focus:border-tomate'].join(' ')}
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={search}
          disabled={status === 'busy' || !value.address.trim()}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-carbon/15 px-3 py-2.5 text-sm font-semibold text-carbon disabled:opacity-40"
        >
          <Search className="w-4 h-4" /> Comprobar dirección
        </button>
        <button
          type="button"
          onClick={useGps}
          disabled={status === 'busy'}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-carbon/15 px-3 py-2.5 text-sm font-semibold text-carbon disabled:opacity-40"
        >
          <LocateFixed className="w-4 h-4" /> {compact ? 'Ubicación' : 'Usar mi ubicación'}
        </button>
      </div>

      {status === 'busy' && <p className="text-sm text-carbon/55">Buscando…</p>}

      {quote?.ok && quote.verified && (
        <p className="flex items-start gap-2 rounded-2xl bg-albahaca/10 px-4 py-3 text-sm text-albahaca">
          <Check className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>
            {found && <span className="block font-semibold text-carbon">{found}</span>}
            A {quote.label} · envío <strong>{price(quote.fee)}</strong>
            {quote.closer && (
              <span className="block mt-1 text-horno">Ojo: es de la zona de {quote.closer.name} (a {quote.closer.km.toLocaleString('es-ES')} km).</span>
            )}
          </span>
        </p>
      )}

      {quote && !quote.ok && (
        <p className="flex items-start gap-2 rounded-2xl bg-tomate/10 px-4 py-3 text-sm text-tomate">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" /> {deliveryProblem(quote)}
        </p>
      )}

      {quote?.reason === 'other-sede' && onSwitchSede && (
        <button type="button" onClick={() => onSwitchSede(quote.closer.id)} className="btn-neon min-h-[3rem] text-base">
          Pedir en {quote.closer.name}
        </button>
      )}

      {showManual && (
        <div className="rounded-2xl border border-horno/40 bg-horno/5 p-4">
          <p className="text-sm text-carbon">
            {status === 'gps-denied'
              ? 'No hemos podido usar tu ubicación.'
              : status === 'not-found'
                ? 'No encontramos esa dirección en el mapa.'
                : status === 'unavailable'
                  ? 'El buscador de direcciones no responde ahora mismo.'
                  : 'Distancia elegida a mano.'}
            {' '}Elige la distancia aproximada al local; te la confirmaremos.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {tiers.map((t, i) => (
              <button
                key={t.upToKm}
                type="button"
                onClick={() => onChange({ tier: i, coords: null })}
                aria-pressed={value.tier === i}
                className={[
                  'flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-sm',
                  value.tier === i ? 'border-tomate bg-tomate/5 font-semibold text-carbon' : 'border-carbon/12 text-carbon/70',
                ].join(' ')}
              >
                <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{tierLabel(tiers, i)}</span>
                <span className="mono normal-case text-carbon/55">+{price(t.fee)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {invalid && !quote?.ok && !showManual && (
        <p className="text-xs text-tomate">Comprueba la dirección o usa tu ubicación.</p>
      )}
    </div>
  )
}
