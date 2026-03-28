export const PRISMA = 'prisma'
export const CLICKHOUSE = 'clickhouse'
export const KAFKA = 'kafka'
export const KAFKA_PRODUCER = 'kafka-producer'

type QueryMap<T> = {
  prisma?: () => Promise<T> | T
  clickhouse?: () => Promise<T> | T
}

Object.defineProperty(BigInt.prototype, 'toJSON', {
  value() {
    return Number(this)
  },
})

export function isClickhouseEnabled(url = process.env.CLICKHOUSE_URL) {
  return process.env.ANALYTICS_STORAGE === 'clickhouse' && Boolean(url)
}

export async function runQuery<T>(queries: QueryMap<T>) {
  if (isClickhouseEnabled()) {
    const query = queries[CLICKHOUSE] ?? queries[PRISMA]

    if (query) {
      return query()
    }
  }

  if (queries[PRISMA]) {
    return queries[PRISMA]()
  }

  throw new Error('No query implementation available for the current storage configuration.')
}

export function notImplemented(): never {
  throw new Error('Not implemented.')
}
