import { generateObject } from 'ai'
import { google } from '@ai-sdk/google'
import { z } from 'zod'

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
    model: google('gemini-2.5-flash'),
    system,
    prompt,
    schema,
  })

  return object
}
