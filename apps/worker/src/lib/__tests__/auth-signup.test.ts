import { describe, expect, test } from 'bun:test'

process.env.DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:1/surgent_test'
process.env.BETTER_AUTH_SECRET = 'test-secret-that-is-at-least-thirty-two-characters'
process.env.BETTER_AUTH_URL = 'http://localhost:4000/api/auth'
process.env.GOOGLE_CLIENT_ID = 'test-google-client'
process.env.GOOGLE_CLIENT_SECRET = 'test-google-secret'

const { auth } = await import('../auth')

describe('public signup', () => {
  test('enables account creation with email and Google', () => {
    expect(auth.options.emailAndPassword?.enabled).toBe(true)
    expect(auth.options.emailAndPassword?.disableSignUp).toBe(false)
    expect(auth.options.emailVerification?.sendOnSignUp).toBe(true)
    expect(auth.options.socialProviders?.google?.enabled).toBe(true)
    expect(auth.options.socialProviders?.google?.disableSignUp).toBe(false)
  })
})
