import { db, isConfigured } from './supabase.js'
import { applyLocationOverrides } from '../../src/data/locations.js'

const TTL_MS = 15000
let loadedAt = 0
let inflight = null

/**
 * Carga la configuración pública que también afecta a cálculos del
 * servidor. Si la tabla aún no existe o hay un fallo temporal, sigue
 * usando las sedes del código para no interrumpir los pedidos.
 */
export async function loadSiteConfiguration({ force = false } = {}) {
  if (!isConfigured()) return
  if (!force && Date.now() - loadedAt < TTL_MS) return
  inflight ||= db().from('site_content').select('content').eq('id', 'main').maybeSingle()
    .then(({ data, error }) => {
      if (error) {
        if (!['42P01', 'PGRST205'].includes(error.code)) console.error('No se pudo leer la configuración del sitio:', error)
        loadedAt = Date.now()
        return
      }
      applyLocationOverrides(data?.content?.locations || {})
      loadedAt = Date.now()
    })
    .catch((error) => { console.error('No se pudo leer la configuración del sitio:', error) })
    .finally(() => { inflight = null })
  await inflight
}
