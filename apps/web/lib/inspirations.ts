export function formatRevenueCompact(dollars: number): string {
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`
  if (dollars >= 1_000) return `$${(dollars / 1_000).toFixed(dollars >= 10_000 ? 0 : 1)}k`
  return `$${dollars.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

export function getDomainFromUrl(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, '')
}
