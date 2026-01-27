import ky from 'ky'

export const http = ky.create({
  prefixUrl: process.env.NEXT_PUBLIC_BACKEND_URL,
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  retry: {
    limit: 3,
    methods: ['get', 'post'],
    statusCodes: [502, 503, 504],
  },
  timeout: 30000,
  hooks: {
    beforeError: [
      async (error) => {
        const { response } = error
        if (response?.body) {
          const body = (await response.json().catch(() => null)) as { error?: string } | null
          if (body?.error) {
            error.message = body.error
          }
        }
        return error
      },
    ],
  },
})

export const backendBaseUrl = process.env.NEXT_PUBLIC_BACKEND_URL

export const payHttp = ky.create({
  prefixUrl: process.env.NEXT_PUBLIC_PAY_URL,
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
})
