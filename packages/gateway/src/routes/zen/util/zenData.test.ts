import { describe, expect, test } from 'bun:test'
import type { Bindings } from '../../../types'
import { loadZenData } from './zenData'

describe('loadZenData', () => {
  test('keeps zero provider cost separate from an explicit customer price', () => {
    const config = loadZenData({
      PARTICLE_API_KEY: 'secret',
      ZEN_MODELS: JSON.stringify({
        models: {
          'deepseek-v4-flash-0731': {
            name: 'DeepSeek V4 Flash',
            cost: { input: 0, output: 0 },
            price: { input: 0.0000001, output: 0.0000003 },
            providers: [{ id: 'particle', model: 'deepseek-v4-flash-0731' }],
          },
        },
        providers: {
          particle: {
            api: 'https://api.particle.ai/v1',
            format: 'oa-compat',
          },
        },
      }),
    } as Bindings)

    const model = config.models['deepseek-v4-flash-0731']
    expect(Array.isArray(model)).toBe(false)
    if (Array.isArray(model)) throw new Error('Expected one model configuration')
    expect(model.cost).toEqual({ input: 0, output: 0 })
    expect(model.price).toEqual({ input: 0.0000001, output: 0.0000003 })
    expect(config.providers.particle.apiKey).toBe('secret')
  })
})
