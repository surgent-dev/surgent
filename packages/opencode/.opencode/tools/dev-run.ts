import { tool } from '@opencode-ai/plugin'
import { $ } from 'bun'

async function getSurgentConfig() {
  const cfg = await Bun.file('surgent.json')
    .json()
    .catch(() => null)
  if (!cfg?.name) throw new Error('Missing "name" in surgent.json')
  if (!cfg?.scripts?.dev) throw new Error('Missing "scripts.dev" in surgent.json')
  return cfg as { name: string; scripts: { dev: string | string[] } }
}

async function isPm2Online(name: string) {
  const list = await $`pm2 jlist`.json().catch(() => [])
  return list.some((p: any) => p?.name === name && p?.pm2_env?.status === 'online')
}

export default tool({
  description:
    'Ensures the development server is running. Syncs convex if needed and runs lint. Args: syncConvex (default false) to specify if convex should be synced.',
  args: { syncConvex: tool.schema.boolean().default(false) },
  async execute({ syncConvex }): Promise<string> {
    const cfg = await getSurgentConfig()
    const steps: string[] = []

    if (syncConvex) {
      await $`bun run convex:codegen`
      steps.push('Ran convex:codegen')
    }

    await $`bun run lint`
    steps.push('Ran lint')

    if (syncConvex) {
      await $`bun run convex:once`
      steps.push('Ran convex:once')
    }

    const commands = Array.isArray(cfg.scripts.dev) ? cfg.scripts.dev : [cfg.scripts.dev]
    for (let i = 0; i < commands.length; i++) {
      const name = commands.length > 1 ? `${cfg.name}:${i + 1}` : cfg.name
      if (await isPm2Online(name)) {
        steps.push(`${name} already online`)
      } else {
        await $`${{ raw: `pm2 start "${commands[i]}" --name ${name}` }}`
        steps.push(`Started ${name}`)
      }
    }

    return steps.join('\n')
  },
})
