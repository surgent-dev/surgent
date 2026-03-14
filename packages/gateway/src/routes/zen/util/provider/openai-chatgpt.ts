import type { ProviderHelper } from './provider'
import type { ChatgptProviderCredentials } from './credentials'
import { normalizeOpenaiUsage, type OpenaiUsage } from './openai'

const CHATGPT_CODEX_URL = 'https://chatgpt.com/backend-api/codex/responses'
const CHATGPT_ORIGINATOR = 'opencode'
const CHATGPT_USER_AGENT = 'opencode'
const ENCRYPTED_REASONING = 'reasoning.encrypted_content'

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }
type JsonObject = { [key: string]: JsonValue }

function isJsonObject(value: unknown): value is JsonObject {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function stripUnsupportedInput(value: JsonValue | undefined): JsonValue | undefined {
  if (Array.isArray(value)) {
    return value
      .map((item) => stripUnsupportedInput(item))
      .filter((item): item is JsonValue => item !== undefined)
  }
  if (!isJsonObject(value)) return value
  if (value.type === 'item_reference') return

  const next: JsonObject = {}
  for (const [k, v] of Object.entries(value)) {
    if (k === 'id') continue
    const cleaned = stripUnsupportedInput(v)
    if (cleaned !== undefined) next[k] = cleaned
  }
  return next
}

function ensureInclude(body: Record<string, unknown>) {
  const include = Array.isArray(body.include)
    ? body.include.filter((item): item is string => typeof item === 'string')
    : []
  if (!include.includes(ENCRYPTED_REASONING)) include.push(ENCRYPTED_REASONING)
  return include
}

function parseSseEvent(chunk: string) {
  const lines = chunk.split('\n')
  const event = lines[0]
  const dataLine = lines[1]
  if (!event || !dataLine?.startsWith('data: ')) return

  try {
    const json = JSON.parse(dataLine.slice(6)) as Record<string, any>
    return {
      event: event.replace('event: ', '').trim(),
      json,
    }
  } catch {
    return
  }
}

function getResponseFromEvent(chunk: string) {
  const parsed = parseSseEvent(chunk)
  if (!parsed) return

  const type = parsed.event || parsed.json.type
  if (type !== 'response.completed' && type !== 'response.done') return
  return parsed.json.response
}

async function parseSseResponse(response: Response) {
  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    return response.json()
  }

  const text = await response.text()
  const parts = text
    .split('\n\n')
    .map((part) => part.trim())
    .filter(Boolean)
  for (const part of parts) {
    const result = getResponseFromEvent(part)
    if (result) return result
  }

  throw new Error('ChatGPT upstream did not return a final response event.')
}

export function openaiChatgptHelper({
  auth,
}: Parameters<ProviderHelper>[0] & {
  auth: ChatgptProviderCredentials
}): ReturnType<ProviderHelper> {
  return {
    format: 'openai',
    modifyUrl: () => CHATGPT_CODEX_URL,
    modifyHeaders: (headers: Headers) => {
      headers.delete('x-api-key')
      headers.set('authorization', `Bearer ${auth.accessToken}`)
      headers.set('ChatGPT-Account-Id', auth.accountId)
      headers.set('originator', CHATGPT_ORIGINATOR)
      headers.set('User-Agent', CHATGPT_USER_AGENT)
      headers.set('accept', 'text/event-stream')
    },
    modifyBody: (body: Record<string, any>) => {
      const next: Record<string, unknown> = {
        ...body,
        include: ensureInclude(body),
        store: false,
        stream: true,
      }
      if (Array.isArray(body.input)) {
        next.input = stripUnsupportedInput(body.input)
      }
      return next
    },
    streamSeparator: '\n\n',
    createUsageParser: () => {
      let usage: OpenaiUsage

      return {
        parse: (chunk: string) => {
          const response = getResponseFromEvent(chunk)
          if (!response?.usage) return
          usage = response.usage as OpenaiUsage
        },
        retrieve: () => usage,
      }
    },
    parseNonStreamResponse: parseSseResponse,
    normalizeUsage: normalizeOpenaiUsage,
  }
}
