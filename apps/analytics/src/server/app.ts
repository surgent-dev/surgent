import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serverError } from '@/lib/response'
import * as send from '@/server/routes/api/send/route'
import { registerApiRoutes } from '@/server/routes/api'
import { normalizeBasePath, stripBasePath, withBasePath } from './paths'
import { getConfiguredCollectPath, getConfiguredTrackerPaths, registerPublicRoutes } from './public'

const basePath = normalizeBasePath(process.env.BASE_PATH || '')
const corsMaxAge = Number(process.env.CORS_MAX_AGE || '86400')
const forceSSL = !!process.env.FORCE_SSL
const frameAncestors = process.env.ALLOWED_FRAME_URLS || ''
const trackerPaths = getConfiguredTrackerPaths()
const collectPath = getConfiguredCollectPath()
const publicCorsPaths = new Set<string>(['/api/send', '/api/batch'])

if (collectPath) {
  publicCorsPaths.add(collectPath)
}

const contentSecurityPolicy = `
  default-src 'self';
  img-src 'self' https: data:;
  script-src 'self' 'unsafe-eval' 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  connect-src 'self' https:;
  frame-ancestors 'self' ${frameAncestors};
`
  .replace(/\s{2,}/g, ' ')
  .trim()

const corsOptions = {
  origin: '*',
  allowHeaders: ['*'],
  allowMethods: ['GET', 'DELETE', 'POST', 'PUT', 'OPTIONS'],
  maxAge: corsMaxAge,
}

export async function createApp() {
  const app = new Hono()

  for (const path of publicCorsPaths) {
    app.use(withBasePath(basePath, path), cors(corsOptions))
  }

  app.use('*', async (c, next) => {
    await next()

    const logicalPath = stripBasePath(basePath, new URL(c.req.url).pathname)
    const isApiResponse = logicalPath.startsWith('/api/') || publicCorsPaths.has(logicalPath)
    const isPublicCorsResponse = publicCorsPaths.has(logicalPath)

    if (isApiResponse) {
      c.header('Cache-Control', 'no-cache')

      if (isPublicCorsResponse) {
        c.header('Access-Control-Allow-Origin', '*')
        c.header('Access-Control-Allow-Headers', '*')
        c.header('Access-Control-Allow-Methods', 'GET, DELETE, POST, PUT')
        c.header('Access-Control-Max-Age', String(corsMaxAge))
      }

      return
    }

    c.header('X-DNS-Prefetch-Control', 'on')
    c.header('Content-Security-Policy', contentSecurityPolicy)

    if (forceSSL) {
      c.header('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
    }

    if (trackerPaths.has(logicalPath)) {
      c.header('Access-Control-Allow-Origin', '*')
      c.header('Cache-Control', 'no-store')
    }
  })

  app.onError((err) => {
    console.error(err)
    return serverError({ message: 'Server error' })
  })

  app.notFound(() => new Response('Not found', { status: 404 }))

  registerPublicRoutes(app, basePath)
  registerApiRoutes(app, basePath)

  if (collectPath && collectPath !== '/api/send') {
    const fullCollectPath = withBasePath(basePath, collectPath)

    app.options(fullCollectPath, () => new Response(null, { status: 204 }))
    app.post(fullCollectPath, (c) => send.POST(c.req.raw))
  }

  return app
}
