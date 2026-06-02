import { z } from 'zod'
import { PROJECT_PROVISIONING_STEPS } from '@/lib/project-provisioning'

export const SandboxSchema = z
  .object({
    id: z.string(),
    status: z.string().nullable(),
    url: z.string().nullable(),
  })
  .nullable()

export const WorkerSchema = z
  .object({
    name: z.string(),
    status: z.string().nullable(),
    hostname: z.string().nullable(),
  })
  .nullable()

export const IntegrationSchema = z.object({
  provider: z.string(),
  status: z.string(),
  config: z.any().nullable(),
})

const ProjectProvisioningMetadataSchema = z
  .object({
    sandboxId: z.string().optional(),
    previewUrl: z.string().optional(),
    initializedAt: z.string().optional(),
    opencodeReadyAt: z.string().optional(),
    finalizedAt: z.string().optional(),
    lastError: z.string().nullable().optional(),
  })
  .optional()

const ProjectOnboardingMetadataSchema = z
  .object({
    identity: z.string().optional(),
    goal: z.string().optional(),
    industry: z.string().optional(),
    businessName: z.string().optional(),
    location: z.string().optional(),
    stage: z.string().optional(),
    audience: z.string().optional(),
    referenceUrls: z.array(z.string()).optional(),
    prompt: z.string(),
  })
  .optional()

const BrandDnaObjectSchema = z.object({
  brand: z.object({
    tagline: z.string(),
    mission: z.string(),
    voice: z.string(),
    personality: z.array(z.string()),
  }),
  colors: z.object({
    primary: z.string(),
    secondary: z.string(),
    accent: z.string(),
    background: z.string(),
    text: z.string(),
  }),
  typography: z.object({
    heading: z.string(),
    body: z.string(),
  }),
  style: z.array(z.string()),
  websiteCopy: z.object({
    heroHeadline: z.string(),
    heroSubheadline: z.string(),
    ctaButton: z.string(),
    aboutBio: z.string(),
    metaDescription: z.string(),
    valuePropositions: z.array(z.string()),
  }),
  socialProfiles: z.object({
    instagram: z.string(),
    twitter: z.string(),
    linkedin: z.string(),
    tiktok: z.string(),
    hashtags: z.array(z.string()),
  }),
  elevatorPitch: z.object({
    thirtySeconds: z.string(),
    sixtySeconds: z.string(),
  }),
  idealCustomer: z.object({
    name: z.string(),
    age: z.number(),
    location: z.string(),
    occupation: z.string(),
    story: z.string(),
    frustrations: z.array(z.string()),
    goals: z.array(z.string()),
    objections: z.array(z.string()),
  }),
  pricing: z.object({
    strategy: z.string(),
    tiers: z.array(
      z.object({
        name: z.string(),
        price: z.string(),
        description: z.string(),
        features: z.array(z.string()),
      }),
    ),
  }),
  seoKeywords: z.array(
    z.object({
      keyword: z.string(),
      intent: z.enum(['informational', 'commercial', 'transactional', 'navigational']),
      difficulty: z.enum(['low', 'medium', 'high']),
    }),
  ),
  contentCalendar: z.array(
    z.object({
      day: z.string(),
      platform: z.string(),
      format: z.string(),
      topic: z.string(),
      caption: z.string(),
    }),
  ),
  adCopy: z.array(
    z.object({
      platform: z.string(),
      headline: z.string(),
      body: z.string(),
      cta: z.string(),
    }),
  ),
  marketResearch: z.object({
    targetAudience: z.object({
      demographics: z.string(),
      psychographics: z.string(),
      painPoints: z.array(z.string()),
      desires: z.array(z.string()),
    }),
    competitors: z.array(
      z.object({
        name: z.string(),
        strengths: z.array(z.string()),
        weaknesses: z.array(z.string()),
      }),
    ),
    positioning: z.string(),
    differentiators: z.array(z.string()),
    trends: z.array(z.string()),
  }),
  mvpStrategy: z.object({
    coreFeatures: z.array(
      z.object({
        name: z.string(),
        description: z.string(),
        priority: z.enum(['must-have', 'nice-to-have']),
      }),
    ),
    contentPriorities: z.array(z.string()),
    marketingChannels: z.array(
      z.object({
        channel: z.string(),
        reason: z.string(),
      }),
    ),
    quickWins: z.array(z.string()),
    keyMetrics: z.array(z.string()),
    milestones: z.object({
      thirtyDays: z.array(z.string()),
      sixtyDays: z.array(z.string()),
      ninetyDays: z.array(z.string()),
    }),
  }),
  generatedAt: z.string(),
})

const BrandDnaSchema = BrandDnaObjectSchema.optional()

export type BrandDna = z.infer<typeof BrandDnaSchema>

export const ProjectSchema = z.object({
  id: z.string(),
  userId: z.string(),
  organizationId: z.string().optional(),
  name: z.string(),
  status: z.enum(['provisioning', 'ready', 'failed']),
  failReason: z.string().nullable().optional(),
  github: z.any().nullable(),
  settings: z.any().nullable(),
  metadata: z
    .object({
      onboarding: ProjectOnboardingMetadataSchema,
      brandDna: BrandDnaSchema,
      workingDirectory: z.string().optional(),
      processName: z.string().optional(),
      startCommand: z.string().optional(),
      provisioningStep: z.enum(PROJECT_PROVISIONING_STEPS).nullable().optional(),
      provisioning: ProjectProvisioningMetadataSchema,
    })
    .nullable()
    .catch(null),
  isPublic: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  sandbox: SandboxSchema,
  worker: WorkerSchema,
  integrations: z.array(IntegrationSchema).optional(),
})

export const ProjectsSchema = z.array(ProjectSchema)

export const CreateProjectResponseSchema = z.object({ id: z.string() })

export type Project = z.infer<typeof ProjectSchema>
export type Integration = z.infer<typeof IntegrationSchema>
