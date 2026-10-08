import { invokeLegacyApi } from '../../api/_lib/netlifyAdapter.js'

export default async function dailyClose() {
  const response = await invokeLegacyApi({
    url: 'https://internal.invalid/api/cierre',
    method: 'GET',
    headers: { authorization: `Bearer ${process.env.CRON_SECRET || ''}` },
  })
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`El recordatorio de cierre respondió ${response.status}: ${detail}`)
  }
  return new Response(await response.text(), { status: response.status })
}

export const config = { schedule: '0 22 * * *' }
