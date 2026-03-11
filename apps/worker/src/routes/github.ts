import { Hono } from 'hono'
import { Webhooks } from '@octokit/webhooks'
import { db } from '@/lib/db'
import type { AppContext } from '@/types/application'
import { createGitHubApp } from '@/apis/github'
import { config } from '@/lib/config'

const github = new Hono<AppContext>()

/**
 * GitHub OAuth callback - handles app installation and token exchange
 */
github.get('/callback', async (c) => {
  const installationIdStr = c.req.query('installation_id')
  const state = c.req.query('state')
  const code = c.req.query('code')

  const githubApp = createGitHubApp()
  if (!githubApp) {
    return c.text('GitHub App not configured', 500)
  }

  const payload = state ? await githubApp.verifyState(state) : null
  if (state && !payload) {
    return c.text('Invalid or expired state', 400)
  }

  try {
    let userId = payload?.userId
    const projectId = payload?.projectId
    const installationId = installationIdStr ? parseInt(installationIdStr, 10) : null

    // Lookup userId from existing installation if not in state
    if (installationId && !userId) {
      const existing = await db
        .selectFrom('github_installations')
        .select('userId')
        .where('installationId', '=', installationId)
        .executeTakeFirst()
      userId = existing?.userId
    }

    if (!userId) {
      return c.text('Missing installation_id or state', 400)
    }

    // Exchange code for OAuth token
    const redirectBase = config.auth.baseUrl || new URL(c.req.url).origin
    const redirectUrl = new URL('/api/github/callback', redirectBase).toString()
    const oauthResult = code
      ? await githubApp.exchangeUserAccessToken(code, redirectUrl, state ?? undefined)
      : null

    // Save installation without depending on a composite unique index.
    if (installationId) {
      const { account } = await githubApp.getInstallation(installationId)
      const existingByInstallation = await db
        .selectFrom('github_installations')
        .select('id')
        .where('installationId', '=', installationId)
        .executeTakeFirst()
      const existingByAccount = existingByInstallation
        ? null
        : await db
            .selectFrom('github_installations')
            .select('id')
            .where('userId', '=', userId)
            .where('accountLogin', '=', account.login)
            .executeTakeFirst()
      const existing = existingByInstallation || existingByAccount

      if (existing?.id) {
        await db
          .updateTable('github_installations')
          .set({
            userId,
            installationId,
            accountLogin: account.login,
            accountType: account.type,
            updatedAt: new Date(),
          })
          .where('id', '=', existing.id)
          .execute()
      }

      if (!existing?.id) {
        await db
          .insertInto('github_installations')
          .values({
            userId,
            installationId,
            accountLogin: account.login,
            accountType: account.type,
          })
          .execute()
      }

      c.var.logger.info({ installationId, account: account.login }, 'installation saved')
    }

    // Save OAuth token (upsert by userId)
    if (oauthResult) {
      const auth = oauthResult as {
        token: string
        expiresAt?: string
        refreshToken?: string
        refreshTokenExpiresAt?: string
      }

      await db
        .insertInto('github_oauth_tokens')
        .values({
          userId,
          accessToken: auth.token,
          accessTokenExpiresAt: auth.expiresAt ? new Date(auth.expiresAt) : null,
          refreshToken: auth.refreshToken ?? null,
          refreshTokenExpiresAt: auth.refreshTokenExpiresAt
            ? new Date(auth.refreshTokenExpiresAt)
            : null,
        })
        .onConflict((oc) =>
          oc.column('userId').doUpdateSet({
            accessToken: auth.token,
            accessTokenExpiresAt: auth.expiresAt ? new Date(auth.expiresAt) : null,
            refreshToken: auth.refreshToken ?? null,
            refreshTokenExpiresAt: auth.refreshTokenExpiresAt
              ? new Date(auth.refreshTokenExpiresAt)
              : null,
            updatedAt: new Date(),
          }),
        )
        .execute()

      c.var.logger.info({ userId }, 'OAuth token saved')
    }

    // Redirect back to app
    const redirect = projectId
      ? `${config.server.clientOrigin}/project/${projectId}?github=installed`
      : `${config.server.clientOrigin}/dashboard?github=installed`

    return c.redirect(redirect)
  } catch (err) {
    c.var.logger.error({ err }, 'callback failed')
    return c.text('Failed to process installation', 500)
  }
})

/**
 * GitHub webhook handler
 */
github.post('/webhook', async (c) => {
  const secret = config.github.webhookSecret
  if (!secret) {
    return c.text('Webhook not configured', 500)
  }

  const signature = c.req.header('X-Hub-Signature-256')
  const event = c.req.header('X-GitHub-Event')
  if (!signature || !event) {
    return c.text('Missing signature or event header', 400)
  }

  const body = await c.req.text()
  const webhooks = new Webhooks({ secret })
  if (!(await webhooks.verify(body, signature))) {
    return c.text('Invalid signature', 401)
  }

  const payload = JSON.parse(body)
  c.var.logger.info({ event, action: payload.action }, 'webhook received')

  try {
    if (event === 'installation' && payload.action === 'deleted') {
      const installationId = payload.installation.id
      await db
        .deleteFrom('github_installations')
        .where('installationId', '=', installationId)
        .execute()
      c.var.logger.info({ installationId }, 'installation deleted')
    }

    return c.text('OK')
  } catch (err) {
    c.var.logger.error({ event, err }, 'webhook handler failed')
    return c.text('Handler failed', 500)
  }
})

export default github
