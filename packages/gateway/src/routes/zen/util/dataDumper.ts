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

  let data: Record<string, unknown> = { sessionId, requestId, projectId }
  let metadata: Record<string, unknown> = { sessionId, requestId, projectId }

  return {
    provideModel: (model?: string) => {
      data.modelName = model
      metadata.modelName = model
    },
    provideRequest: (request: string) => (data.request = request),
    provideResponse: (response: string) => (data.response = response),
    provideStream: (chunk: string) => (data.response = ((data.response as string) ?? '') + chunk),
    flush: () => {
      if (!data.modelName) return

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
          `data/${data.modelName}/${year}/${month}/${day}/${hour}/${minute}/${second}/${requestId}.json`,
          JSON.stringify({ timestamp, ...data }),
        ),
      )

      executionCtx.waitUntil(
        bucket.put(
          `meta/${data.modelName}/${sessionId}/${requestId}.json`,
          JSON.stringify({ timestamp, ...metadata }),
        ),
      )
    },
  }
}
