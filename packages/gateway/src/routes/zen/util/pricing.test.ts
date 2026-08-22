import { describe, expect, test } from 'bun:test'
import { calculateUsageCosts, SURGENT_MARKUP_BPS } from './pricing'

const usage = {
  inputTokens: 1_000_000,
  outputTokens: 1_000_000,
  reasoningTokens: 0,
}

describe('calculateUsageCosts', () => {
  test('supports a paid customer price with zero provider cost', () => {
    const result = calculateUsageCosts(
      { input: 0, output: 0 },
      { input: 0.0000001, output: 0.0000003 },
      usage,
      true,
    )

    expect(result.provider.total).toBe(0)
    expect(result.billedTotal).toBe(40)
    expect(result.markupBps).toBeNull()
  })

  test('preserves the standard managed-provider markup when no price is set', () => {
    const result = calculateUsageCosts(
      { input: 0.000001, output: 0.000002 },
      undefined,
      usage,
      true,
    )

    expect(result.provider.total).toBe(300)
    expect(result.billedTotal).toBe(390)
    expect(result.markupBps).toBe(SURGENT_MARKUP_BPS)
  })

  test('does not apply Surgent pricing to externally billed usage', () => {
    const result = calculateUsageCosts(
      { input: 0.000001, output: 0.000002 },
      { input: 0.0000001, output: 0.0000003 },
      usage,
      false,
    )

    expect(result.billedTotal).toBe(300)
    expect(result.markupBps).toBe(0)
  })
})
