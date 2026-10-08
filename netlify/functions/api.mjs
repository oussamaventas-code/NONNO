import { handleNetlifyRequest } from '../../api/_lib/netlifyAdapter.js'

export default handleNetlifyRequest

export const config = { path: '/api/*' }
