import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  // Create user table
  await db.schema
    .createTable('user')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('email', 'text', (col) => col.notNull())
    .addColumn('emailVerified', 'boolean', (col) => col.notNull())
    .addColumn('image', 'text')
    .addColumn('createdAt', 'timestamptz', (col) => col.notNull())
    .addColumn('updatedAt', 'timestamptz', (col) => col.notNull())
    .execute()

  // Create organization table
  await db.schema
    .createTable('organization')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('slug', 'text', (col) => col.notNull())
    .addColumn('logo', 'text')
    .addColumn('metadata', 'jsonb')
    .addColumn('createdAt', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updatedAt', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute()

  await db.schema
    .createIndex('organization_slug_uq')
    .ifNotExists()
    .on('organization')
    .column('slug')
    .unique()
    .execute()

  // Create member table
  await db.schema
    .createTable('member')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('userId', 'uuid', (col) => col.notNull().references('user.id'))
    .addColumn('organizationId', 'uuid', (col) => col.notNull().references('organization.id'))
    .addColumn('role', 'text', (col) => col.notNull())
    .addColumn('createdAt', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute()

  await db.schema
    .createIndex('member_user_org_uq')
    .ifNotExists()
    .on('member')
    .columns(['userId', 'organizationId'])
    .unique()
    .execute()

  // Create team table
  await db.schema
    .createTable('team')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('organizationId', 'uuid', (col) => col.notNull().references('organization.id'))
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('createdAt', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updatedAt', 'timestamptz')
    .execute()

  await db.schema
    .createIndex('team_organizationId_idx')
    .ifNotExists()
    .on('team')
    .column('organizationId')
    .execute()

  // Create teamMember table
  await db.schema
    .createTable('teamMember')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('teamId', 'uuid', (col) => col.notNull().references('team.id'))
    .addColumn('userId', 'uuid', (col) => col.notNull().references('user.id'))
    .addColumn('createdAt', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute()

  await db.schema
    .createIndex('teamMember_teamId_idx')
    .ifNotExists()
    .on('teamMember')
    .column('teamId')
    .execute()

  // Create organizationRole table
  await db.schema
    .createTable('organizationRole')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('organizationId', 'uuid', (col) => col.notNull().references('organization.id'))
    .addColumn('role', 'text', (col) => col.notNull())
    .addColumn('permission', 'text', (col) => col.notNull())
    .addColumn('createdAt', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updatedAt', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute()

  await db.schema
    .createIndex('organizationRole_organizationId_idx')
    .ifNotExists()
    .on('organizationRole')
    .column('organizationId')
    .execute()

  // Create invitation table
  await db.schema
    .createTable('invitation')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('email', 'text', (col) => col.notNull())
    .addColumn('inviterId', 'uuid', (col) => col.notNull().references('user.id'))
    .addColumn('organizationId', 'uuid', (col) => col.notNull().references('organization.id'))
    .addColumn('teamId', 'uuid', (col) => col.references('team.id'))
    .addColumn('role', 'text', (col) => col.notNull())
    .addColumn('status', 'text', (col) => col.notNull())
    .addColumn('createdAt', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('expiresAt', 'timestamptz', (col) => col.notNull())
    .execute()

  // Create session table
  await db.schema
    .createTable('session')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('userId', 'uuid', (col) => col.notNull().references('user.id'))
    .addColumn('token', 'text', (col) => col.notNull())
    .addColumn('expiresAt', 'timestamptz', (col) => col.notNull())
    .addColumn('ipAddress', 'text')
    .addColumn('userAgent', 'text')
    .addColumn('activeOrganizationId', 'uuid', (col) => col.references('organization.id'))
    .addColumn('activeTeamId', 'uuid', (col) => col.references('team.id'))
    .addColumn('createdAt', 'timestamptz', (col) => col.notNull())
    .addColumn('updatedAt', 'timestamptz', (col) => col.notNull())
    .execute()

  // Create account table
  await db.schema
    .createTable('account')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('userId', 'uuid', (col) => col.notNull().references('user.id'))
    .addColumn('accountId', 'text', (col) => col.notNull())
    .addColumn('providerId', 'text', (col) => col.notNull())
    .addColumn('accessToken', 'text')
    .addColumn('refreshToken', 'text')
    .addColumn('accessTokenExpiresAt', 'timestamptz')
    .addColumn('refreshTokenExpiresAt', 'timestamptz')
    .addColumn('scope', 'text')
    .addColumn('idToken', 'text')
    .addColumn('password', 'text')
    .addColumn('createdAt', 'timestamptz', (col) => col.notNull())
    .addColumn('updatedAt', 'timestamptz', (col) => col.notNull())
    .execute()

  // Create verification table
  await db.schema
    .createTable('verification')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('identifier', 'text', (col) => col.notNull())
    .addColumn('value', 'text', (col) => col.notNull())
    .addColumn('expiresAt', 'timestamptz', (col) => col.notNull())
    .addColumn('createdAt', 'timestamptz', (col) => col.notNull())
    .addColumn('updatedAt', 'timestamptz', (col) => col.notNull())
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('verification').execute()
  await db.schema.dropTable('account').execute()
  await db.schema.dropTable('session').execute()
  await db.schema.dropTable('invitation').execute()
  await db.schema.dropTable('organizationRole').execute()
  await db.schema.dropTable('teamMember').execute()
  await db.schema.dropTable('team').execute()
  await db.schema.dropTable('member').execute()
  await db.schema.dropTable('organization').execute()
  await db.schema.dropTable('user').execute()
}
