import { Hono } from 'hono'
import { Sandbox as E2BSandbox } from 'e2b'
import type { AppContext } from '@/types/application'
import { config } from '@/lib/config'

const preview = new Hono<AppContext>()

function parseSandboxSubdomain(host: string) {
  const subdomain = host.split(':')[0].split('.')[0]
  const [first, ...rest] = subdomain.split('-')

  return /^\d+$/.test(first) && rest.length
    ? { sandboxId: rest.join('-'), port: parseInt(first, 10) }
    : { sandboxId: subdomain, port: Number(config.sandbox.defaultPort) }
}

async function buildTargetUrl(sandboxId: string, port: number, pathname: string, search: string) {
  const sbx = await E2BSandbox.connect(sandboxId)
  const target = new URL(`https://${sbx.getHost(port)}`)
  target.pathname = pathname
  target.search = search
  return target
}

async function proxyRequest(req: Request, target: URL, extraHeaders: Record<string, string>) {
  const headers = new Headers(req.headers)
  headers.delete('host')
  Object.entries(extraHeaders).forEach(([k, v]) => headers.set(k, v))

  const isWs = req.headers.get('upgrade') === 'websocket'
  const init = { method: req.method, headers, body: isWs ? undefined : req.body }
  const resp = await fetch(new Request(target.toString(), init))

  if (isWs) return resp

  // Disable caching for dev preview
  const outHeaders = new Headers(resp.headers)
  outHeaders.set('cache-control', 'no-store, no-cache, must-revalidate, max-age=0')
  outHeaders.delete('etag')
  outHeaders.delete('last-modified')

  return new Response(resp.body, {
    status: resp.status,
    statusText: resp.statusText,
    headers: outHeaders,
  })
}

preview.all('/*', async (c) => {
  const url = new URL(c.req.url)
  const headerHost =
    c.req.header('x-forwarded-host') ??
    c.req.header('x-original-host') ??
    c.req.header('cf-connecting-host') ??
    url.hostname
  const host = headerHost.split(',')[0]?.trim() || url.hostname
  const { sandboxId, port } = parseSandboxSubdomain(host)
  const accept = c.req.header('Accept')

  try {
    const targetUrl = await buildTargetUrl(sandboxId, port, url.pathname, url.search)
    const resp = await proxyRequest(c.req.raw, targetUrl, {})

    if (resp.status >= 502 && accept?.includes('text/html')) {
      // @ts-expect-error - Hono types for status code are strict
      return c.html(getErrorHtml(), resp.status)
    }

    return resp
  } catch {
    if (accept?.includes('text/html')) {
      return c.html(getErrorHtml(), 502)
    }
    return c.text('Upstream unavailable', 502)
  }
})

function getErrorHtml() {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="3">
  <title>Preview Unavailable</title>
  <style>
    :root {
      --background: 255 255 255;
      --foreground: 15 23 42;
      --card: 255 255 255;
      --card-foreground: 15 23 42;
      --primary: 15 23 42;
      --primary-foreground: 248 250 252;
      --muted-foreground: 100 116 139;
      --border: 226 232 240;
      --radius: 0.5rem;
    }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      height: 100vh;
      margin: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background-color: rgb(var(--background));
      color: rgb(var(--foreground));
    }
    .container {
      text-align: center;
      padding: 2rem;
      max-width: 24rem;
      border-radius: var(--radius);
      border: 1px solid rgb(var(--border));
      background-color: rgb(var(--card));
      box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
    }
    h1 {
      font-size: 1.125rem;
      font-weight: 600;
      margin: 0 0 0.5rem 0;
      letter-spacing: -0.025em;
    }
    p {
      font-size: 0.875rem;
      color: rgb(var(--muted-foreground));
      margin: 0 0 1.5rem 0;
      line-height: 1.5;
    }
    button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: calc(var(--radius) - 2px);
      font-size: 0.875rem;
      font-weight: 500;
      height: 2.25rem;
      padding: 0 1rem;
      background-color: rgb(var(--primary));
      color: rgb(var(--primary-foreground));
      border: none;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    button:hover {
      opacity: 0.9;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Preview Unavailable</h1>
    <p>The sandbox server is not responding yet. It may still be starting up.</p>
    <button onclick="window.location.reload()">Reload Preview</button>
  </div>
</body>
</html>
  `
}

export default preview
