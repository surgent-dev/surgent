import 'dotenv/config'
import { Template, defaultBuildLogger } from 'e2b'
import { devTemplate } from './template.dev'

const version = process.argv[2] || 'v0'

await Template.build(devTemplate, {
  alias: `surgent-dev-${version}`,
  cpuCount: 4,
  memoryMB: 4096,
  onBuildLogs: defaultBuildLogger(),
})
