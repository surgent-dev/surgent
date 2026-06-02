import type { Bindings } from '../../../types'

type WaitUntil = { waitUntil: (promise: Promise<unknown>) => void }

export function createDataDumper(
  env: Bindings,
  executionCtx: WaitUntil | undefined,
  sessionId: string,
  requestId: string,
  projectId: string,
) {
  if (env.STAGE !== 'production') return
  const bucket = env.GATEWAY_DATA
  if (!bucket) return
  if (!executionCtx) return
  if (sessionId === '') return

  let metadata: Record<string, unknown> = { sessionId, requestId, projectId }

  return {
    provideModel: (model?: string) => {
      metadata.modelName = model
    },
    provideRequest: (_request: string) => {},
    provideResponse: (_response: string) => {},
    provideStream: (_chunk: string) => {},
    flush: () => {
      if (!metadata.modelName) return

      const timestamp = new Date().toISOString().replace(/[^0-9]/g, '')
      const [year, month, day, hour, minute, second] = [
        timestamp.substring(0, 4),
        timestamp.substring(4, 6),
        timestamp.substring(6, 8),
        timestamp.substring(8, 10),
        timestamp.substring(10, 12),
        timestamp.substring(12, 14),
      ]

      executionCtx.waitUntil(
        bucket.put(
          `meta/${metadata.modelName}/${year}/${month}/${day}/${hour}/${minute}/${second}/${sessionId}/${requestId}.json`,
          JSON.stringify({ timestamp, ...metadata }),
        ),
      )
    },
  }
}
