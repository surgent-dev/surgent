import { Hono } from 'hono'
import type { AppContext } from '@/types/application'

const dispatch = new Hono<AppContext>()

const PLATFORM_SUFFIXES = ['.surgent.site', '.surgent.dev']
const TRACKER_PATH = '/_s/t/s.js'
const EVENT_PATH = '/_s/t/e'
const HOSTNAME_HEADER = 'x-surgent-hostname'

function extractSubdomain(hostname: string): string | null {
  const parts = hostname.split('.')
  return parts.length >= 2 ? parts[0] || null : null
}

function isPlatformHostname(hostname: string): boolean {
  return PLATFORM_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
}

function isPreviewSubdomain(hostname: string): boolean {
  const sub = extractSubdomain(hostname)
  if (!sub) return false
  return sub.startsWith('preview-') || /^\d+-/.test(sub)
}

function proxyHeaders(request: Request, hostname?: string): Headers {
  const headers = new Headers(request.headers)
  const ip = request.headers.get('cf-connecting-ip')

  headers.delete('host')
  headers.delete('cookie')

  if (hostname) headers.set(HOSTNAME_HEADER, hostname)
  else headers.delete(HOSTNAME_HEADER)

  if (ip) headers.set('x-forwarded-for', ip)
  else headers.delete('x-forwarded-for')

  return headers
}

function upstreamUrl(upstream: string, pathname: string, requestUrl: string): URL {
  const target = new URL(upstream)
  target.pathname = pathname
  target.search = new URL(requestUrl).search
  return target
}

async function proxy(request: Request, upstream: string, pathname: string, hostname?: string) {
  return fetch(upstreamUrl(upstream, pathname, request.url), {
    method: request.method,
    headers: proxyHeaders(request, hostname),
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
  })
}

async function proxyScript(request: Request, upstream: string): Promise<Response> {
  const url = upstreamUrl(upstream, '/script.js', request.url)
  const res = await fetch(url, {
    method: request.method,
    headers: proxyHeaders(request),
    cache: 'no-store',
  })
  const headers = new Headers(res.headers)
  headers.set('cache-control', 'no-store')
  headers.set('cdn-cache-control', 'no-store')

  if (request.method === 'HEAD') {
    return new Response(null, {
      status: res.status,
      statusText: res.statusText,
      headers,
    })
  }

  const body = await res.text()
  return new Response(body.replace(/\/api\/send/g, EVENT_PATH), {
    status: res.status,
    statusText: res.statusText,
    headers,
  })
}

function injectTracker(response: Response): Response {
  let hasTracker = false

  return new HTMLRewriter()
    .on('script', {
      element(el) {
        const src = el.getAttribute('src')
        if (!src) return

        try {
          const url = new URL(src, 'https://surgent.site')
          if (url.pathname === TRACKER_PATH) hasTracker = true
        } catch {
          if (src === TRACKER_PATH) hasTracker = true
        }
      },
    })
    .on('head', {
      element(el) {
        el.onEndTag((end) => {
          if (hasTracker) return
          end.before(`<script defer src="${TRACKER_PATH}"></script>`, { html: true })
        })
      },
    })
    .transform(response)
}

dispatch.all('/*', async (c) => {
  const url = new URL(c.req.url)
  const hostname = url.hostname

  if (!c.env.dispatcher) {
    return c.text('Dispatcher binding is not configured', 500)
  }

  const scriptName = isPlatformHostname(hostname) ? extractSubdomain(hostname) : null
  if (!scriptName) return c.text('Not found', 404)

  try {
    const worker = c.env.dispatcher.get(scriptName)
    const analyticsUpstream = c.env.ANALYTICS_UPSTREAM

    if (url.pathname === TRACKER_PATH) {
      if (!analyticsUpstream) return new Response(null, { status: 204 })
      try {
        return await proxyScript(c.req.raw, analyticsUpstream)
      } catch {
        return new Response(null, { status: 204 })
      }
    }

    if (url.pathname === EVENT_PATH) {
      if (!analyticsUpstream) return new Response(null, { status: 204 })
      try {
        return await proxy(c.req.raw, analyticsUpstream, '/api/send', hostname)
      } catch {
        return new Response(null, { status: 204 })
      }
    }

    const response = await worker.fetch(new Request(url.toString(), c.req.raw))

    if (!analyticsUpstream) return response
    if (c.req.raw.method === 'HEAD') return response
    if (!(response.headers.get('content-type') || '').includes('text/html')) return response
    if (isPreviewSubdomain(hostname)) return response

    return injectTracker(response)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return c.text(`Dispatch failed: ${message}`, 502)
  }
})

export default dispatch
