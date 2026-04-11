import { generateObject } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { z } from 'zod'

const together = createOpenAI({
  baseURL: 'https://api.together.xyz/v1',
  apiKey: process.env.TOGETHER_API_KEY,
})

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
    model: together('zai-org/GLM-5.1'),
    system,
    prompt,
    schema,
  })

  return object
}
