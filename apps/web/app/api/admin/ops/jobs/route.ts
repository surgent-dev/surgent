import { serverBackendUrl } from '@/lib/server-backend'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const backendUrl = new URL('/api/admin/ops/jobs', `${serverBackendUrl}/`)
  backendUrl.search = url.searchParams.toString()

  const headers = new Headers()
  const cookie = req.headers.get('cookie')
  if (cookie) headers.set('cookie', cookie)

  return fetch(backendUrl, {
    headers,
    cache: 'no-store',
  })
}
