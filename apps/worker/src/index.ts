import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { requestId } from 'hono/request-id'
import { pinoLogger } from 'hono-pino'
import { HttpError } from './lib/errors'
import projects from './routes/projects'
import git from './routes/git'
import preview from './routes/preview'
import agent from './routes/agent'
import upload from './routes/upload'
import github from './routes/github'
import mcp from './routes/mcp'
import admin from './routes/admin'
import providers from './routes/providers'
import pay from './routes/pay'
import { serve as serveInngest } from 'inngest/hono'
import { inngest, functions as inngestFunctions } from './inngest'
import { auth } from './lib/auth'
import { config } from './lib/config'
import { db } from './lib/db'
import { migrate } from '@repo/db'
import {
  oauthProviderAuthServerMetadata,
  oauthProviderOpenIdConfigMetadata,
} from '@better-auth/oauth-provider'
import type { AppContext } from '@/types/application'
import { startBoss, stopBoss } from '@/lib/pay/queue'
import { logger, createLogger } from '@/lib/logger'

const log = createLogger('server')

function isPreviewSubdomain(sub: string): boolean {
  return sub.startsWith('preview-') || /^\d+-/.test(sub)
}

const app = new Hono<AppContext>({
  getPath: (req) => {
    const url = new URL(req.url)
    const path = url.pathname
    const headerHost =
      req.headers.get('x-forwarded-host') ??
      req.headers.get('x-original-host') ??
      req.headers.get('cf-connecting-host') ??
      url.hostname
    const host = headerHost.split(',')[0]?.trim() || url.hostname
    const [subdomain] = host.split(':')[0].split('.')

    if (path.startsWith('/server') || path.startsWith('/preview')) {
      return path
    }

    if (subdomain && isPreviewSubdomain(subdomain)) {
      return `/preview${path}`
    }

    return path
  },
})

app.onError((err, c) => {
  if (err instanceof HttpError) {
    return c.json({ error: err.message }, err.status as 400 | 401 | 403 | 404 | 500)
  }

  log.error({ err }, 'unhandled error')
  return c.json({ error: 'Internal Server Error' }, 500)
})

app.use(
  '*',
  cors({
    origin: (origin) => {
      if (origin && config.server.trustedOrigins.includes(origin)) {
        return origin
      }
      return null
    },
    allowMethods: ['GET', 'HEAD', 'PUT', 'POST', 'DELETE', 'PATCH', 'OPTIONS'],
    exposeHeaders: ['Content-Length', 'Content-Disposition'],
    maxAge: 600,
    credentials: true,
  }),
)

app.use('*', requestId())
app.use(
  '*',
  pinoLogger({
    pino: logger,
    http: {
      referRequestIdKey: 'requestId',
      onReqMessage: false,
      onReqBindings: () => ({}),
      onResBindings: () => ({}),
      onResMessage: (c) => {
        const p = c.req.path
        let tag = ''
        if (p.startsWith('/api/pay/webhooks/')) {
          const env = p.split('/')[5] || ''
          tag = `[WEBHOOK:whop:${env}] `
        } else if (p.startsWith('/api/agent/')) tag = '[AGENT] '
        else if (p.startsWith('/api/projects/')) tag = '[PROJECT] '
        else if (p.startsWith('/api/pay/')) tag = '[PAY] '
        else if (p.startsWith('/api/github/')) tag = '[GITHUB] '
        else if (p.startsWith('/api/auth/')) tag = '[AUTH] '
        else if (p.startsWith('/api/upload/')) tag = '[UPLOAD] '
        else if (p.startsWith('/api/mcp/') || p.startsWith('/mcp/')) tag = '[MCP] '
        else if (p.startsWith('/api/admin/')) tag = '[ADMIN] '
        else if (p.startsWith('/api/inngest')) tag = '[INNGEST] '
        else if (p.startsWith('/preview')) tag = '[PREVIEW] '
        return `${tag}${c.req.method} ${p} ${c.res.status}`
      },
    },
  }),
)

// OAuth 2.1 metadata for issuer with path (/api/auth)
app.get('/.well-known/oauth-authorization-server/api/auth', (c) => {
  return oauthProviderAuthServerMetadata(auth)(c.req.raw)
})
app.get('/api/auth/.well-known/openid-configuration', (c) => {
  return oauthProviderOpenIdConfigMetadata(auth)(c.req.raw)
})

// Ensure CORS headers are present even if downstream returns a raw Response (e.g. Better Auth)
app.use('*', async (c, next) => {
  await next()

  const origin = c.req.header('origin')
  if (!origin) {
    return
  }
  if (!config.server.trustedOrigins.includes(origin)) {
    return
  }

  c.res.headers.set('Access-Control-Allow-Origin', origin)
  c.res.headers.set('Access-Control-Allow-Credentials', 'true')
  c.res.headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Disposition')
  c.header('Vary', 'Origin', { append: true })
})

// Better Auth handler
app.on(['POST', 'GET'], '/api/auth/*', (c) => auth.handler(c.req.raw))

// Session middleware
app.use('*', async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })

  if (!session) {
    c.set('user', null)
    c.set('session', null)
    return next()
  }

  c.set('user', session.user)
  c.set('session', session.session)
  return next()
})

// Inngest serve handler
app.on(
  ['GET', 'PUT', 'POST'],
  '/api/inngest',
  serveInngest({ client: inngest, functions: inngestFunctions }),
)

app.get('/health', (c) => c.text('ok'))

app.get('/api/session', (c) => {
  const user = c.get('user')
  const session = c.get('session')

  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  return c.json({ session, user })
})

// Routes
app.route('/api/projects', projects)
app.route('/api/projects', git)
app.route('/api/agent', agent)
app.route('/api/upload', upload)
app.route('/api/github', github)
app.route('/api/mcp', mcp)
app.route('/api/admin', admin)
app.route('/api/providers', providers)
app.route('/api/pay', pay)
app.route('/mcp', mcp)
app.route('/preview', preview)

// Start server
const port = Number(config.server.port)

;(async () => {
  log.info('running migrations')
  const result = await migrate(db)
  const { error, results } = result

  results?.forEach((it) => {
    if (it.status === 'Success') {
      log.info({ migration: it.migrationName }, 'migration executed successfully')
    } else if (it.status === 'Error') {
      log.error({ migration: it.migrationName }, 'migration failed')
    }
  })

  if (error) {
    log.fatal({ err: error }, 'failed to run migrations on startup')
    process.exit(1)
  }

  log.info('migrations completed successfully')

  await startBoss()

  const host = config.server.host

  Bun.serve({
    hostname: host,
    port,
    fetch: (req) => app.fetch(req),
  })

  const mask = (k?: string) => (k ? `${k.slice(0, 8)}...${k.slice(-4)}` : '(missing)')
  log.info(
    {
      host,
      port,
      whop: {
        test: {
          apiKey: mask(config.whop.test.apiKey),
          company: config.whop.test.platformCompanyId,
        },
        live: {
          apiKey: mask(config.whop.live.apiKey),
          company: config.whop.live.platformCompanyId,
        },
      },
    },
    'listening',
  )

  const shutdown = async (signal: string) => {
    log.info({ signal }, 'shutting down')
    try {
      await stopBoss()
    } catch (e) {
      log.error({ err: e }, 'stopBoss error')
    }
    process.exit(0)
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
})()
