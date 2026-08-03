import { describe, expect, test } from 'bun:test'

process.env.DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:1/surgent_test'
process.env.BETTER_AUTH_SECRET = 'test-secret-that-is-at-least-thirty-two-characters'
process.env.BETTER_AUTH_URL = 'http://localhost:4000/api/auth'
process.env.GOOGLE_CLIENT_ID = 'test-google-client'
process.env.GOOGLE_CLIENT_SECRET = 'test-google-secret'

const { auth } = await import('../auth')

describe('sign-in-only auth', () => {
  test('keeps sign-in enabled while disabling account creation for email and Google', () => {
    expect(auth.options.emailAndPassword?.enabled).toBe(true)
    expect(auth.options.emailAndPassword?.disableSignUp).toBe(true)
    expect(auth.options.socialProviders?.google?.enabled).toBe(true)
    expect(auth.options.socialProviders?.google?.disableSignUp).toBe(true)
  })

  test('rejects direct email signup requests before touching the database', async () => {
    const response = await auth.handler(
      new Request('http://localhost:4000/api/auth/sign-up/email', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'http://localhost:3000',
        },
        body: JSON.stringify({
          name: 'New User',
          email: 'new@example.com',
          password: 'password123',
        }),
      }),
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      code: 'EMAIL_PASSWORD_SIGN_UP_DISABLED',
      message: 'Email and password sign up is not enabled',
    })
  })
})
