import { tool } from '@opencode-ai/plugin'
import { $ } from 'bun'
import path from 'path'

export default tool({
  description:
    "Download a file from a URL and save it to the project. Use for downloading images, assets, or files. targetPath is relative to project root (e.g. 'public/logo.png', 'src/assets/image.jpg'). Do NOT use absolute paths.",
  args: {
    sourceUrl: tool.schema.string(),
    targetPath: tool.schema.string(),
  },
  async execute({ sourceUrl, targetPath }): Promise<string> {
    if (!sourceUrl?.trim()) return 'Missing sourceUrl'
    if (!targetPath?.trim()) return 'Missing targetPath'
    if (path.isAbsolute(targetPath)) return 'targetPath must be relative'

    await $`curl -L --create-dirs -o ${path.join(process.cwd(), targetPath)} ${sourceUrl}`
    return `Downloaded ${sourceUrl} to ${targetPath}`
  },
})
