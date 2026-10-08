import accountHandler from '../account.js'
import billingHandler from '../billing.js'
import displayHandler from '../display.js'
import geocodeHandler from '../geocode.js'
import maintenanceHandler from '../maintenance.js'
import notificationsHandler from '../notifications.js'
import ordersHandler from '../orders.js'
import pushHandler from '../push.js'
import routesHandler from '../routes.js'
import sessionHandler from '../session.js'
import slotsHandler from '../slots.js'
import stockHandler from '../stock.js'
import storeStatusHandler from '../store-status.js'

const handlers = {
  account: accountHandler,
  billing: billingHandler,
  display: displayHandler,
  geocode: geocodeHandler,
  maintenance: maintenanceHandler,
  notifications: notificationsHandler,
  orders: ordersHandler,
  push: pushHandler,
  routes: routesHandler,
  session: sessionHandler,
  slots: slotsHandler,
  stock: stockHandler,
  'store-status': storeStatusHandler,
}

function queryObject(searchParams) {
  const query = {}
  for (const [key, value] of searchParams) {
    if (key in query) query[key] = Array.isArray(query[key]) ? [...query[key], value] : [query[key], value]
    else query[key] = value
  }
  return query
}

function routeFor(pathname, searchParams) {
  const aliases = {
    '/api/menu': ['store-status', { resource: 'menu' }],
    '/api/superadmin': ['store-status', { resource: 'superadmin' }],
    '/api/site-manifest': ['store-status', { resource: 'superadmin', manifest: '1' }],
    '/api/cash': ['billing', { resource: 'cash' }],
    '/api/cierre': ['push', { cron: 'cierre' }],
    '/api/driver': ['routes', { resource: 'driver' }],
    '/api/print': ['display', { resource: 'print' }],
  }

  const alias = aliases[pathname]
  if (alias) {
    for (const [key, value] of Object.entries(alias[1])) searchParams.set(key, value)
    return alias[0]
  }

  const orderId = pathname.match(/^\/api\/orders\/([^/]+)\/?$/)
  if (orderId) searchParams.set('id', decodeURIComponent(orderId[1]))

  const name = pathname.match(/^\/api\/([^/]+)\/?$/)?.[1]
  return name && handlers[name] ? name : null
}

function createLegacyResponse() {
  let statusCode = 200
  let body = null
  const headers = new Headers()
  const response = {
    status(code) {
      statusCode = code
      return response
    },
    setHeader(name, value) {
      const values = Array.isArray(value) ? value : [value]
      for (const item of values) {
        if (String(name).toLowerCase() === 'set-cookie') headers.append(name, String(item))
        else headers.set(name, String(item))
      }
    },
    getHeader(name) {
      return headers.get(name)
    },
    json(value) {
      headers.set('Content-Type', 'application/json; charset=utf-8')
      body = JSON.stringify(value)
      return response
    },
    send(value) {
      body = value == null ? null : Buffer.isBuffer(value) ? value : String(value)
      return response
    },
    end(value) {
      body = value == null ? null : String(value)
      return response
    },
  }
  return {
    response,
    toFetchResponse() {
      return new Response([204, 304].includes(statusCode) ? null : body, { status: statusCode, headers })
    },
  }
}

async function decodeBody(request) {
  if (['GET', 'HEAD'].includes(request.method)) return undefined
  const text = await request.text()
  if (!text) return undefined
  const type = request.headers.get('content-type') || ''
  if (type.includes('application/json') || type.includes('+json')) {
    try {
      return JSON.parse(text)
    } catch {
      throw new Error('El cuerpo JSON no es válido.')
    }
  }
  if (type.includes('application/x-www-form-urlencoded')) return Object.fromEntries(new URLSearchParams(text))
  return text
}

export async function invokeLegacyApi({ url, method = 'GET', headers: inputHeaders = {}, body, remoteAddress }) {
  const parsedUrl = new URL(url)
  const handlerName = routeFor(parsedUrl.pathname, parsedUrl.searchParams)
  const handler = handlerName && handlers[handlerName]
  if (!handler) return Response.json({ error: 'Ruta no encontrada.' }, { status: 404 })

  const headers = Object.fromEntries(new Headers(inputHeaders).entries())
  const req = {
    method: method.toUpperCase(),
    url: `${parsedUrl.pathname}${parsedUrl.search}`,
    headers,
    query: queryObject(parsedUrl.searchParams),
    body,
    socket: { remoteAddress: remoteAddress || headers['x-real-ip'] || headers['x-nf-client-connection-ip'] || '' },
  }
  const legacy = createLegacyResponse()
  await handler(req, legacy.response)
  return legacy.toFetchResponse()
}

export async function handleNetlifyRequest(request, context) {
  try {
    const body = await decodeBody(request)
    const remoteAddress = context?.ip || request.headers.get('x-nf-client-connection-ip') || ''
    return await invokeLegacyApi({
      url: request.url,
      method: request.method,
      headers: request.headers,
      body,
      remoteAddress,
    })
  } catch (error) {
    const invalidJson = error?.message === 'El cuerpo JSON no es válido.'
    if (!invalidJson) console.error('Error ejecutando la API en Netlify:', error)
    return Response.json(
      { error: invalidJson ? error.message : 'No hemos podido procesar la petición.' },
      { status: invalidJson ? 400 : 500 }
    )
  }
}
