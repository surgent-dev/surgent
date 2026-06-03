import { generateObject } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { z } from 'zod'
import { config } from './config'

const openai = createOpenAI({
  apiKey: config.llms.openaiKey,
})

const gpt55FastOptions = {
  openai: {
    reasoningEffort: 'medium',
    serviceTier: 'priority',
  },
} as const

export async function generateJson<T>(
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  schema: z.ZodType<T>,
): Promise<T> {
  const system = messages.find((m) => m.role === 'system')?.content
  const prompt = messages
    .filter((m) => m.role !== 'system')
    .map((m) => m.content)
    .join('\n\n')

  const { object } = await generateObject({
    model: openai.responses('gpt-5.5'),
    providerOptions: gpt55FastOptions,
    system,
    prompt,
    schema,
  })

  return object
}
