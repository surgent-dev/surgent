import type { Context } from 'hono'
import type { AppContext } from '../../../../types'
import { handleZenRequest } from '../../util/handler.worker'

export function handleGoogleModel(c: Context<AppContext>) {
  return handleZenRequest(c, {
    format: 'google',
    parseApiKey: (headers: Headers) => headers.get('x-goog-api-key') ?? undefined,
    parseModel: (url: string, body: any) => url.split('/').pop()?.split(':')?.[0] ?? '',
    parseIsStream: (url: string, body: any) =>
      url.split('/').pop()?.split(':')?.[1]?.startsWith('streamGenerateContent') ?? false,
  })
}
