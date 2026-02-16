import { Hono } from 'hono'
import type { AppContext } from '@/types/application'
import { requireAuth } from '../middleware/auth'
import { storage } from '@/lib/storage'

const MAX_FILE_SIZE = 30 * 1024 * 1024 // 30MB

const upload = new Hono<AppContext>()

upload.get('/*', async (c) => {
  if (!storage.isConfigured) {
    return c.json({ error: 'Storage not configured' }, 503)
  }

  const key = c.req.param('*')
  if (!key || key.includes('..')) {
    return c.json({ error: 'Invalid key' }, 400)
  }

  const file = await storage.download(key)
  if (!file) {
    return c.json({ error: 'File not found' }, 404)
  }

  return new Response(file.body, {
    headers: {
      'Content-Type': file.contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
})

upload.post('/', requireAuth, async (c) => {
  if (!storage.isConfigured) {
    return c.json({ error: 'Storage not configured' }, 503)
  }

  const user = c.get('user')!
  const body = await c.req.parseBody()
  const file = body.file

  if (!file || typeof file === 'string') {
    return c.json({ error: 'No file provided' }, 400)
  }

  if (file.size > MAX_FILE_SIZE) {
    return c.json({ error: 'File too large' }, 413)
  }

  const key = storage.generateKey(user.id, file.name)
  const buffer = Buffer.from(await file.arrayBuffer())

  await storage.upload(key, buffer, file.type)

  c.var.logger.info({ key, size: file.size, type: file.type }, 'file uploaded')

  const url = storage.getPublicUrl(key) || (await storage.getSignedUrl(key))

  return c.json({ url, key, filename: file.name, contentType: file.type, size: file.size })
})

export default upload
