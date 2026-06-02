import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { config } from './config'

const RETRY_ATTEMPTS = 3
const RETRY_DELAY_MS = 1000

const isConfigured =
  config.uploads.accessKeyId &&
  config.uploads.secretAccessKey &&
  config.uploads.bucket &&
  config.uploads.endpoint

const client = isConfigured
  ? new S3Client({
      credentials: {
        accessKeyId: config.uploads.accessKeyId!,
        secretAccessKey: config.uploads.secretAccessKey!,
      },
      region: config.uploads.region || 'auto',
      endpoint: config.uploads.endpoint,
      forcePathStyle: true,
    })
  : null

const bucket = config.uploads.bucket!

async function withRetry<T>(operation: () => Promise<T>, attempts = RETRY_ATTEMPTS): Promise<T> {
  let lastError: Error | undefined
  for (let i = 0; i < attempts; i++) {
    try {
      return await operation()
    } catch (err: any) {
      lastError = err
      const isRetryable =
        err.name === 'SlowDown' ||
        err.$metadata?.httpStatusCode === 503 ||
        err.$metadata?.httpStatusCode === 500 ||
        err.code === 'ECONNRESET'
      if (!isRetryable || i === attempts - 1) throw err
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (i + 1)))
    }
  }
  throw lastError
}

export const storage = {
  isConfigured,

  async upload(key: string, body: Buffer | Uint8Array, contentType: string): Promise<void> {
    if (!client) throw new Error('Storage not configured')
    await withRetry(() =>
      client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      ),
    )
  },

  async download(key: string): Promise<{ body: ReadableStream; contentType: string } | null> {
    if (!client) throw new Error('Storage not configured')
    try {
      const res = await withRetry(() =>
        client.send(new GetObjectCommand({ Bucket: bucket, Key: key })),
      )
      if (!res.Body) return null
      return {
        body: res.Body as ReadableStream,
        contentType: res.ContentType || 'application/octet-stream',
      }
    } catch (err: any) {
      if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
        return null
      }
      throw err
    }
  },

  async exists(key: string): Promise<boolean> {
    if (!client) throw new Error('Storage not configured')
    try {
      await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
      return true
    } catch (err: any) {
      if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
        return false
      }
      throw err
    }
  },

  async delete(key: string): Promise<void> {
    if (!client) throw new Error('Storage not configured')
    await withRetry(() => client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })))
  },

  async getSignedUrl(key: string, expiresIn = 86400): Promise<string> {
    if (!client) throw new Error('Storage not configured')
    return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn })
  },

  getPublicUrl(key: string): string | null {
    const base = config.uploads.publicUrl
    if (!base) return null
    return `${base.replace(/\/$/, '')}/${key}`
  },

  generateKey(filename: string): string {
    const extension = filename.match(/\.[a-zA-Z0-9]{1,12}$/)?.[0].toLowerCase() ?? ''
    return `uploads/${crypto.randomUUID()}${extension}`
  },
}
