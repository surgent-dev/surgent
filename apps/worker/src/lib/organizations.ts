import { db } from '@/lib/db'
import { ensureBillingState } from '@/lib/billing'

export async function ensureActiveOrganization(userId: string): Promise<string> {
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
