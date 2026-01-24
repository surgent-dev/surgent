import type { Context } from 'hono'

export interface Bindings {
  STAGE: string
  ZEN_MODELS?: string
  GATEWAY_KV: KVNamespace
  GATEWAY_DATA?: R2Bucket
  HYPERDRIVE?: { connectionString: string }
}

export type AppContext = {
  Bindings: Bindings
}

export type HonoContext = Context<AppContext>
