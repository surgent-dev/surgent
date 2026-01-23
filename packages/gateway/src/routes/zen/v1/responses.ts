import type { Context } from 'hono'
import type { AppContext } from '../../../types'
import { handleZenRequest } from '../util/handler.worker'

export function handleResponses(c: Context<AppContext>) {
  return handleZenRequest(c, {
    format: 'openai',
    parseApiKey: (headers: Headers) => headers.get('authorization')?.split(' ')[1],
    parseModel: (url: string, body: any) => body.model,
    parseIsStream: (url: string, body: any) => !!body.stream,
  })
}
