import pino from 'pino'

const isDev = process.env.APP_DEBUG === 'true' || process.env.NODE_ENV !== 'production'

const TAG_COLORS: Record<string, string> = {
  WEBHOOK: '\x1b[36m', // cyan
  QUEUE: '\x1b[35m', // magenta
  DOMAIN: '\x1b[33m', // yellow
  AGENT: '\x1b[34m', // blue
  PROJECT: '\x1b[32m', // green
  PAY: '\x1b[36m', // cyan
  BILLING: '\x1b[36m', // cyan
  AUTH: '\x1b[90m', // gray
  ADMIN: '\x1b[35m', // magenta
  ENTRI: '\x1b[33m', // yellow
}
const RESET = '\x1b[39m'

function colorizeTags(msg: string): string {
  return msg.replace(/\[([A-Z]+)(?::[^\]]*?)?\]/g, (match, cat: string) => {
    const c = TAG_COLORS[cat]
    return c ? `${c}${match}${RESET}` : match
  })
}

async function createDevStream() {
  const pretty = (await import('pino-pretty')).default
  return pretty({
    colorize: true,
    singleLine: true,
    messageFormat: (log: Record<string, unknown>, messageKey: string) =>
      colorizeTags((log[messageKey] as string) || ''),
  })
}

export const logger = isDev
  ? pino({ level: process.env.LOG_LEVEL || 'debug' }, await createDevStream())
  : pino({ level: process.env.LOG_LEVEL || 'info' })

export function createLogger(module: string) {
  return logger.child({ module })
}
