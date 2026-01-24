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
   * Gets the Surpay API key for an organization, creating one if it doesn't exist.
   */
  static async getOrCreateOrgKey(organizationId: string): Promise<string | null> {
    const existing = await db
      .selectFrom('organization')
      .select(['apiKey', 'name', 'slug'])
      .where('id', '=', organizationId)
      .executeTakeFirst()

    if (existing?.apiKey) return existing.apiKey

    // Create new organization on Surpay using existing org name and slug
    const org =
      existing ||
      (await db
        .selectFrom('organization')
        .select(['name', 'slug'])
        .where('id', '=', organizationId)
        .executeTakeFirstOrThrow())

    const { data, error } = await this.admin.organization.create({
      name: org.name,
      slug: org.slug,
    })

    if (error) {
      if (error.statusCode === 409) {
        const existing = await db
          .selectFrom('organization')
          .select(['apiKey'])
          .where('id', '=', organizationId)
          .executeTakeFirst()
        if (existing) return existing.apiKey
      }
      console.error('FAILED TO CREATE SURPAY ORGANIZATION:', error.statusCode, error.message)
      return null
    }

    // Update the organization record with the api key (organization.id IS the surpay org ID)
    await db
      .updateTable('organization')
      .set({
        apiKey: data.api_key,
        apiKeyPrefix: data.api_key.slice(0, 8),
        updatedAt: new Date(),
      })
      .where('id', '=', organizationId)
      .execute()

    // Re-fetch in case of race (another request won)
    const inserted = await db
      .selectFrom('organization')
      .select(['apiKey'])
      .where('id', '=', organizationId)
      .executeTakeFirstOrThrow()

    return inserted.apiKey
  }

  /**
   * Creates a Surpay project for a Surgent project
   */
  static async createProject(organizationId: string, projectId: string, name: string) {
    const apiKey = await this.getOrCreateOrgKey(organizationId)
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
