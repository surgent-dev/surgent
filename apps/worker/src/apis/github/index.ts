export { GitHubService } from './GitHubService'
export { GitHubApp, createGitHubApp } from './GitHubApp'
export * from './types'

import { db } from '@/lib/db'
import { createGitHubApp } from './GitHubApp'

/** Get valid GitHub token for user, auto-refreshing if expired */
export async function getValidUserToken(userId: string): Promise<string | null> {
  const row = await db
    .selectFrom('github_oauth_tokens')
    .selectAll()
    .where('userId', '=', userId)
    .executeTakeFirst()

  if (!row?.accessToken) return null

  const now = Date.now()
  const isExpired = row.accessTokenExpiresAt && new Date(row.accessTokenExpiresAt).getTime() <= now
  if (!isExpired) return row.accessToken

  if (!row.refreshToken) return null
  const refreshExpired =
    row.refreshTokenExpiresAt && new Date(row.refreshTokenExpiresAt).getTime() <= now
  if (refreshExpired) return null

  const app = createGitHubApp()
  if (!app) return null

  try {
    const { token, expiresAt, refreshToken, refreshTokenExpiresAt } =
      await app.refreshUserAccessToken(row.refreshToken)

    await db
      .updateTable('github_oauth_tokens')
      .set({
        accessToken: token,
        accessTokenExpiresAt: expiresAt ? new Date(expiresAt) : null,
        refreshToken,
        refreshTokenExpiresAt: refreshTokenExpiresAt ? new Date(refreshTokenExpiresAt) : null,
        updatedAt: new Date(),
      })
      .where('id', '=', row.id)
      .execute()

    console.log('[github] Token refreshed for user', userId)
    return token
  } catch (err) {
    console.error('[github] Token refresh failed', err)
    return null
  }
}
