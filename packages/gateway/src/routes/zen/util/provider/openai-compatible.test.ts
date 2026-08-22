import { describe, expect, test } from 'bun:test'
import { oaCompatHelper } from './openai-compatible'

describe('Particle DeepSeek request compatibility', () => {
  const helper = oaCompatHelper({
    reqModel: 'deepseek-v4-flash-0731',
    providerModel: 'deepseek-v4-flash-0731',
  })

  test('applies the recommended sampling defaults and tool replay field', () => {
    const body = helper.modifyBody({
      model: 'deepseek-v4-flash-0731',
      messages: [
        { role: 'user', content: 'check the weather' },
        {
          role: 'assistant',
          content: null,
          tool_calls: [{ id: 'call-1', type: 'function', function: { name: 'weather' } }],
        },
      ],
      stream: true,
    })

    expect(body.temperature).toBe(1)
    expect(body.top_p).toBe(0.95)
    expect(body.stream_options).toEqual({ include_usage: true })
    expect(body.messages[1].reasoning_content).toBe('')
  })

  test('preserves explicit sampling and reasoning content', () => {
    const body = helper.modifyBody({
      model: 'deepseek-v4-flash-0731',
      messages: [
        {
          role: 'assistant',
          tool_calls: [],
          reasoning_content: 'existing',
        },
      ],
      temperature: 0.5,
      top_p: 0.8,
      stream: false,
    })

    expect(body.temperature).toBe(0.5)
    expect(body.top_p).toBe(0.8)
    expect(body.messages[0].reasoning_content).toBe('existing')
  })
})
