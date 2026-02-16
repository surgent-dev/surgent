import type { Generated } from 'kysely'

export interface Database {
  user: UserTable
  session: SessionTable
  account: AccountTable
  verification: VerificationTable
  oauthClient: OAuthClientTable
  oauthAccessToken: OAuthAccessTokenTable
  oauthRefreshToken: OAuthRefreshTokenTable
  oauthConsent: OAuthConsentTable
  jwks: JwksTable
  organization: OrganizationTable
  member: MemberTable
  organizationRole: OrganizationRoleTable
  team: TeamTable
  teamMember: TeamMemberTable
  invitation: InvitationTable
  apikey: ApiKeyTable
  usage: UsageTable
  provider: ProviderTable
  model: ModelTable
  ip: IpTable
  ip_rate_limit: IpRateLimitTable
  project: ProjectTable
  worker: WorkerTable
  sandbox: SandboxTable
  integration: IntegrationTable
  env_var: EnvVarTable
  deployment: DeploymentTable
  listing: ListingTable
  chats: ChatsTable
  github_installations: GitHubInstallationsTable
  github_oauth_tokens: GitHubOAuthTokensTable
  product: ProductTable
  product_price: ProductPriceTable
  pay_account: PayAccountTable
  pay_checkout_session: PayCheckoutSessionTable
  pay_webhook_event: PayWebhookEventTable
  pay_payment: PayPaymentTable
  pay_subscription: PaySubscriptionTable
  pay_invoice: PayInvoiceTable
  pay_refund: PayRefundTable
  pay_dispute: PayDisputeTable
  pay_transaction: PayTransactionTable
  pay_customer: PayCustomerTable
}

export interface UserTable {
  id: string
  name: string
  email: string
  emailVerified: boolean
  image: string | null
  role: string | null
  banned: boolean | null
  banReason: string | null
  banExpires: Date | null
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
  activeOrganizationId: string | null
  activeTeamId: string | null
  impersonatedBy: string | null
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

export interface OAuthClientTable {
  id: string
  clientId: string
  clientSecret: string | null
  disabled: boolean | null
  skipConsent: boolean | null
  enableEndSession: boolean | null
  scopes: string[] | null
  userId: string | null
  referenceId: string | null
  projectId: string | null
  name: string | null
  uri: string | null
  icon: string | null
  contacts: string[] | null
  tos: string | null
  policy: string | null
  softwareId: string | null
  softwareVersion: string | null
  softwareStatement: string | null
  redirectUris: string[]
  postLogoutRedirectUris: string[] | null
  tokenEndpointAuthMethod: string | null
  grantTypes: string[] | null
  responseTypes: string[] | null
  public: boolean | null
  type: string | null
  metadata: Record<string, unknown> | null
  createdAt?: Date
  updatedAt?: Date
}

export interface OAuthRefreshTokenTable {
  id: string
  token: string
  clientId: string
  sessionId: string | null
  userId: string
  referenceId: string | null
  scopes: string[]
  revoked: Date | null
  createdAt?: Date
  expiresAt: Date
}

export interface OAuthAccessTokenTable {
  id: string
  token: string
  clientId: string
  sessionId: string | null
  userId: string | null
  referenceId: string | null
  refreshId: string | null
  scopes: string[]
  createdAt?: Date
  expiresAt: Date
}

export interface OAuthConsentTable {
  id: string
  clientId: string
  userId: string | null
  referenceId: string | null
  scopes: string[]
  createdAt?: Date
  updatedAt?: Date
}

export interface JwksTable {
  id: string
  publicKey: string
  privateKey: string
  createdAt: Date
  expiresAt: Date | null
}

export interface OrganizationTable {
  id: string
  name: string
  slug: string
  logo: string | null
  metadata: any | null
  createdBy: string | null
  platformFeePercent: number | null
  platformFeeFixed: number | null
  createdAt?: Date
  updatedAt?: Date
}

export interface MemberTable {
  id: string
  userId: string
  organizationId: string
  role: string
  createdAt?: Date
}

export interface InvitationTable {
  id: string
  email: string
  inviterId: string
  organizationId: string
  teamId: string | null
  role: string
  status: string
  createdAt?: Date
  expiresAt: Date
}

export interface OrganizationRoleTable {
  id: string
  organizationId: string
  role: string
  permission: string
  createdAt?: Date
  updatedAt?: Date
}

export interface TeamTable {
  id: string
  name: string
  organizationId: string
  createdAt?: Date
  updatedAt?: Date
}

export interface TeamMemberTable {
  id: string
  teamId: string
  userId: string
  createdAt?: Date
}

export interface ApiKeyTable {
  id: Generated<string>
  name: string | null
  start: string | null
  prefix: string | null
  key: string
  userId: string
  projectId: string | null
  organizationId: string | null
  refillInterval: number | null
  refillAmount: number | null
  lastRefillAt: Date | null
  enabled: boolean
  rateLimitEnabled: Generated<boolean>
  rateLimitTimeWindow: number | null
  rateLimitMax: number | null
  requestCount: Generated<number>
  remaining: number | null
  lastRequest: Date | null
  expiresAt: Date | null
  createdAt: Date
  updatedAt: Date
  permissions: string | null
  metadata: any | null
  env: string
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

export interface ProjectMetadata {
  workingDirectory: string
  processName?: string
  startCommand?: string
  provisioningStep?: string
}

export type ProjectStatus = 'provisioning' | 'ready' | 'failed'

export interface ProjectTable {
  id?: string
  userId: string
  organizationId: string
  name: string
  slug: string
  status: ProjectStatus
  failReason: string | null
  github: any | null
  settings: any | null
  deployment: any | null
  sandbox: any | null
  metadata: ProjectMetadata | null
  isPublic?: boolean
  createdAt?: Date
  updatedAt?: Date
  deletedAt?: Date | null
}

export interface WorkerTable {
  id: string | null
  projectId: string
  accountId: string
  scriptName: string
  dispatchNamespace: string | null
  hostname: string | null
  status: string | null
  createdAt?: Date
  updatedAt?: Date
}

export interface SandboxTable {
  id: string
  projectId: string
  provider: string
  status: string
  host: string | null
  createdAt?: Date
  updatedAt?: Date
}

export interface IntegrationTable {
  id: string | null
  projectId: string
  provider: string
  config: any | null
  status: string
  createdAt?: Date
}

export type EnvDestination = 'server' | 'client' | 'both'

export interface EnvVarTable {
  id: string | null
  projectId: string
  environment: string
  key: string
  value: string | null
  destination: EnvDestination | null
  integrationId: string | null
  createdAt?: Date
  updatedAt?: Date
}

export interface DeploymentTable {
  id: string | null
  projectId: string
  scriptName: string
  status: string
  error: string | null
  startedAt: Date | null
  finishedAt: Date | null
  cloudflareDeploymentId: string | null
  cloudflareVersionId: string | null
  rollbackOf: string | null
  hostname: string | null
  createdAt?: Date
}

export interface ListingTable {
  id: string | null
  projectId: string
  title: string
  description: string
  imageUrl: string | null
  status: string
  createdAt?: Date
  updatedAt?: Date
}

export interface ChatsTable {
  id: string
  projectId: string
  agentSessionId: string | null
  title: string | null
  metadata: any | null
  stats: any | null
  createdAt?: Date
  updatedAt?: Date
}

export interface GitHubInstallationsTable {
  id?: string
  userId: string
  installationId: number
  accountLogin: string
  accountType: string
  userAccessToken?: string | null
  userAccessTokenExpiresAt?: Date | null
  userRefreshToken?: string | null
  userRefreshTokenExpiresAt?: Date | null
  createdAt?: Date
  updatedAt?: Date
}

export interface GitHubOAuthTokensTable {
  id?: string
  userId: string
  accessToken: string | null
  accessTokenExpiresAt: Date | null
  refreshToken: string | null
  refreshTokenExpiresAt: Date | null
  createdAt?: Date
  updatedAt?: Date
}

export interface ProductTable {
  id: string | null
  productGroup: string
  name: string
  description: string | null
  projectId: string
  slug: string
  version: number | null
  isArchived: boolean | null
  isDefault: boolean | null
  processor: string
  processorProductId: string | null
  isAddOn: boolean | null
  planGroup: string | null
  env: string
  createdAt?: Date
  updatedAt?: Date
}

export interface ProductPriceTable {
  id: string | null
  productId: string
  name: string | null
  description: string | null
  priceAmount: number
  priceCurrency: string
  recurringInterval: string | null
  isDefault: boolean | null
  processor: string
  processorPriceId: string | null
  slug: string | null
  createdAt?: Date
  updatedAt?: Date
}

export interface PayAccountTable {
  id: string | null
  projectId: string
  userId: string
  whopCompanyId: string
  title: string
  status: string
  metadata: Record<string, unknown>
  env: string
  createdAt?: Date
  updatedAt?: Date
}

export interface PayCheckoutSessionTable {
  id: string | null
  projectId: string
  userId: string | null
  accountId: string | null
  whopCompanyId: string
  whopCheckoutId: string | null
  purchaseUrl: string | null
  mode: string
  planType: string
  status: string
  amount: string | number | null
  currency: string
  metadata: Record<string, unknown>
  env: string
  createdAt?: Date
  updatedAt?: Date
  idempotencyKey: string | null
  completedAt: Date | null
}

export interface PayWebhookEventTable {
  id: string
  eventType: string
  payload: Record<string, unknown>
  status: string
  error: string | null
  env: string
  receivedAt?: Date
  handledAt: Date | null
}

export interface PayPaymentTable {
  id: string | null
  projectId: string | null
  customerId: string | null
  checkoutId: string | null
  whopPaymentId: string
  whopCompanyId: string | null
  whopUserId: string | null
  amount: string | number
  currency: string
  status: string
  customerEmail: string | null
  customerName: string | null
  paidAt: Date | null
  billingReason: string | null
  paymentMethodType: string | null
  cardBrand: string | null
  cardLast4: string | null
  failureMessage: string | null
  metadata: Record<string, unknown>
  raw: Record<string, unknown>
  env: string
  createdAt?: Date
  updatedAt?: Date
}

export interface PaySubscriptionTable {
  id: string | null
  projectId: string | null
  customerId: string | null
  checkoutId: string | null
  whopMembershipId: string
  whopPlanId: string | null
  whopProductId: string | null
  whopUserId: string | null
  status: string
  cancelAtPeriodEnd: boolean
  currentPeriodStart: Date | null
  currentPeriodEnd: Date | null
  canceledAt: Date | null
  metadata: Record<string, unknown>
  raw: Record<string, unknown>
  env: string
  createdAt?: Date
  updatedAt?: Date
}

export interface PayInvoiceTable {
  id: string | null
  projectId: string | null
  checkoutId: string | null
  subscriptionId: string | null
  whopInvoiceId: string
  status: string
  amount: string | number
  currency: string
  hostedUrl: string | null
  dueAt: Date | null
  paidAt: Date | null
  voidedAt: Date | null
  metadata: Record<string, unknown>
  raw: Record<string, unknown>
  env: string
  createdAt?: Date
  updatedAt?: Date
}

export interface PayRefundTable {
  id: string | null
  projectId: string | null
  paymentId: string | null
  whopRefundId: string
  status: string
  amount: string | number
  currency: string
  reason: string | null
  metadata: Record<string, unknown>
  raw: Record<string, unknown>
  env: string
  createdAt?: Date
  updatedAt?: Date
}

export interface PayDisputeTable {
  id: string | null
  projectId: string | null
  paymentId: string | null
  whopDisputeId: string
  status: string
  amount: string | number
  currency: string
  reason: string | null
  resolvedAt: Date | null
  metadata: Record<string, unknown>
  raw: Record<string, unknown>
  env: string
  createdAt?: Date
  updatedAt?: Date
}

export interface PayTransactionTable {
  id: string | null
  projectId: string | null
  accountId: string | null
  checkoutId: string | null
  paymentId: string | null
  subscriptionId: string | null
  invoiceId: string | null
  kind: string
  processor: string
  direction: string
  processorFeeType: string | null
  paymentTransactionId: string | null
  incurredByTransactionId: string | null
  payoutTransactionId: string | null
  sourceId: string | null
  status: string | null
  amount: string | number
  currency: string
  happenedAt: Date | null
  metadata: Record<string, unknown>
  raw: Record<string, unknown>
  env: string
  createdAt?: Date
  updatedAt?: Date
}

export interface PayCustomerTable {
  id: string | null
  projectId: string
  externalId: string | null
  email: string | null
  name: string | null
  metadata: Record<string, unknown>
  env: string
  createdAt?: Date
  updatedAt?: Date
}
