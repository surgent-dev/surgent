/**
 * GitHub App Authentication using official @octokit/auth-app
 */

import { createAppAuth } from '@octokit/auth-app'
import { refreshToken } from '@octokit/oauth-methods'
import { Octokit } from '@octokit/rest'
import { createPrivateKey } from 'node:crypto'
import { config } from '@/lib/config'

const log = (msg: string, data?: unknown) => console.log(`[GitHubApp] ${msg}`, data ?? '')

/**
 * Convert PKCS#1 key to PKCS#8 format (GitHub generates PKCS#1, but octokit needs PKCS#8)
 */
function ensurePkcs8(privateKey: string): string {
  if (privateKey.includes('BEGIN PRIVATE KEY')) return privateKey
  if (privateKey.includes('BEGIN RSA PRIVATE KEY')) {
    return createPrivateKey(privateKey).export({ type: 'pkcs8', format: 'pem' }) as string
  }
  return privateKey
}

interface AppConfig {
  appId: string
  privateKey: string
  appSlug: string
  stateSecret: string
  clientId?: string
  clientSecret?: string
}

interface StatePayload {
  userId: string
  projectId: string
  exp: number
}

export class GitHubApp {
  private config: AppConfig
  private appAuth: ReturnType<typeof createAppAuth>

  constructor(config: AppConfig) {
    this.config = config
    this.appAuth = createAppAuth({
      appId: config.appId,
      privateKey: ensurePkcs8(config.privateKey),
      clientId: config.clientId,
      clientSecret: config.clientSecret,
    })
  }

  /**
   * Get an Octokit instance authenticated as the App (for app-level API calls)
   */
  async getAppOctokit(): Promise<Octokit> {
    const auth = await this.appAuth({ type: 'app' })
    return new Octokit({ auth: auth.token })
  }

  /**
   * Get an installation access token
   */
  async getInstallationToken(
    installationId: number,
  ): Promise<{ token: string; expiresAt: string }> {
    const auth = await this.appAuth({
      type: 'installation',
      installationId,
    })
    return {
      token: auth.token,
      expiresAt: auth.expiresAt || new Date(Date.now() + 3600000).toISOString(),
    }
  }

  /**
   * Get an Octokit instance authenticated as an installation
   */
  async getInstallationOctokit(installationId: number): Promise<Octokit> {
    const { token } = await this.getInstallationToken(installationId)
    return new Octokit({ auth: token })
  }

  /**
   * Build the GitHub App installation URL with signed state
   */
  async buildInstallUrl(userId: string, projectId: string): Promise<string> {
    const state = await this.createState(userId, projectId)
    return `https://github.com/apps/${this.config.appSlug}/installations/new?state=${state}`
  }

  /**
   * Create a signed state parameter (HMAC-SHA256)
   */
  async createState(userId: string, projectId: string): Promise<string> {
    const payload: StatePayload = {
      userId,
      projectId,
      exp: Math.floor(Date.now() / 1000) + 600, // 10 min expiry
    }

    const data = JSON.stringify(payload)
    const signature = await this.hmacSign(data)
    return Buffer.from(`${data}.${signature}`).toString('base64url')
  }

  /**
   * Verify and decode a state parameter
   */
  async verifyState(state: string): Promise<StatePayload | null> {
    try {
      const decoded = Buffer.from(state, 'base64url').toString()
      const dotIndex = decoded.lastIndexOf('.')
      if (dotIndex === -1) return null

      const data = decoded.slice(0, dotIndex)
      const signature = decoded.slice(dotIndex + 1)

      if (!data || !signature) return null

      const expectedSignature = await this.hmacSign(data)
      if (signature !== expectedSignature) {
        log('State signature mismatch')
        return null
      }

      const payload = JSON.parse(data) as StatePayload

      if (payload.exp < Math.floor(Date.now() / 1000)) {
        log('State expired')
        return null
      }

      return payload
    } catch (err) {
      log('Failed to verify state', err)
      return null
    }
  }

  /**
   * HMAC-SHA256 signature using Web Crypto API
   */
  private async hmacSign(data: string): Promise<string> {
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(this.config.stateSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data))
    return Buffer.from(signature).toString('base64url')
  }

  /**
   * Get installation details from GitHub
   */
  async getInstallation(installationId: number) {
    const octokit = await this.getAppOctokit()
    const { data } = await octokit.rest.apps.getInstallation({ installation_id: installationId })
    const account = data.account as { login: string; type: string }
    return { id: data.id, account: { login: account.login, type: account.type } }
  }

  /**
   * List repositories accessible to an installation
   */
  async listInstallationRepos(installationId: number) {
    const octokit = await this.getInstallationOctokit(installationId)
    const { data } = await octokit.rest.apps.listReposAccessibleToInstallation({ per_page: 100 })
    return data.repositories.map((repo) => ({
      id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      private: repo.private,
      default_branch: repo.default_branch,
    }))
  }

  /**
   * Exchange OAuth code for a GitHub App user access token
   */
  async exchangeUserAccessToken(code: string, redirectUrl: string, state?: string) {
    if (!this.config.clientId || !this.config.clientSecret) {
      throw new Error('GitHub App OAuth not configured')
    }
    return this.appAuth({
      type: 'oauth-user',
      code,
      redirectUrl,
      state,
    })
  }

  /**
   * Refresh an expired user access token using a refresh token
   */
  async refreshUserAccessToken(token: string) {
    if (!this.config.clientId || !this.config.clientSecret) {
      throw new Error('GitHub App OAuth not configured')
    }

    const { data } = await refreshToken({
      clientType: 'github-app',
      clientId: this.config.clientId,
      clientSecret: this.config.clientSecret,
      refreshToken: token,
    })

    return {
      token: data.access_token,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000).toISOString()
        : null,
      refreshToken: data.refresh_token,
      refreshTokenExpiresAt: data.refresh_token_expires_in
        ? new Date(Date.now() + data.refresh_token_expires_in * 1000).toISOString()
        : null,
    }
  }
}

export function createGitHubApp(): GitHubApp | null {
  const cfg = config.github

  if (!cfg.appId || !cfg.appPrivateKey || !cfg.appSlug || !cfg.stateSecret) {
    log('GitHub App not configured - missing environment variables')
    return null
  }

  return new GitHubApp({
    appId: cfg.appId,
    privateKey: cfg.appPrivateKey,
    appSlug: cfg.appSlug,
    stateSecret: cfg.stateSecret,
    clientId: cfg.clientId,
    clientSecret: cfg.clientSecret,
  })
}
