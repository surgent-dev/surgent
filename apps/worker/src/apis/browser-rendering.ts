import { config } from '@/lib/config'

const CF_SCREENSHOT_URL = `https://api.cloudflare.com/client/v4/accounts/${config.cloudflare.accountId}/browser-rendering/screenshot`
const SCREENSHOT_TIMEOUT_MS = 30_000

export class ScreenshotError extends Error {
  status: number
  permanent: boolean

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ScreenshotError'
    this.status = status
    this.permanent = status === 401 || status === 403
  }
}

interface ScreenshotOptions {
  url: string
  width?: number
  height?: number
  deviceScaleFactor?: number
  quality?: number
}

/**
 * Capture a screenshot of a URL via Cloudflare Browser Rendering API.
 * Returns the raw JPEG buffer.
 */
export async function captureScreenshot({
  url,
  width = 1536,
  height = 864,
  deviceScaleFactor = 2,
  quality = 90,
}: ScreenshotOptions): Promise<Buffer> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), SCREENSHOT_TIMEOUT_MS)

  try {
    const res = await fetch(CF_SCREENSHOT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.cloudflare.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        viewport: { width, height, deviceScaleFactor },
        screenshotOptions: { type: 'jpeg', quality },
        gotoOptions: { waitUntil: 'networkidle0', timeout: SCREENSHOT_TIMEOUT_MS },
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new ScreenshotError(
        `Screenshot failed (${res.status})${body ? `: ${body.slice(0, 200)}` : ''}`,
        res.status,
      )
    }

    return Buffer.from(await res.arrayBuffer())
  } finally {
    clearTimeout(timeout)
  }
}
