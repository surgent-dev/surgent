const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL

export async function GET(req: Request) {
  const url = new URL(req.url)
  const backendUrl = new URL('/api/admin/ops/jobs', BACKEND_URL)
  backendUrl.search = url.searchParams.toString()

  const headers = new Headers()
  const cookie = req.headers.get('cookie')
  if (cookie) headers.set('cookie', cookie)

  return fetch(backendUrl, {
    headers,
    cache: 'no-store',
  })
}
