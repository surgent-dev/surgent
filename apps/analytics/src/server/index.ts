import 'dotenv/config'
import { createApp } from './app'

const hostname = process.env.HOSTNAME || '0.0.0.0'
const port = Number(process.env.PORT || '3000')

const app = await createApp()

Bun.serve({
  hostname,
  port,
  fetch: app.fetch,
})

console.log(`Surgent Analytics listening on http://${hostname}:${port}`)
