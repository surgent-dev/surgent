import { SurpayAdmin, Surpay } from 'surpay'
import { config } from '@/lib/config'
import { db } from '@/lib/db'

export class SurpayService {
  private static admin = new SurpayAdmin({
    masterKey: config.surpay.masterKey,
    baseUrl: config.surpay.baseUrl,
  })

  private static slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]+/g, '')
      .replace(/\-\-+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '')
  }

  /**
   * Gets the Surpay API key for a user, creating an organization if it doesn't exist.
   */
  static async getOrCreateOrgKey(userId: string): Promise<string | null> {
    const existing = await db
      .selectFrom('surpay_organizations')
      .select(['apiKey'])
      .where('userId', '=', userId)
      .executeTakeFirst()

    if (existing) return existing.apiKey

    // Create new organization on Surpay
    const user = await db
      .selectFrom('user')
      .select(['name', 'email'])
      .where('id', '=', userId)
      .executeTakeFirstOrThrow()

    const username = user.name || user.email.split('@')[0]
    const { data, error } = await this.admin.organization.create({
      name: user.name || user.email,
      slug: `${this.slugify(username)}-${userId.slice(0, 8)}`,
    })

    if (error) {
      if (error.statusCode === 409) {
        const existing = await db
          .selectFrom('surpay_organizations')
          .select(['apiKey'])
          .where('userId', '=', userId)
          .executeTakeFirst()
        if (existing) return existing.apiKey
      }
      console.error('FAILED TO CREATE SURPAY ORGANIZATION:', error.statusCode, error.message)
      return null
    }

    await db
      .insertInto('surpay_organizations')
      .values({
        userId,
        surpayOrgId: data.id,
        apiKey: data.api_key,
      })
      .onConflict((oc) => oc.column('userId').doNothing())
      .execute()

    // Re-fetch in case of race (another request won)
    const inserted = await db
      .selectFrom('surpay_organizations')
      .select(['apiKey'])
      .where('userId', '=', userId)
      .executeTakeFirstOrThrow()

    return inserted.apiKey
  }

  /**
   * Creates a Surpay project for a Surgent project
   */
  static async createProject(userId: string, projectId: string, name: string) {
    const apiKey = await this.getOrCreateOrgKey(userId)
    if (!apiKey) return

    const surpay = new Surpay({
      apiKey,
      baseUrl: config.surpay.baseUrl,
    })

    const { data, error } = await surpay.projects.create({
      name,
      slug: `${this.slugify(name)}-${projectId.slice(0, 8)}`,
    })

    if (error) {
      if (error.statusCode === 409) {
        const { data: projects } = await surpay.projects.list()
        const slug = `${this.slugify(name)}-${projectId.slice(0, 8)}`
        const existing = projects?.find((p: any) => p.slug === slug)
        if (existing) {
          await db.updateTable('project').set({ surpayProjectId: existing.id }).where('id', '=', projectId).execute()
        }
        return
      }
      console.error('FAILED TO CREATE SURPAY PROJECT:', error.statusCode, error.message)
      return
    }

    if (data) {
      await db.updateTable('project').set({ surpayProjectId: data.id }).where('id', '=', projectId).execute()
    }
  }
}
