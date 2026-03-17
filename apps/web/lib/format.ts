export function timeAgoCompact(value: string): string {
  const mins = Math.floor((Date.now() - new Date(value).getTime()) / 60_000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  return new Date(value).toLocaleDateString()
}

export function timeAgoDetailed(value: string): string {
  const mins = Math.floor((Date.now() - new Date(value).getTime()) / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ${mins % 60}m ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function formatDateShort(value: string): string {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatMonthYear(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export function formatMarketplaceDate(value: string | null): string {
  if (!value) return 'Recently'
  const date = new Date(value)
  const diffDays = Math.floor((Date.now() - date.getTime()) / 86_400_000)
  if (diffDays < 1) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
