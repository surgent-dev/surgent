export type Logger = {
  metric: (values: Record<string, any>) => void
  log: (...args: any[]) => void
  debug: (message: string) => void
}

export function createLogger(stage?: string): Logger {
  return {
    metric: (values: Record<string, any>) => {
      console.log(`_metric:${JSON.stringify(values)}`)
    },
    log: console.log,
    debug: (message: string) => {
      if (stage !== 'dev') return
      console.debug(message)
    },
  }
}
