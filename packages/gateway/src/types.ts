import type { Context } from 'hono'

export interface Bindings {
  STAGE: string
  ZEN_MODELS?: string
  ZEN_MODELS1?: string
  ZEN_MODELS2?: string
  ZEN_MODELS3?: string
  ZEN_MODELS4?: string
  ZEN_MODELS5?: string
  ZEN_MODELS6?: string
  ZEN_MODELS7?: string
  ZEN_MODELS8?: string
  OPENAI_API_KEY?: string
  ANTHROPIC_API_KEY?: string
  GOOGLE_API_KEY?: string
  GATEWAY_KV: KVNamespace
  POSTGRES_TYPE?: string
  GATEWAY_DATA?: R2Bucket
  HYPERDRIVE?: { connectionString: string }
}

export type AppContext = {
  Bindings: Bindings
}

export type HonoContext = Context<AppContext>
