const env = process.env
const csv = (value: string | undefined): string[] =>
  (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

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
  surpay: {
    baseUrl: env.SURPAY_BASE_URL,
  },
  autumn: {
    secretKey: env.AUTUMN_SECRET_KEY,
  },
  opencode: {
    url: env.OPENCODE_URL || 'http://127.0.0.1:4096',
    baseUrl: env.OPENCODE_BASE_URL,
    configRepoUrl:
      env.OPENCODE_CONFIG_REPO_URL || 'https://github.com/surgent-dev/opencode-config.git',
    configDir: env.OPENCODE_CONFIG_DIR || '/home/user/opencode-config',
  },
} as const
