/**
 * GitHub App Authentication using official @octokit/auth-app
 */

import { createAppAuth } from '@octokit/auth-app'
import { Octokit } from '@octokit/rest'
import { createPrivateKey } from 'node:crypto'

const log = (msg: string, data?: unknown) => console.log(`[GitHubApp] ${msg}`, data ?? '')

/**
 * Convert PKCS#1 key to PKCS#8 format (GitHub generates PKCS#1, but octokit needs PKCS#8)
 */
function ensurePkcs8(privateKey: string): string {
  // Already PKCS#8
  if (privateKey.includes('BEGIN PRIVATE KEY')) {
    return privateKey
  }

  // Convert PKCS#1 to PKCS#8 using Node's crypto
  if (privateKey.includes('BEGIN RSA PRIVATE KEY')) {
    const keyObject = createPrivateKey(privateKey)
    return keyObject.export({ type: 'pkcs8', format: 'pem' }) as string
  }

  // Unknown format, return as-is and let it fail with a clear error
  return privateKey
}

interface GitHubAppConfig {
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

interface InstallationAccount {
  login: string
  type: string
}

interface InstallationResponse {
  id: number
  account: InstallationAccount
}

export class GitHubApp {
  private config: GitHubAppConfig
  private appAuth: ReturnType<typeof createAppAuth>

  constructor(config: GitHubAppConfig) {
    this.config = config
    // Convert PKCS#1 to PKCS#8 if needed (GitHub generates PKCS#1 by default)
    const privateKey = ensurePkcs8(config.privateKey)
    this.appAuth = createAppAuth({
      appId: config.appId,
      privateKey,
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
  async getInstallationToken(installationId: number): Promise<{ token: string; expiresAt: string }> {
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
    return `https://github.com/apps/${this.config.appSlug}/installations/new?state=${encodeURIComponent(state)}`
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
      ['sign']
    )
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data))
    return Buffer.from(signature).toString('base64url')
  }

  /**
   * Get installation details from GitHub
   */
  async getInstallation(installationId: number): Promise<InstallationResponse> {
    const octokit = await this.getAppOctokit()
    const { data } = await octokit.rest.apps.getInstallation({ installation_id: installationId })
    return {
      id: data.id,
      account: {
        login: (data.account as { login: string }).login,
        type: (data.account as { type: string }).type,
      },
    }
  }

  /**
   * List repositories accessible to an installation
   */
  async listInstallationRepos(installationId: number): Promise<Array<{
    id: number
    name: string
    full_name: string
    private: boolean
    default_branch: string
  }>> {
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
}

/**
 * Create a GitHubApp instance from environment variables
 */
export function createGitHubApp(env: any): GitHubApp | null {
  const {
    GITHUB_APP_ID,
    GITHUB_APP_PRIVATE_KEY,
    GITHUB_APP_SLUG,
    GITHUB_STATE_SECRET,
    GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET,
  } = env

  if (!GITHUB_APP_ID || !GITHUB_APP_PRIVATE_KEY || !GITHUB_APP_SLUG || !GITHUB_STATE_SECRET) {
    log('GitHub App not configured - missing environment variables')
    return null
  }
  return new GitHubApp({
    appId: GITHUB_APP_ID,
    privateKey: GITHUB_APP_PRIVATE_KEY,
    appSlug: GITHUB_APP_SLUG,
    stateSecret: GITHUB_STATE_SECRET,
    clientId: GITHUB_CLIENT_ID,
    clientSecret: GITHUB_CLIENT_SECRET,
  })
}
