const env = process.env
const csv = (value: string | undefined): string[] =>
  (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
const csvLower = (value: string | undefined): string[] =>
  csv(value).map((item) => item.toLowerCase())

// Centralized environment variables as a single config object
export const config = {
  env,
  server: {
    port: env.PORT || '4000',
    host: env.HOST || 'localhost',
    clientOrigin: env.CLIENT_ORIGIN || 'http://localhost:3000',
    trustedOrigins: (env.TRUSTED_ORIGINS || env.CLIENT_ORIGIN || 'http://localhost:3000').split(
      ',',
    ),
  },
  database: {
    url: env.DATABASE_URL,
    type: env.POSTGRES_TYPE,
  },
  auth: {
    secret: env.BETTER_AUTH_SECRET,
    baseUrl: env.BETTER_AUTH_URL,
    googleClientId: env.GOOGLE_CLIENT_ID,
    googleClientSecret: env.GOOGLE_CLIENT_SECRET,
    adminUserEmails: csvLower(env.BETTER_AUTH_ADMIN_EMAILS || env.ADMIN_EMAILS),
    adminUserIds: csv(env.BETTER_AUTH_ADMIN_USER_IDS || env.ADMIN_USER_IDS),
    adminRoles: csv(env.BETTER_AUTH_ADMIN_ROLES || 'admin'),
  },
  sandbox: {
    provider: (env.SANDBOX_PROVIDER || 'e2b') as 'e2b' | 'daytona',
    defaultPort: '3000',
    previewDomain: env.SANDBOX_PREVIEW_DOMAIN || 'e2b.app',
  },
  e2b: {
    apiKey: env.E2B_API_KEY,
    template: env.E2B_TEMPLATE || 'surgent-v1-0-0',
  },
  daytona: {
    apiKey: env.DAYTONA_API_KEY,
    apiUrl: env.DAYTONA_API_URL,
    serverUrl: env.DAYTONA_SERVER_URL,
    snapshot: env.DAYTONA_SNAPSHOT,
    defaultPort: env.DAYTONA_DEFAULT_PORT || '3000',
  },
  uploads: {
    publicUrl: env.UPLOADS_PUBLIC_URL,
    accessKeyId: env.S3_ACCESS_KEY_ID || env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY || env.AWS_SECRET_ACCESS_KEY,
    region: env.S3_REGION || env.AWS_REGION,
    endpoint: env.S3_ENDPOINT || env.AWS_ENDPOINT,
    bucket: env.S3_BUCKET || env.AWS_BUCKET,
    sessionToken: env.S3_SESSION_TOKEN || env.AWS_SESSION_TOKEN,
  },
  github: {
    appId: env.GITHUB_APP_ID,
    appPrivateKey: env.GITHUB_APP_PRIVATE_KEY,
    appSlug: env.GITHUB_APP_SLUG,
    stateSecret: env.GITHUB_STATE_SECRET,
    clientId: env.GITHUB_CLIENT_ID,
    clientSecret: env.GITHUB_CLIENT_SECRET,
    webhookSecret: env.GITHUB_WEBHOOK_SECRET,
  },
  cloudflare: {
    accountId: env.CLOUDFLARE_ACCOUNT_ID,
    apiToken: env.CLOUDFLARE_API_TOKEN,
    dispatchNamespace: env.DISPATCH_NAMESPACE_NAME,
    deployUrl: env.CLOUDFLARE_DEPLOY_URL,
    deployDomain: env.DEPLOY_DOMAIN || 'surgent.site',
    zoneId: env.CLOUDFLARE_ZONE_ID,
    kvNamespaceId: env.CLOUDFLARE_DOMAIN_KV_NAMESPACE_ID,
  },
  convex: {
    host: env.CONVEX_HOST || 'https://api.convex.dev',
    teamId: env.CONVEX_TEAM_ID,
    teamToken: env.CONVEX_TEAM_TOKEN,
  },
  llms: {
    openaiKey: env.OPENAI_API_KEY,
    heliconeKey: env.HELICONE_API_KEY,
    googleKey: env.GOOGLE_GENERATIVE_AI_API_KEY || env.GOOGLE_API_KEY,
  },
  vercel: {
    apiKey: env.VERCEL_API_KEY,
  },
  surgent: {
    baseUrl: env.SURGENT_BASE_URL,
  },
  whop: {
    test: {
      apiKey: env.WHOP_TEST_API_KEY,
      platformCompanyId: env.WHOP_TEST_PLATFORM_COMPANY_ID,
      webhookSecret: env.WHOP_TEST_WEBHOOK_SECRET,
      baseUrl: 'https://sandbox-api.whop.com/api/v1',
    },
    live: {
      apiKey: env.WHOP_LIVE_API_KEY,
      platformCompanyId: env.WHOP_LIVE_PLATFORM_COMPANY_ID,
      webhookSecret: env.WHOP_LIVE_WEBHOOK_SECRET,
      baseUrl: 'https://api.whop.com/api/v1',
    },
    redirectBaseUrl: env.WHOP_REDIRECT_BASE_URL,
  },
  autumn: {
    secretKey: env.AUTUMN_SECRET_KEY,
  },
  domainProvider: (env.DOMAIN_PROVIDER || 'entri') as 'entri' | 'namecheap',
  namecheap: {
    apiUser: env.NAMECHEAP_API_USER || '',
    apiKey: env.NAMECHEAP_API_KEY || '',
    userName: env.NAMECHEAP_USERNAME || '',
    clientIp: env.NAMECHEAP_CLIENT_IP || '',
    sandbox: env.NAMECHEAP_SANDBOX !== 'false',
  },
  entri: {
    applicationId: env.ENTRI_APP_ID,
    secret: env.ENTRI_SECRET,
    apiKey: env.ENTRI_API_KEY,
    webhookSecret: env.ENTRI_WEBHOOK_SECRET,
    devMode: env.ENTRI_DEV_MODE === 'true',
  },
  opencode: {
    url: env.OPENCODE_URL || 'http://127.0.0.1:4096',
    baseUrl: env.OPENCODE_BASE_URL,
    configRepoUrl:
      env.OPENCODE_CONFIG_REPO_URL || 'https://github.com/surgent-dev/opencode-config.git',
    configDir: env.OPENCODE_CONFIG_DIR || '/home/user/opencode-config',
  },
} as const

/**
 * Validate that required domain-related env vars are present.
 * Call at startup to surface config issues early.
 */
export function validateDomainConfig(): string[] {
  const warnings: string[] = []

  if (config.domainProvider === 'entri' && !config.entri.devMode) {
    if (!config.entri.applicationId) warnings.push('ENTRI_APP_ID is required for Entri integration')
    if (!config.entri.secret) warnings.push('ENTRI_SECRET is required for Entri JWT generation')
    if (!config.entri.apiKey)
      warnings.push('ENTRI_API_KEY is required for domain availability checks')
    if (!config.entri.webhookSecret)
      warnings.push('ENTRI_WEBHOOK_SECRET is required for webhook signature verification')
  }

  if (env.NODE_ENV === 'production' && !config.entri.webhookSecret) {
    warnings.push('ENTRI_WEBHOOK_SECRET is not set — webhook signatures will not be verified')
  }

  return warnings
}
