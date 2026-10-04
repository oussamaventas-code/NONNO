import { getLocation } from '../src/data/locations.js'
import { planOrder } from '../src/lib/kitchenSlots.js'
import { kitchenLoad, SLOT_ERRORS } from './_lib/slots.js'
import { doughStatus, doughProblem } from './_lib/store.js'
import { isConfigured } from './_lib/supabase.js'

/**
 * GET /api/slots?location=sangonera&pizzas=3
 * Hora a la que estaría listo un pedido de N pizzas si se hiciera
 * ahora. Público: la web lo enseña ANTES de que el cliente pida.
 * Es orientativo; la franja definitiva se asigna al guardar.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Método no permitido' })
  }

  const location = getLocation(String(req.query?.location || ''))
  if (!location?.kitchen) return res.status(400).json({ error: 'Sede no válida.' })
  const pizzas = Math.max(0, Math.min(200, Math.floor(Number(req.query?.pizzas)) || 0))

  try {
    res.setHeader('Cache-Control', 'no-store')
    /* Sin masas para todo el pedido: ni se calcula la hora */
    const noDough = isConfigured() && pizzas ? doughProblem(await doughStatus(location.id), pizzas) : null
    if (noDough) return res.status(200).json({ ok: false, reason: 'dough', message: noDough })
    const { load } = await kitchenLoad(location.id, location.kitchen)
    const plan = planOrder({ nowMs: Date.now(), kitchen: location.kitchen, load, pizzas })
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json(plan.ok
      ? { ok: true, readyAt: new Date(plan.readyAt).toISOString() }
      : { ok: false, reason: plan.reason, message: SLOT_ERRORS[plan.reason] })
  } catch (err) {
    console.error('Error calculando franjas:', err)
    return res.status(500).json({ error: 'No hemos podido calcular la hora.' })
  }
}
