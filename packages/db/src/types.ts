export interface Database {
  user: UserTable
  session: SessionTable
  account: AccountTable
  verification: VerificationTable
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
  chats: ChatsTable
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
  activeOrganizationId: string | null
  activeTeamId: string | null
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

export interface OrganizationTable {
  id: string
  name: string
  slug: string
  logo: string | null
  metadata: any | null
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
  id: string
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
  organizationId: string
  name: string
  github: any | null
  settings: any | null
  deployment: any | null
  sandbox: any | null
  metadata: any | null
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

export interface EnvVarTable {
  id: string | null
  projectId: string
  environment: string
  key: string
  value: string | null
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
