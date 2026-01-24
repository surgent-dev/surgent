import { createClient } from '@repo/db'
import { config } from './config'

if (!config.database.url) throw new Error('DATABASE_URL not set')

console.log(`[worker/db] initializing db with type: ${config.database.type}`)
export const { db, dialect } = createClient(config.database.url, config.database.type)
