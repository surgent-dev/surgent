import { Hono } from 'hono'
import type { AppContext } from '@/types/application'

const dispatch = new Hono<AppContext>()

/** Known platform domain suffixes — everything else is a custom domain. */
const PLATFORM_SUFFIXES = ['.surgent.site', '.surgent.dev']

function extractSubdomain(hostname: string): string | null {
  const parts = hostname.split('.')
  return parts.length >= 2 ? parts[0] || null : null
}

function isPlatformHostname(hostname: string): boolean {
  return PLATFORM_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
}

dispatch.all('/*', async (c) => {
  const url = new URL(c.req.url)
  const hostname = url.hostname

  if (!c.env.dispatcher) {
    return c.text('Dispatcher binding is not configured', 500)
  }

  let scriptName: string | null = null

  if (isPlatformHostname(hostname)) {
    // *.surgent.site — use subdomain as the script name (existing behavior)
    scriptName = extractSubdomain(hostname)
  } else {
    // Custom domain — look up the script name from KV
    if (c.env.DOMAIN_MAP) {
      scriptName = await c.env.DOMAIN_MAP.get(hostname)
    }
  }

  if (!scriptName) {
    return c.text('Not found', 404)
  }

  try {
    const worker = c.env.dispatcher.get(scriptName)
    const targetRequest = new Request(url.toString(), c.req.raw)
    return await worker.fetch(targetRequest)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return c.text(`Dispatch failed: ${message}`, 502)
  }
})

export default dispatch
