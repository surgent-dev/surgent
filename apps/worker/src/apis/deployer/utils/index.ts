import { extname } from 'path'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { hash: blake3hash }: { hash(input: string): Buffer } = require('blake3-wasm')

/**
 * Calculate the 32-character content hash Cloudflare expects for static assets.
 */
export function calculateFileHash(content: ArrayBuffer | Buffer, filePath: string = ''): string {
  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content)
  const base64Contents = buffer.toString('base64')
  const extension = extname(filePath).slice(1)
  return blake3hash(base64Contents + extension)
    .toString('hex')
    .slice(0, 32)
}

/**
 * Determine MIME type based on file extension
 * Critical for proper asset serving in browsers
 */
export function getMimeType(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || ''

  const mimeTypes: Record<string, string> = {
    // HTML
    html: 'text/html',
    htm: 'text/html',

    // Styles
    css: 'text/css',

    // JavaScript
    js: 'application/javascript',
    mjs: 'application/javascript',
    jsx: 'application/javascript',
    ts: 'application/typescript',
    tsx: 'application/typescript',

    // Data
    json: 'application/json',
    xml: 'application/xml',
    txt: 'text/plain',
    csv: 'text/csv',

    // Images
    svg: 'image/svg+xml',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    ico: 'image/x-icon',
    webp: 'image/webp',
    avif: 'image/avif',

    // Fonts
    woff: 'font/woff',
    woff2: 'font/woff2',
    ttf: 'font/ttf',
    otf: 'font/otf',
    eot: 'application/vnd.ms-fontobject',

    // Documents
    pdf: 'application/pdf',

    // Media
    webm: 'video/webm',
    mp4: 'video/mp4',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
  }

  return mimeTypes[ext] || 'application/octet-stream'
}

/**
 * Validate required configuration fields
 */
export function validateConfig(config: any): void {
  if (!config.name) {
    throw new Error('Worker name is required in configuration')
  }

  if (!config.compatibility_date) {
    throw new Error('Compatibility date is required in configuration')
  }
}

/**
 * Build worker bindings from Wrangler configuration
 * DRY implementation to avoid code duplication
 */
export function buildWorkerBindings(config: any, hasAssets: boolean = false): any[] {
  const bindings: any[] = []

  // Add asset binding if assets are present
  if (hasAssets) {
    bindings.push({
      name: config.assets?.binding || 'ASSETS',
      type: 'assets',
    })
  }

  // Add KV namespace bindings
  if (config.kv_namespaces) {
    for (const kv of config.kv_namespaces) {
      bindings.push({
        name: kv.binding,
        type: 'kv_namespace',
        namespace_id: kv.id,
      })
    }
  }

  // Add D1 database bindings
  if (config.d1_databases) {
    for (const d1 of config.d1_databases) {
      bindings.push({
        name: d1.binding,
        type: 'd1',
        database_id: d1.database_id,
      })
    }
  }

  // Add R2 bucket bindings
  if (config.r2_buckets) {
    for (const r2 of config.r2_buckets) {
      bindings.push({
        name: r2.binding,
        type: 'r2_bucket',
        bucket_name: r2.bucket_name,
      })
    }
  }

  return bindings
}
