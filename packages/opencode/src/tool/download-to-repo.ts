import z from "zod"
import { Tool } from "./tool"
import { Instance } from "../project/instance"

export const DownloadToRepoTool = Tool.define("download-to-repo", {
  description: "Download a file from URL to project. targetPath must be relative (e.g. 'public/logo.png').",
  parameters: z.object({
    url: z.string().describe("Source URL to download from"),
    path: z.string().describe("Relative path in project (e.g. 'public/image.png')"),
  }),
  async execute(params) {
    const sandbox = Instance.sandbox
    const root = Instance.directory
    const target = params.path.trim()

    if (sandbox.path.isAbsolute(target)) throw new Error("path must be relative")

    const full = sandbox.path.resolve(root, target)
    if (!sandbox.contains(full)) throw new Error("path must be within project root")

    const result = await sandbox.proc.run(
      ["curl", "-fsSL", "--create-dirs", "-o", full, params.url.trim()],
      { cwd: root },
    )
    if (result.exitCode !== 0) throw new Error(result.stderr || result.stdout || "Download failed")

    return { title: target, output: `Downloaded to ${target}`, metadata: { filepath: full } }
  },
})
