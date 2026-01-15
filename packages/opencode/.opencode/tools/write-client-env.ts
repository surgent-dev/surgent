import { tool } from '@opencode-ai/plugin'
import { parse } from 'dotenv'
import path from 'path'

const stringify = (obj: Record<string, string>) =>
  Object.entries(obj)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n') + '\n'

export default tool({
  description: 'Write client-side env variables to .env. Merges with existing values.',
  args: {
    vars: tool.schema.record(tool.schema.string(), tool.schema.string()).describe('Key-value pairs'),
    file: tool.schema.string().optional().describe('Target file (default: .env)'),
  },
  async execute({ vars, file = '.env' }): Promise<string> {
    const filepath = path.join(process.cwd(), file)
    const content = await Bun.file(filepath)
      .text()
      .catch(() => '')

    await Bun.write(filepath, stringify({ ...parse(content), ...vars }))

    return `Wrote ${Object.keys(vars).length} var(s) to ${file}`
  },
})
