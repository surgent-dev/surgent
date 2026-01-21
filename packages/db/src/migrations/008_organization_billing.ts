import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('organization')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('slug', 'text', (col) => col.notNull())
    .addColumn('logo', 'text')
    .addColumn('metadata', 'jsonb')
    .addColumn('createdAt', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updatedAt', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute()

  await db.schema.createIndex('organization_slug_uq').on('organization').column('slug').unique().execute()

  await db.schema
    .createTable('member')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('userId', 'text', (col) => col.notNull().references('user.id'))
    .addColumn('organizationId', 'text', (col) => col.notNull().references('organization.id'))
    .addColumn('role', 'text', (col) => col.notNull())
    .addColumn('createdAt', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute()

  await db.schema
    .createIndex('member_user_org_uq')
    .on('member')
    .columns(['userId', 'organizationId'])
    .unique()
    .execute()

  await db.schema
    .createTable('team')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('organizationId', 'text', (col) => col.notNull().references('organization.id'))
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('createdAt', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updatedAt', 'timestamptz')
    .execute()

  await db.schema.createIndex('team_organizationId_idx').on('team').column('organizationId').execute()

  await db.schema
    .createTable('teamMember')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('teamId', 'text', (col) => col.notNull().references('team.id'))
    .addColumn('userId', 'text', (col) => col.notNull().references('user.id'))
    .addColumn('createdAt', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute()

  await db.schema.createIndex('teamMember_teamId_idx').on('teamMember').column('teamId').execute()

  await db.schema
    .createTable('organizationRole')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('organizationId', 'text', (col) => col.notNull().references('organization.id'))
    .addColumn('role', 'text', (col) => col.notNull())
    .addColumn('permission', 'text', (col) => col.notNull())
    .addColumn('createdAt', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updatedAt', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute()

  await db.schema
    .createIndex('organizationRole_organizationId_idx')
    .on('organizationRole')
    .column('organizationId')
    .execute()

  await db.schema
    .createTable('invitation')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('email', 'text', (col) => col.notNull())
    .addColumn('inviterId', 'text', (col) => col.notNull().references('user.id'))
    .addColumn('organizationId', 'text', (col) => col.notNull().references('organization.id'))
    .addColumn('teamId', 'text', (col) => col.references('team.id'))
    .addColumn('role', 'text', (col) => col.notNull())
    .addColumn('status', 'text', (col) => col.notNull())
    .addColumn('createdAt', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('expiresAt', 'timestamptz', (col) => col.notNull())
    .execute()

  await db.schema
    .alterTable('session')
    .addColumn('activeOrganizationId', 'text', (col) => col.references('organization.id'))
    .addColumn('activeTeamId', 'text')
    .execute()

  await db.schema
    .alterTable('project')
    .addColumn('organizationId', 'text', (col) => col.references('organization.id'))
    .execute()

  await db.schema
    .alterTable('apikey')
    .addColumn('organizationId', 'text', (col) => col.references('organization.id'))
    .execute()

  await db.schema
    .alterTable('project')
    .alterColumn('organizationId', (col) => col.setNotNull())
    .execute()

  await db.schema.createIndex('project_organizationId_idx').on('project').column('organizationId').execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex('project_organizationId_idx').execute()

  await db.schema.alterTable('apikey').dropColumn('organizationId').execute()
  await db.schema.alterTable('project').dropColumn('organizationId').execute()

  await db.schema.alterTable('session').dropColumn('activeTeamId').execute()
  await db.schema.alterTable('session').dropColumn('activeOrganizationId').execute()

  await db.schema.dropTable('invitation').execute()
  await db.schema.dropIndex('organizationRole_organizationId_idx').execute()
  await db.schema.dropTable('organizationRole').execute()
  await db.schema.dropIndex('teamMember_teamId_idx').execute()
  await db.schema.dropTable('teamMember').execute()
  await db.schema.dropIndex('team_organizationId_idx').execute()
  await db.schema.dropTable('team').execute()
  await db.schema.dropIndex('member_user_org_uq').execute()
  await db.schema.dropTable('member').execute()
  await db.schema.dropIndex('organization_slug_uq').execute()
  await db.schema.dropTable('organization').execute()
}
