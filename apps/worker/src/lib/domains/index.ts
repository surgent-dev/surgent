export function expandDomainQuery(query: string): string[] {
  const trimmed = query.trim().toLowerCase()
  if (!trimmed) return []
  if (/\.[a-z]{2,}$/.test(trimmed)) return [trimmed]
  return ['.com', '.io', '.dev', '.app', '.co', '.net', '.org'].map((tld) => trimmed + tld)
}
