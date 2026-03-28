import dotenv from 'dotenv'
import { defineConfig } from 'prisma/config'

dotenv.config({ path: '.env.local' })

export default defineConfig({
  engine: 'classic',
  datasource: {
    url: process.env.DATABASE_URL || '',
  },
})
