import { Hono } from 'hono'
import { cors } from 'hono/cors'
import projects from './routes/projects'
import preview from './routes/preview'
import agent from './routes/agent'
import upload from './routes/upload'
import github from './routes/github'
import mcp from './routes/mcp'
import { auth } from './lib/auth'
import { config } from './lib/config'
import type { AppContext } from '@/types/application'

function isPreviewSubdomain(sub: string): boolean {
  return sub.startsWith('preview-') || /^\d+-/.test(sub)
}

const app = new Hono<AppContext>({
  getPath: (req) => {
    const url = new URL(req.url)
    const path = url.pathname
    const [subdomain] = url.hostname.split('.')

    if (path.startsWith('/server') || path.startsWith('/preview')) {
      return path
    }

    if (subdomain && isPreviewSubdomain(subdomain)) {
      return `/preview${path}`
    }

    return path
  },
})

app.use(
  '/*',
  cors({
    origin: (origin) => {
      const trustedOrigins = [
        ...config.server.clientOrigins,
        'http://localhost:3000',
        'http://localhost:3001',
      ]
      if (origin && trustedOrigins.includes(origin)) {
        return origin
      }
      return trustedOrigins[0]
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

// Session middleware
app.use('*', async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })

  if (session) {
    c.set('user', session.user)
    c.set('session', session.session)
  } else {
    c.set('user', null)
    c.set('session', null)
  }

  return next()
})

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
app.route('/api/agent', agent)
app.route('/api/upload', upload)
app.route('/api/github', github)
app.route('/api/mcp', mcp)
app.route('/preview', preview)

// Start server
const port = Number(config.server.port)

Bun.serve({
  port,
  fetch: (req) => app.fetch(req),
})

console.log(`[worker] listening on http://localhost:${port}`)
