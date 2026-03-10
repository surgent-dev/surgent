import { createLogger } from '@/lib/logger'
import { getBoss, stopBoss as stopPgBoss } from '@/lib/boss'
import { registerPayWorkers } from '@/lib/pay/queue'
import { registerProjectWorkers } from '@/lib/projects/queue'

const log = createLogger('pg-boss')

let started = false

export async function startBoss(): Promise<void> {
  if (started) return

  const boss = getBoss()
  await boss.start()

  boss.on('error', (err: unknown) => {
    log.error({ err }, 'error')
  })

  await registerPayWorkers()
  await registerProjectWorkers()
  started = true
  log.info('started')
}

export async function stopBoss(): Promise<void> {
  if (!started) return
  await stopPgBoss()
  started = false
  log.info('stopped')
}
