import { Hono } from 'hono'
import type { AppContext } from '@/types/application'
import { requireAuth } from '../middleware/auth'

const upload = new Hono<AppContext>()

// GET /api/upload/* - Serve file from R2 (for local dev)
upload.get('/*', async (c) => {
  const key = c.req.path.replace('/api/upload/', '')
  if (!key) return c.json({ error: 'No key provided' }, 400)

  const object = await c.env.UPLOADS.get(key)
  if (!object) return c.json({ error: 'File not found' }, 404)

  return new Response(object.body, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000',
    },
  })
})

// POST /api/upload - Upload file to R2
upload.post('/', requireAuth, async (c) => {
  const user = c.get('user')!
  const formData = await c.req.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return c.json({ error: 'No file provided' }, 400)
  }

  console.log('[upload.post] start', {
    origin: new URL(c.req.url).origin,
    userId: user.id,
    filename: file.name,
    contentType: file.type,
    size: file.size,
  })

  // Generate unique key: userId/timestamp-random-filename
  const timestamp = Date.now()
  const random = Math.random().toString(36).slice(2, 8)
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
  const key = `${user.id}/${timestamp}-${random}-${safeName}`

  console.log('[upload.post] key', { key })

  // Upload to R2
  await c.env.UPLOADS.put(key, file.stream(), {
    httpMetadata: {
      contentType: file.type,
    },
  })

  const head = await c.env.UPLOADS.head(key)
  console.log('[upload.post] stored', {
    key,
    head: head ? { size: head.size, httpEtag: head.httpEtag } : null,
    uploadsPublicUrl: c.env.UPLOADS_PUBLIC_URL,
  })

  // Local dev: serve through worker; production: use public R2 URL
  const publicUrl = c.env.DEV
    ? `http://localhost:4000/api/upload/${key}`
    : `${c.env.UPLOADS_PUBLIC_URL.replace(/\/$/, '')}/${key}`

  return c.json({
    url: publicUrl,
    key,
    filename: file.name,
    contentType: file.type,
    size: file.size,
  })
})

export default upload



