import ky, { type BeforeErrorHook, type BeforeRequestHook } from 'ky'
import { usePayEnv } from '@/stores/pay-env'

const extractErrorMessage: BeforeErrorHook = async (error) => {
  const { response } = error
  if (response?.body) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    if (body?.error) error.message = body.error
  }
  return error
}

const injectPayEnv: BeforeRequestHook = (request) => {
  request.headers.set('x-pay-env', usePayEnv.getState().env)
}

export const http = ky.create({
  prefixUrl: process.env.NEXT_PUBLIC_BACKEND_URL,
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  retry: { limit: 3, methods: ['get', 'post'], statusCodes: [502, 503, 504] },
  timeout: 30000,
  hooks: { beforeError: [extractErrorMessage] },
})

export const backendBaseUrl = process.env.NEXT_PUBLIC_BACKEND_URL

export const payHttp = ky.create({
  prefixUrl: process.env.NEXT_PUBLIC_PAY_URL,
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  retry: { limit: 3, methods: ['get'], statusCodes: [502, 503, 504] },
  timeout: 30000,
  hooks: { beforeRequest: [injectPayEnv], beforeError: [extractErrorMessage] },
})

export const payHttpLive = ky.create({
  prefixUrl: process.env.NEXT_PUBLIC_PAY_URL,
  credentials: 'include',
  headers: { 'Content-Type': 'application/json', 'x-pay-env': 'live' },
  retry: { limit: 3, methods: ['get'], statusCodes: [502, 503, 504] },
  timeout: 30000,
  hooks: { beforeError: [extractErrorMessage] },
})
