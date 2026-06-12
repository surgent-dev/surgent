import { z } from 'zod'
import type { Bindings } from '../../../types'

export namespace ZenData {
  export const FormatSchema = z.enum(['anthropic', 'google', 'openai', 'oa-compat'])
  export const ByokProviderSchema = z.enum(['openai', 'anthropic', 'google'])
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
    costThresholdTokens: z.number().int().positive().optional(),
    allowAnonymous: z.boolean().optional(),
    byokProvider: ByokProviderSchema.optional(),
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

  const ProviderSchema = z
    .object({
      api: z.string(),
      apiKeyBinding: z.string().optional(),
      format: FormatSchema,
      headerMappings: z.record(z.string(), z.string()).optional(),
    })
    .strict()

  export const ModelsSchema = z.object({
    models: z.record(
      z.string(),
      z.union([ModelSchema, z.array(ModelSchema.extend({ formatFilter: FormatSchema }))]),
    ),
    providers: z.record(z.string(), ProviderSchema),
  })
}

type RawZenDataResponse = z.infer<typeof ZenData.ModelsSchema>
type ZenProvider = RawZenDataResponse['providers'][string] & { apiKey: string }

export type ZenDataResponse = Omit<RawZenDataResponse, 'providers'> & {
  providers: Record<string, ZenProvider>
}

function isByokProvider(provider: string) {
  return provider === 'openai' || provider === 'anthropic' || provider === 'google'
}

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

function defaultApiKeyBinding(providerId: string) {
  return `${providerId.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_API_KEY`
}

function readProviderApiKey(
  env: Bindings,
  providerId: string,
  provider: RawZenDataResponse['providers'][string],
) {
  const binding = provider.apiKeyBinding ?? defaultApiKeyBinding(providerId)
  const value = (env as unknown as Record<string, unknown>)[binding]
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Provider ${providerId} is missing ${binding}`)
  }
  return value
}

export function loadZenData(env: Bindings): ZenDataResponse {
  const raw = readModelsEnv(env)
  if (!raw) {
    throw new Error('ZEN_MODELS is not configured')
  }
  const data = ZenData.ModelsSchema.parse(JSON.parse(raw))
  const providers = Object.fromEntries(
    Object.entries(data.providers).map(([providerId, provider]) => [
      providerId,
      {
        ...provider,
        apiKey: readProviderApiKey(env, providerId, provider),
      },
    ]),
  )
  const zenData = { ...data, providers }

  for (const [modelId, value] of Object.entries(zenData.models)) {
    const models = Array.isArray(value) ? value : [value]

    for (const model of models) {
      const providers = model.providers.map((provider) => provider.id).filter(isByokProvider)

      if (providers.length === 0) continue
      if (!model.byokProvider) throw new Error(`Model ${modelId} is missing byokProvider`)
      if (!providers.includes(model.byokProvider)) {
        throw new Error(`Model ${modelId} has invalid byokProvider ${model.byokProvider}`)
      }
    }
  }

  return zenData
}
