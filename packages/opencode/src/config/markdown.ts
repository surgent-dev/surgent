import { NamedError } from "@opencode-ai/util/error"
import matter from "gray-matter"
import { z } from "zod"
import { Instance } from "../project/instance"

export namespace ConfigMarkdown {
  export const FILE_REGEX = /(?<![\w`])@(\.?[^\s`,.]*(?:\.[^\s`,.]+)*)/g
  export const SHELL_REGEX = /!`([^`]+)`/g

  export function files(template: string) {
    return Array.from(template.matchAll(FILE_REGEX))
  }

  export function shell(template: string) {
    return Array.from(template.matchAll(SHELL_REGEX))
  }

  export async function parse(filePath: string) {
    const sandbox = Instance.sandbox
    const path = sandbox.path
    const resolved = path.isAbsolute(filePath) ? filePath : path.resolve(filePath)
    const template = await (sandbox.contains(resolved) ? sandbox.fs.readText(resolved) : Bun.file(resolved).text())

    try {
      const md = matter(template)
      return md
    } catch (err) {
      throw new FrontmatterError(
        {
          path: resolved,
          message: `Failed to parse YAML frontmatter: ${err instanceof Error ? err.message : String(err)}`,
        },
        { cause: err },
      )
    }
  }

  export const FrontmatterError = NamedError.create(
    "ConfigFrontmatterError",
    z.object({
      path: z.string(),
      message: z.string(),
    }),
  )
}
