import { tool } from '@opencode-ai/plugin'
import { $ } from 'bun'

export default tool({
  description:
    'Show the last N lines of dev server PM2 logs using pm2 logs. Args: lines (default 20) to specify the number of lines to show.',
  args: { lines: tool.schema.number().default(20) },
  async execute({ lines }): Promise<string> {
    const cfg = await Bun.file('surgent.json')
      .json()
      .catch(() => null)
    if (!cfg?.name) return 'Missing "name" in surgent.json'
    return $`pm2 logs ${cfg.name} --lines ${lines} --nostream`.text()
  },
})
