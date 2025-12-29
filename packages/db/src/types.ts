export interface Database {
  user: UserTable
  session: SessionTable
  account: AccountTable
  verification: VerificationTable
  project: ProjectTable
  chats: ChatsTable
  merchants: MerchantsTable
  products: ProductsTable
  product_prices: ProductPricesTable
  orders: OrdersTable
  whop_transfers: WhopTransfersTable
  whop_webhook_events: WhopWebhookEventsTable
  github_installations: GitHubInstallationsTable
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

export interface MerchantsTable {
  id: string
  email: string | null
  name: string
  whopCompanyId: string | null
  metadata: any | null
  createdAt?: Date
  updatedAt?: Date
}

export interface ProductsTable {
  id: string | null
  merchantId: string
  title: string
  slug: string
  projectId: string
  description: string | null
  status: string
  metadata: any | null
  createdAt?: Date
  updatedAt?: Date
}

export interface ProductPricesTable {
  id: string | null
  productId: string
  code: string
  amount: number
  currency: string
  active: boolean
  metadata: any | null
  createdAt?: Date
  updatedAt?: Date
}

export interface OrdersTable {
  id: string | null
  merchantId: string
  customerId: string
  productId: string
  priceId: string
  amount: number
  currency: string
  status: string
  whopPaymentId: string | null
  whopPaymentStatus: string | null
  metadata: any | null
  createdAt?: Date
  updatedAt?: Date
}

export interface WhopTransfersTable {
  id: string | null
  orderId: string
  whopTransferId: string | null
  idempotencyKey: string
  originWhopCompanyId: string
  destinationWhopCompanyId: string
  amount: number
  currency: string
  status: string
  raw: any | null
  createdAt?: Date
  updatedAt?: Date
}

export interface WhopWebhookEventsTable {
  id: string | null
  webhookId: string
  type: string
  whopCompanyId: string | null
  payload: any
  receivedAt?: Date
  processedAt: Date | null
  status: string
  attempts: number
  error: string | null
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
