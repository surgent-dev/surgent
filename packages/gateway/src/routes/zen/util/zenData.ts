import { z } from 'zod'
import type { Bindings } from '../../../types'

export namespace ZenData {
  export const FormatSchema = z.enum(['anthropic', 'google', 'openai', 'oa-compat'])
  const TrialSchema = z.object({
    provider: z.string(),
    limits: z.array(
      z.object({
        limit: z.number(),
        client: z.enum(['cli', 'desktop']).optional(),
      }),
    ),
  })

  export type Format = z.infer<typeof FormatSchema>
  export type Trial = z.infer<typeof TrialSchema>

  const ModelCostSchema = z.object({
    input: z.number(),
    output: z.number(),
    cacheRead: z.number().optional(),
    cacheWrite5m: z.number().optional(),
    cacheWrite1h: z.number().optional(),
  })

  const ModelSchema = z.object({
    name: z.string(),
    cost: ModelCostSchema,
    cost200K: ModelCostSchema.optional(),
    allowAnonymous: z.boolean().optional(),
    byokProvider: z.enum(['openai', 'anthropic', 'google']).optional(),
    stickyProvider: z.enum(['strict', 'prefer']).optional(),
    trial: TrialSchema.optional(),
    rateLimit: z.number().optional(),
    fallbackProvider: z.string().optional(),
    providers: z.array(
      z.object({
        id: z.string(),
        model: z.string(),
        weight: z.number().optional(),
        disabled: z.boolean().optional(),
        storeModel: z.string().optional(),
      }),
    ),
  })

  const ProviderSchema = z.object({
    api: z.string(),
    apiKey: z.string(),
    format: FormatSchema,
    headerMappings: z.record(z.string(), z.string()).optional(),
  })

  export const ModelsSchema = z.object({
    models: z.record(z.string(), z.union([ModelSchema, z.array(ModelSchema.extend({ formatFilter: FormatSchema }))])),
    providers: z.record(z.string(), ProviderSchema),
  })
}

export type ZenDataResponse = z.infer<typeof ZenData.ModelsSchema>

function readModelsEnv(env: Bindings) {
  if (env.ZEN_MODELS) return env.ZEN_MODELS
  return [
    env.ZEN_MODELS1,
    env.ZEN_MODELS2,
    env.ZEN_MODELS3,
    env.ZEN_MODELS4,
    env.ZEN_MODELS5,
    env.ZEN_MODELS6,
    env.ZEN_MODELS7,
    env.ZEN_MODELS8,
  ]
    .filter((value): value is string => Boolean(value && value.length > 0))
    .join('')
}

export function loadZenData(env: Bindings): ZenDataResponse {
  const raw = readModelsEnv(env)
  if (!raw) {
    throw new Error('ZEN_MODELS is not configured')
  }
  const json = JSON.parse(raw)
  return ZenData.ModelsSchema.parse(json)
}
