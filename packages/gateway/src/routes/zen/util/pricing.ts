export type CostRates = {
  input: number
  output: number
  cacheRead?: number
  cacheWrite5m?: number
  cacheWrite1h?: number
}

export type TokenUsage = {
  inputTokens: number
  outputTokens: number
  reasoningTokens?: number
  cacheReadTokens?: number
  cacheWrite5mTokens?: number
  cacheWrite1hTokens?: number
}

const SURGENT_MARKUP_MULTIPLIER = 1.3
export const SURGENT_MARKUP_BPS = 3000

function tokenCost(rate: number | undefined, tokens: number | undefined) {
  return (rate ?? 0) * (tokens ?? 0) * 100
}

export function calculateUsageCosts(
  providerRates: CostRates,
  price: CostRates | undefined,
  usage: TokenUsage,
  managedBilling: boolean,
) {
  const calculate = (rates: CostRates) => {
    const input = tokenCost(rates.input, usage.inputTokens)
    const output = tokenCost(rates.output, usage.outputTokens)
    const reasoning = tokenCost(rates.output, usage.reasoningTokens)
    const cacheRead = tokenCost(rates.cacheRead, usage.cacheReadTokens)
    const cacheWrite5m = tokenCost(rates.cacheWrite5m, usage.cacheWrite5mTokens)
    const cacheWrite1h = tokenCost(rates.cacheWrite1h, usage.cacheWrite1hTokens)

    return {
      input,
      output,
      reasoning,
      cacheRead,
      cacheWrite5m,
      cacheWrite1h,
      total: input + output + reasoning + cacheRead + cacheWrite5m + cacheWrite1h,
    }
  }

  const provider = calculate(providerRates)
  const customer = price ? calculate(price) : provider
  const billedTotal = managedBilling
    ? price
      ? customer.total
      : provider.total * SURGENT_MARKUP_MULTIPLIER
    : provider.total

  return {
    provider,
    billedTotal,
    markupBps: managedBilling ? (price ? null : SURGENT_MARKUP_BPS) : 0,
  }
}
