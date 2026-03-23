import { betterAuth } from 'better-auth'
import { admin, apiKey, jwt, organization } from 'better-auth/plugins'
import { oauthProvider } from '@better-auth/oauth-provider'
import { createAccessControl } from 'better-auth/plugins/access'
import { dubAnalytics } from '@dub/better-auth'
import { Dub } from 'dub'
import { dialect } from '@/lib/db'
import { config } from './config'
import { ensureBillingState } from './billing'
import { ensureActiveOrganization } from './organizations'
import { consumeReferralAttribution } from './referrals'
import { createLogger } from './logger'

const dub = new Dub()
const log = createLogger('auth')

const ac = createAccessControl({
  organization: ['update', 'delete'],
  member: ['create', 'update', 'delete'],
  invitation: ['create', 'cancel'],
  team: ['create', 'update', 'delete'],
} as const)

export const auth = betterAuth({
  secret: config.auth.secret,
  baseURL: config.auth.baseUrl,
  trustedOrigins: config.server.trustedOrigins,

  plugins: [
    dubAnalytics({ dubClient: dub }),
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
    user: {
      create: {
        after: async (user, context) => {
          try {
            await consumeReferralAttribution(user.id, context)
          } catch (err) {
            log.error({ err, userId: user.id }, '[AUTH] referral hook failed')
          }
        },
      },
    },
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
