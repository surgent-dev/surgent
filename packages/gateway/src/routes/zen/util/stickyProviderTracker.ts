export function createStickyTracker(
  stickyProvider: 'strict' | 'prefer' | undefined,
  session: string,
  kv: KVNamespace | undefined,
) {
  if (!stickyProvider) return
  if (!session) return
  if (!kv) return
  const key = `sticky:${session}`

  return {
    get: async () => {
      return await kv.get(key)
    },
    set: async (providerId: string) => {
      await kv.put(key, providerId, { expirationTtl: 86400 })
    },
  }
}
