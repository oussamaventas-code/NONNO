import { createClient } from '@supabase/supabase-js'

/* ═══════════════════════════════════════════════════════════════
   Cliente de Supabase para las funciones del servidor.

   Usa la clave de SERVICIO. Nunca debe importarse desde src/:
   este fichero solo se ejecuta en el servidor de Vercel.
   ═══════════════════════════════════════════════════════════════ */

let client = null

export function db() {
  if (client) return client

  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      'Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en las variables de entorno.'
    )
  }

  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return client
}

/** ¿Está el sistema configurado? Para dar un error claro y no un 500 seco. */
export const isConfigured = () =>
  Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
