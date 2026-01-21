export interface Database {
  user: UserTable
  session: SessionTable
  account: AccountTable
  verification: VerificationTable
  apikey: ApiKeyTable
  billing: BillingTable
  subscription: SubscriptionTable
  payment: PaymentTable
  usage: UsageTable
  provider: ProviderTable
  model: ModelTable
  ip: IpTable
  ip_rate_limit: IpRateLimitTable
  project: ProjectTable
  chats: ChatsTable
  github_installations: GitHubInstallationsTable
  deployment_history: DeploymentHistoryTable
}

export interface UserTable {
  id: string
  name: string
  email: string
  emailVerified: boolean
  image: string | null
  createdAt?: Date
  updatedAt?: Date
}

export interface SessionTable {
  id: string
  userId: string
  token: string
  expiresAt: Date
  ipAddress: string | null
  userAgent: string | null
  createdAt?: Date
  updatedAt: Date
}

export interface AccountTable {
  id: string
  userId: string
  accountId: string
  providerId: string
  accessToken: string | null
  refreshToken: string | null
  accessTokenExpiresAt: Date | null
  refreshTokenExpiresAt: Date | null
  scope: string | null
  idToken: string | null
  password: string | null
  createdAt?: Date
  updatedAt?: Date
}

export interface VerificationTable {
  id: string
  identifier: string
  value: string
  expiresAt: Date
  createdAt?: Date
  updatedAt?: Date
}

export interface ApiKeyTable {
  id: string
  name: string | null
  start: string | null
  prefix: string | null
  key: string
  userId: string
  projectId: string | null
  refillInterval: number | null
  refillAmount: number | null
  lastRefillAt: Date | null
  enabled: boolean
  rateLimitEnabled: boolean
  rateLimitTimeWindow: number | null
  rateLimitMax: number | null
  requestCount: number
  remaining: number | null
  lastRequest: Date | null
  expiresAt: Date | null
  createdAt: Date
  updatedAt: Date
  permissions: string | null
  metadata: any | null
}

export interface BillingTable {
  id: string
  projectId: string
  customerId: string | null
  paymentMethodId: string | null
  paymentMethodType: string | null
  paymentMethodLast4: string | null
  balance: string
  monthlyLimit: number | null
  monthlyUsage: string | null
  timeMonthlyUsageUpdated: Date | null
  reload: boolean | null
  reloadTrigger: number | null
  reloadAmount: number | null
  reloadError: string | null
  timeReloadError: Date | null
  timeReloadLockedTill: Date | null
  subscription: any | null
  subscriptionId: string | null
  subscriptionPlan: string | null
  timeSubscriptionBooked: Date | null
  createdAt?: Date
  updatedAt?: Date
  deletedAt: Date | null
}

export interface SubscriptionTable {
  id: string
  projectId: string
  userId: string
  rollingUsage: string | null
  fixedUsage: string | null
  timeRollingUpdated: Date | null
  timeFixedUpdated: Date | null
  createdAt?: Date
  updatedAt?: Date
  deletedAt: Date | null
}

export interface PaymentTable {
  id: string
  projectId: string
  customerId: string | null
  invoiceId: string | null
  paymentId: string | null
  amount: string
  timeRefunded: Date | null
  enrichment: any | null
  createdAt?: Date
  updatedAt?: Date
  deletedAt: Date | null
}

export interface UsageTable {
  id: string
  projectId: string
  model: string
  provider: string
  inputTokens: number
  outputTokens: number
  reasoningTokens: number | null
  cacheReadTokens: number | null
  cacheWrite5mTokens: number | null
  cacheWrite1hTokens: number | null
  cost: string
  keyId: string | null
  enrichment: any | null
  createdAt?: Date
  updatedAt?: Date
  deletedAt: Date | null
}

export interface ProviderTable {
  id: string
  projectId: string
  provider: string
  credentials: string
  createdAt?: Date
  updatedAt?: Date
  deletedAt: Date | null
}

export interface ModelTable {
  id: string
  projectId: string
  model: string
  createdAt?: Date
  updatedAt?: Date
  deletedAt: Date | null
}

export interface IpTable {
  ip: string
  usage: number | null
  createdAt?: Date
  updatedAt?: Date
  deletedAt: Date | null
}

export interface IpRateLimitTable {
  ip: string
  interval: string
  count: number
}

export interface ProjectTable {
  id: string | null
  userId: string
  name: string
  github: any | null
  settings: any | null
  deployment: any | null
  sandbox: any | null
  metadata: any | null
  createdAt?: Date
  updatedAt?: Date
}

export interface ChatsTable {
  id: string | null
  projectId: string
  agentSessionId: string | null
  title: string | null
  metadata: any | null
  stats: any | null
  createdAt?: Date
  updatedAt?: Date
}

export interface GitHubInstallationsTable {
  id: string | null
  userId: string
  installationId: number
  accountLogin: string
  accountType: string
  userAccessToken: string | null
  userAccessTokenExpiresAt: Date | null
  userRefreshToken: string | null
  userRefreshTokenExpiresAt: Date | null
  createdAt?: Date
  updatedAt?: Date
}

export interface DeploymentHistoryTable {
  id: string | null
  projectId: string
  name: string
  previewUrl: string
  status: string
  error: string | null
  startedAt: Date
  deployedAt: Date | null
  createdAt?: Date
}
