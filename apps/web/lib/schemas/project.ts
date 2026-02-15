import { z } from 'zod'

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

export const ProjectSchema = z.object({
  id: z.string(),
  userId: z.string(),
  organizationId: z.string().optional(),
  name: z.string(),
  status: z.enum(['provisioning', 'ready', 'failed']).optional().default('ready'),
  failReason: z.string().nullable().optional(),
  github: z.any().nullable(),
  settings: z.any().nullable(),
  metadata: z
    .object({
      workingDirectory: z.string().optional(),
      processName: z.string().optional(),
      startCommand: z.string().optional(),
      provisioningStep: z.string().optional(),
    })
    .nullable()
    .catch(null),
  isPublic: z.boolean().default(true),
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
