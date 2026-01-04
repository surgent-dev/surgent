import { Hono } from 'hono'
import dispatch from './routes/dispatch'
import type { AppContext } from '@/types/application'

const app = new Hono<AppContext>()
app.route('/', dispatch)

export default {
  fetch: app.fetch,
}
