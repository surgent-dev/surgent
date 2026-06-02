import { Hono, type Context, type Next } from 'hono'
import { withBasePath } from '../../paths'
import core from './core'
import links from './links'
import pixels from './pixels'
import realtime from './realtime'
import reports from './reports'
import websites from './websites'

function unauthorized() {
  return Response.json({ error: 'Unauthorized' }, { status: 401 })
}

async function requireInternalToken(c: Context, next: Next) {
  const expected = process.env.ANALYTICS_INTERNAL_TOKEN
  if (!expected) {
    return Response.json({ error: 'Analytics API token is not configured' }, { status: 503 })
  }

  const header = c.req.header('authorization') || ''
  const token = header.match(/^Bearer\s+(.+)$/i)?.[1]
  if (token !== expected) return unauthorized()

  await next()
}

export function registerApiRoutes(app: Hono, basePath = '') {
  app.route(withBasePath(basePath, '/api'), core)

  const protectedApi = new Hono()
  protectedApi.use('*', requireInternalToken)
  protectedApi.route('/links', links)
  protectedApi.route('/pixels', pixels)
  protectedApi.route('/realtime', realtime)
  protectedApi.route('/reports', reports)
  protectedApi.route('/websites', websites)

  app.route(withBasePath(basePath, '/api'), protectedApi)
}
