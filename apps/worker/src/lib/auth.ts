import { betterAuth } from 'better-auth'
import { admin, apiKey, jwt, organization } from 'better-auth/plugins'
import { oauthProvider } from '@better-auth/oauth-provider'
import { createAccessControl } from 'better-auth/plugins/access'
import { db, dialect } from '@/lib/db'
import { config } from './config'
import { ensureBillingState } from './billing'

const ac = createAccessControl({
  organization: ['update', 'delete'],
  member: ['create', 'update', 'delete'],
  invitation: ['create', 'cancel'],
  team: ['create', 'update', 'delete'],
} as const)

async function ensureActiveOrganization(userId: string): Promise<string> {
  const personalMembership = await db
    .selectFrom('member')
    .select('organizationId')
    .where('userId', '=', userId)
    .where('organizationId', '=', userId)
    .executeTakeFirst()

  if (personalMembership?.organizationId) {
    await ensureBillingState(personalMembership.organizationId)
    return personalMembership.organizationId
  }

  const membership = await db
    .selectFrom('member')
    .select('organizationId')
    .where('userId', '=', userId)
    .executeTakeFirst()

  if (membership?.organizationId) {
    await ensureBillingState(membership.organizationId)
    return membership.organizationId
  }

  const user = await db
    .selectFrom('user')
    .select('name')
    .where('id', '=', userId)
    .executeTakeFirst()

  const organizationId = userId
  const now = new Date()
  const slug = `personal-${userId}`
  const name = user?.name || 'Personal'

  const existingOrg = await db
    .selectFrom('organization')
    .select('id')
    .where((eb) => eb.or([eb('id', '=', organizationId), eb('slug', '=', slug)]))
    .executeTakeFirst()

  if (existingOrg) {
    await ensureBillingState(existingOrg.id)
    return existingOrg.id
  }

  await db
    .insertInto('organization')
    .values({
      id: organizationId,
      name,
      slug,
      createdAt: now,
      updatedAt: now,
    })
    .onConflict((oc) => oc.column('id').doNothing())
    .execute()

  await db
    .insertInto('member')
    .values({
      id: crypto.randomUUID(),
      userId,
      organizationId,
      role: 'owner',
      createdAt: now,
    })
    .onConflict((oc) => oc.columns(['userId', 'organizationId']).doNothing())
    .execute()

  await ensureBillingState(organizationId)
  return organizationId
}

export const auth = betterAuth({
  secret: config.auth.secret,
  baseURL: config.auth.baseUrl,
  trustedOrigins: config.server.trustedOrigins,

  plugins: [
    organization({
      ac,
      teams: { enabled: true },
      dynamicAccessControl: { enabled: true },
      organizationHooks: {
        afterCreateOrganization: async ({ organization }) => {
          await ensureBillingState(organization.id)
        },
      },
    }),
    admin({
      adminUserIds: config.auth.adminUserIds,
      adminRoles: config.auth.adminRoles,
    }),
    apiKey({
      rateLimit: { enabled: false },
      enableSessionForAPIKeys: true,
      customAPIKeyGetter: (ctx) => {
        const xApiKey = ctx.headers?.get('x-api-key')
        if (xApiKey) return xApiKey
        const authHeader = ctx.headers?.get('authorization')
        if (authHeader) return authHeader.replace(/^Bearer\s+/i, '')
        return null
      },
    }),
    jwt({
      jwt: {
        issuer: config.auth.baseUrl,
      },
      jwks: {
        jwksPath: '/.well-known/jwks.json',
        keyPairConfig: { alg: 'RS256', modulusLength: 2048 },
      },
      disableSettingJwtHeader: true,
    }),
    oauthProvider({
      loginPage: new URL('/login', config.server.clientOrigin).toString(),
      consentPage: new URL('/oauth/consent', config.server.clientOrigin).toString(),
      scopes: ['openid', 'profile', 'email', 'offline_access'],
      grantTypes: ['authorization_code', 'refresh_token'],
      idTokenExpiresIn: 60 * 60,
      refreshTokenExpiresIn: 60 * 60 * 24 * 180,
      clientReference: ({ session }) => session?.activeOrganizationId as string | undefined,
      schema: {
        oauthClient: {
          fields: {
            projectId: {
              type: 'string',
              required: false,
              references: {
                model: 'project',
                field: 'id',
              },
            },
          } as Record<string, unknown>,
        },
      },
      silenceWarnings: {
        oauthAuthServerConfig: true,
      },
    }),
  ],

  database: {
    dialect,
    type: 'postgres',
  },

  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },

  socialProviders: {
    google: {
      clientId: config.auth.googleClientId!,
      clientSecret: config.auth.googleClientSecret!,
      enabled: true,
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    storeSessionInDatabase: true,
  },

  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          if (session.activeOrganizationId) return { data: session }
          const organizationId = await ensureActiveOrganization(session.userId)
          return { data: { ...session, activeOrganizationId: organizationId } }
        },
      },
    },
  },

  advanced: {
    database: { generateId: 'uuid' },
    crossSubDomainCookies: {
      enabled: config.env.NODE_ENV === 'production',
      domain: '.surgent.dev',
    },
  },
})
