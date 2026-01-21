import { betterAuth } from 'better-auth'
import { autumn } from 'autumn-js/better-auth'
import { apiKey, organization } from 'better-auth/plugins'
import { createAccessControl } from 'better-auth/plugins/access'
import { db, dialect } from '@/lib/db'
import { config } from './config'

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

  if (personalMembership?.organizationId) return personalMembership.organizationId

  const membership = await db
    .selectFrom('member')
    .select('organizationId')
    .where('userId', '=', userId)
    .executeTakeFirst()

  if (membership?.organizationId) return membership.organizationId

  const user = await db.selectFrom('user').select('name').where('id', '=', userId).executeTakeFirst()

  const organizationId = userId
  const now = new Date()
  const slug = `personal-${userId}`
  const name = user?.name || 'Personal'

  await db.transaction().execute(async (tx) => {
    await tx
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

    await tx
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
  })

  return organizationId
}

export const auth = betterAuth({
  secret: config.auth.secret,
  baseURL: config.auth.baseUrl,
  trustedOrigins: config.server.trustedOrigins,

  plugins: [
    autumn(),
    organization({
      ac,
      teams: { enabled: true },
      dynamicAccessControl: { enabled: true },
    }),
    apiKey({
      rateLimit: { enabled: false },
      enableSessionForAPIKeys: true,
      apiKeyHeaders: ['x-api-key', 'authorization'],
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
    crossSubDomainCookies: { enabled: true },
  },
})
