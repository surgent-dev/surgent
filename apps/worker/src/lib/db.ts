import { createClient } from '@repo/db'
import { config } from './config'
import { createLogger } from './logger'

const log = createLogger('db')

if (!config.database.url) throw new Error('DATABASE_URL not set')

log.info({ type: config.database.type }, 'initializing db')
export const { db, dialect } = createClient(config.database.url, config.database.type ?? 'postgres')
