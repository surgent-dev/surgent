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

export const ProjectSchema = z.object({
  id: z.string(),
  userId: z.string(),
  organizationId: z.string().optional(),
  name: z.string(),
  github: z.any().nullable(),
  settings: z.any().nullable(),
  metadata: z.any().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  sandbox: SandboxSchema,
  worker: WorkerSchema,
})

export const ProjectsSchema = z.array(ProjectSchema)

export const CreateProjectResponseSchema = z.object({ id: z.string() })

export type Project = z.infer<typeof ProjectSchema>
