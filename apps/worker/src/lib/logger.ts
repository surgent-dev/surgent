import pino from 'pino'

const isDev = process.env.APP_DEBUG === 'true' || process.env.NODE_ENV !== 'production'

const TAG_COLORS: Record<string, string> = {
  WEBHOOK: '\x1b[36m', // cyan
  QUEUE: '\x1b[35m', // magenta
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
