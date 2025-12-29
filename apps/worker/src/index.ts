import { Hono } from 'hono'
import { cors } from 'hono/cors'
import projects from './routes/projects'
import preview from './routes/preview'
import agent from './routes/agent'
import dispatch from './routes/dispatch'
import proxy from './routes/proxy'
import upload from './routes/upload'
import marketplace from './routes/marketplace'
import whopWebhooks from './routes/whop-webhooks'
import github from './routes/github'
import { auth } from './lib/auth'
import type { AppContext } from '@/types/application'
import { processWebhookBatch } from './queues/webhook-consumer'

const app = new Hono<AppContext>({
  getPath: (req) => {
    const url = new URL(req.url)
    const path = url.pathname
    const [subdomain] = url.hostname.split('.')

    // Never rewrite server container routes
    if (path.startsWith('/server')) return path

    // AI proxy subdomain (ai.surgent.dev)
    if (subdomain === 'ai') {
      return `/proxy${path}`
    }

    if (subdomain && isPreviewSubdomain(subdomain)) {
      return `/preview${path}`
    }
    return path
  },
})

// CORS for Better Auth endpoints
app.use(
  '/*',
  cors({
    origin: (origin, c) => {
      const trustedOrigins = [
        c.env.CLIENT_ORIGIN ,
        'http://localhost:3000',
        'http://localhost:3001',
      ]
      return origin && trustedOrigins.includes(origin) ? origin : trustedOrigins[0]
    },
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['POST', 'GET', 'OPTIONS', 'PATCH', 'DELETE'],
    exposeHeaders: ['Content-Length', 'Content-Disposition'],
    maxAge: 600,
    credentials: true,
  })
)

// Better Auth handler
app.on(['POST', 'GET'], '/api/auth/*', (c) => auth.handler(c.req.raw))

// Session middleware - adds user and session to context
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

app.get('/health', (c) => c.text('ok'))

// Example session endpoint
app.get('/api/session', (c) => {
  const user = c.get('user')
  const session = c.get('session')
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  return c.json({ session, user })
})

app.route('/api/projects', projects)
app.route('/api/agent', agent)
app.route('/api/proxy', proxy)
app.route('/api/upload', upload)
app.route('/api/marketplace', marketplace)
app.route('/api/webhooks/whop', whopWebhooks)
app.route('/api/github', github)
app.route('/preview', preview)
app.route('/proxy', proxy)  // ai.surgent.dev subdomain


app.route('/', dispatch)

function isPreviewSubdomain(sub: string): boolean {
  if (sub.startsWith('preview-')) return true
  const [maybeNumeric] = sub.split('-')
  return /^\d+$/.test(maybeNumeric)
}

export default {
  fetch: app.fetch,
  async queue(batch: MessageBatch, env: Env, ctx: ExecutionContext) {
    await processWebhookBatch(batch as MessageBatch<{ webhookId: string }>, env, ctx)
  },
} satisfies ExportedHandler<Env>
