import type { Context } from 'hono'
import type { AppContext } from '../../../types'
import { handleZenRequest } from '../util/handler.worker'

export function handleMessages(c: Context<AppContext>) {
  return handleZenRequest(c, {
    format: 'anthropic',
    parseApiKey: (headers: Headers) => headers.get('x-api-key') ?? undefined,
    parseModel: (url: string, body: any) => body.model,
    parseIsStream: (url: string, body: any) => !!body.stream,
  })
}
