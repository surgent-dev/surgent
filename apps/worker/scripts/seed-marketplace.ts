/// <reference types="bun" />

/**
 * Seed fake marketplace listings into the local database.
 *
 * Usage:
 *   bun apps/worker/scripts/seed-marketplace.ts
 *   bun apps/worker/scripts/seed-marketplace.ts --clean   # remove seeded listings first
 */

import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import * as dotenv from 'dotenv'

const scriptDir = dirname(new URL(import.meta.url).pathname)
const workerDir = resolve(scriptDir, '..')
const repoRoot = resolve(workerDir, '..', '..')
const defaultEnvFiles = [resolve(repoRoot, '.env.prod'), resolve(workerDir, '.env.local')]

for (const file of defaultEnvFiles) {
  if (!existsSync(file)) continue
  dotenv.config({ path: file, override: false })
}

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required')

const { db } = await import('../src/lib/db')

/* ─── Fake data ─── */

const SEED_EMAIL_DOMAIN = '@seed.example.com'

const FAKE_SELLERS = [
  { name: 'Sarah Chen', image: 'https://i.pravatar.cc/150?u=sarah-chen' },
  { name: 'Marcus Rivera', image: 'https://i.pravatar.cc/150?u=marcus-rivera' },
  { name: 'Aiko Tanaka', image: 'https://i.pravatar.cc/150?u=aiko-tanaka' },
  { name: 'James Mitchell', image: 'https://i.pravatar.cc/150?u=james-mitchell' },
  { name: 'Priya Sharma', image: 'https://i.pravatar.cc/150?u=priya-sharma' },
  { name: 'Lena Kowalski', image: 'https://i.pravatar.cc/150?u=lena-kowalski' },
  { name: 'David Okafor', image: 'https://i.pravatar.cc/150?u=david-okafor' },
  { name: 'Emma Larsson', image: 'https://i.pravatar.cc/150?u=emma-larsson' },
  { name: 'Carlos Mendez', image: 'https://i.pravatar.cc/150?u=carlos-mendez' },
]

const LISTINGS = [
  {
    title: 'Minimal Portfolio',
    description: 'Clean single-page portfolio with smooth scroll animations and dark mode support.',
    image: 'https://images.unsplash.com/photo-1545235617-9465d2a55698?w=800&q=80',
  },
  {
    title: 'SaaS Starter Kit',
    description:
      'Complete SaaS landing page with pricing tables, feature sections, and testimonials.',
    image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80',
  },
  {
    title: 'Restaurant Booking',
    description: 'Online reservation system with menu showcase and location map integration.',
    image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80',
  },
  {
    title: 'Fitness Tracker Dashboard',
    description: 'Analytics dashboard for fitness studios with member stats and class scheduling.',
    image: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=800&q=80',
  },
  {
    title: 'E-commerce Storefront',
    description: 'Modern product catalog with cart, checkout flow, and inventory management.',
    image: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&q=80',
  },
  {
    title: 'Real Estate Listings',
    description: 'Property showcase with virtual tours, filtering, and agent contact forms.',
    image: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80',
  },
  {
    title: 'Blog & Newsletter',
    description: 'Content platform with MDX support, email capture, and reading time estimates.',
    image: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=800&q=80',
  },
  {
    title: 'Photography Gallery',
    description: 'Masonry grid gallery with lightbox viewer and category filtering.',
    image: 'https://images.unsplash.com/photo-1452587925148-ce544e77e70d?w=800&q=80',
  },
  {
    title: 'Dental Clinic',
    description: 'Professional clinic website with appointment booking and service showcase.',
    image: 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=800&q=80',
  },
  {
    title: 'Music Artist Page',
    description: 'Artist landing page with embedded player, tour dates, and merch store.',
    image: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&q=80',
  },
  {
    title: 'Event Landing Page',
    description: 'Conference website with speaker lineup, schedule, and ticket purchasing.',
    image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&q=80',
  },
  {
    title: 'Agency Website',
    description: 'Creative agency portfolio with case studies, team bios, and contact form.',
    image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80',
  },
]

/* ─── Helpers ─── */

function daysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

function slug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

/* ─── Main ─── */

const clean = process.argv.includes('--clean')

// Always clean existing seed data before seeding (idempotent)
{
  // Find seeded users by email domain (also match old `seed-*@example.com` pattern)
  const seededUsers = await db
    .selectFrom('user')
    .select('id')
    .where((eb) =>
      eb.or([
        eb('email', 'like', `%${SEED_EMAIL_DOMAIN}`),
        eb('email', 'like', 'seed-%@example.com'),
      ]),
    )
    .execute()

  if (seededUsers.length > 0) {
    const userIds = seededUsers.map((u) => u.id)

    // Delete listings via projects owned by seed users
    const seededProjects = await db
      .selectFrom('project')
      .select('id')
      .where('userId', 'in', userIds)
      .execute()
    const projectIds = seededProjects.map((p) => p.id)

    if (projectIds.length > 0) {
      await db.deleteFrom('listing').where('projectId', 'in', projectIds).execute()
      await db.deleteFrom('project').where('id', 'in', projectIds).execute()
      console.log(`Cleaned ${projectIds.length} seeded projects/listings`)
    }

    await db.deleteFrom('organization').where('createdBy', 'in', userIds).execute()
    await db.deleteFrom('user').where('id', 'in', userIds).execute()
    console.log(`Cleaned ${seededUsers.length} seeded users`)
  } else {
    console.log('No existing seed data')
  }

  if (clean) {
    await db.destroy()
    process.exit(0)
  }
}

console.log(`Seeding ${LISTINGS.length} marketplace listings...`)

// Create fake users + orgs first
const createdUsers: { id: string; orgId: string; idx: number }[] = []

for (let i = 0; i < FAKE_SELLERS.length; i++) {
  const seller = FAKE_SELLERS[i]

  const user = await db
    .insertInto('user')
    .values({
      name: seller.name,
      email: `${slug(seller.name)}${SEED_EMAIL_DOMAIN}`,
      emailVerified: true,
      image: seller.image,
      createdAt: daysAgo(30 + i),
      updatedAt: daysAgo(30 + i),
    })
    .returning('id')
    .executeTakeFirstOrThrow()

  const org = await db
    .insertInto('organization')
    .values({
      name: `${seller.name}'s Org`,
      slug: `seed-${slug(seller.name)}-org`,
      createdBy: user.id,
      createdAt: daysAgo(30 + i),
      updatedAt: daysAgo(30 + i),
    })
    .returning('id')
    .executeTakeFirstOrThrow()

  createdUsers.push({ id: user.id, orgId: org.id, idx: i })
}

console.log(`Created ${createdUsers.length} fake sellers`)

// Create projects + listings
for (let i = 0; i < LISTINGS.length; i++) {
  const listing = LISTINGS[i]
  const seller = createdUsers[i % createdUsers.length]
  const age = Math.floor(Math.random() * 21) + 1 // 1–21 days ago

  const project = await db
    .insertInto('project')
    .values({
      userId: seller.id,
      organizationId: seller.orgId,
      name: listing.title,
      slug: `seed-${slug(listing.title)}-${i}`,
      status: 'ready' as any,
      failReason: null,
      github: null,
      settings: null,
      deployment: null,
      sandbox: null,
      metadata: null,
      isPublic: true,
      createdAt: daysAgo(age),
      updatedAt: daysAgo(age),
      deletedAt: null,
    })
    .returning('id')
    .executeTakeFirstOrThrow()

  await db
    .insertInto('listing')
    .values({
      projectId: project.id,
      title: listing.title,
      description: listing.description,
      imageUrl: listing.image,
      status: 'active',
      createdAt: daysAgo(age),
      updatedAt: daysAgo(age),
    })
    .execute()
}

console.log(`Seeded ${LISTINGS.length} listings. Done!`)
await db.destroy()
