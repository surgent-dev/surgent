import { auth } from '@/lib/auth'
import type { PinoLogger } from 'hono-pino'

export type AppContext = {
  Variables: {
    user: typeof auth.$Infer.Session.user | null
    session: typeof auth.$Infer.Session.session | null
    logger: PinoLogger
  }
}
