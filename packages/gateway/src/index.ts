import { Hono } from 'hono'
import type { AppContext } from './types'
import zen from './routes/zen'

const app = new Hono<AppContext>()

app.get('/health', (c) => c.text('ok'))
app.route('/zen', zen)

export default {
  fetch: app.fetch,
}
