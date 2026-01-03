import z from "zod"
import { Tool } from "./tool"
import { FileTime } from "../file/time"
import DESCRIPTION from "./read.txt"
import { Instance } from "../project/instance"
import { Identifier } from "../id/id"
import { Permission } from "../permission"
import { Agent } from "@/agent/agent"
import { iife } from "@/util/iife"

const DEFAULT_READ_LIMIT = 2000
const MAX_LINE_LENGTH = 2000

export const ReadTool = Tool.define("read", {
  description: DESCRIPTION,
  parameters: z.object({
    filePath: z.string().describe("The path to the file to read"),
    offset: z.coerce.number().describe("The line number to start reading from (0-based)").optional(),
    limit: z.coerce.number().describe("The number of lines to read (defaults to 2000)").optional(),
  }),
  async execute(params, ctx) {
    const sandbox = Instance.sandbox
    const path = sandbox.path
    let filepath = params.filePath
    if (!path.isAbsolute(filepath)) {
      filepath = path.resolve(filepath)
    }
    const title = path.relative(Instance.directory, filepath)
    const agent = await Agent.get(ctx.agent)

    if (!ctx.extra?.["bypassCwdCheck"] && !sandbox.contains(filepath)) {
      const parentDir = path.dirname(filepath)
      if (agent.permission.external_directory === "ask") {
        await Permission.ask({
          type: "external_directory",
          pattern: [parentDir, path.join(parentDir, "*")],
          sessionID: ctx.sessionID,
          messageID: ctx.messageID,
          callID: ctx.callID,
          title: `Access file outside working directory: ${filepath}`,
          metadata: {
            filepath,
            parentDir,
          },
        })
      } else if (agent.permission.external_directory === "deny") {
        throw new Permission.RejectedError(
          ctx.sessionID,
          "external_directory",
          ctx.callID,
          {
            filepath: filepath,
            parentDir,
          },
          `File ${filepath} is not in the current working directory`,
        )
      }
    }

    const block = iife(() => {
      const basename = path.basename(filepath)
      const whitelist = [".env.sample", ".env.example", ".example", ".env.template"]

      if (whitelist.some((w) => basename.endsWith(w))) return false
      // Block .env, .env.local, .env.production, etc. but not .envrc
      if (/^\.env(\.|$)/.test(basename)) return true

      return false
    })

    if (block) {
      throw new Error(`The user has blocked you from reading ${filepath}, DO NOT make further attempts to read it`)
    }

    const mime = sandbox.fs.mime(filepath)
    if (!(await sandbox.fs.exists(filepath))) {
      const dir = path.dirname(filepath)
      const base = path.basename(filepath)

      const dirEntries = await sandbox.fs.readdir(dir).catch(() => [])
      const suggestions = dirEntries
        .filter(
          (entry) =>
            entry.name.toLowerCase().includes(base.toLowerCase()) || base.toLowerCase().includes(entry.name.toLowerCase()),
        )
        .map((entry) => path.join(dir, entry.name))
        .slice(0, 3)

      if (suggestions.length > 0) {
        throw new Error(`File not found: ${filepath}\n\nDid you mean one of these?\n${suggestions.join("\n")}`)
      }

      throw new Error(`File not found: ${filepath}`)
    }

    const isImage = !!mime && mime.startsWith("image/") && mime !== "image/svg+xml"
    const isPdf = mime === "application/pdf"
    if (isImage || isPdf) {
      const msg = `${isImage ? "Image" : "PDF"} read successfully`
      const data = await sandbox.fs.readBytes(filepath)
      const mimeType = mime || "application/octet-stream"
      return {
        title,
        output: msg,
        metadata: {
          preview: msg,
        },
        attachments: [
          {
            id: Identifier.ascending("part"),
            sessionID: ctx.sessionID,
            messageID: ctx.messageID,
            type: "file",
            mime: mimeType,
            url: `data:${mimeType};base64,${Buffer.from(data).toString("base64")}`,
          },
        ],
      }
    }

    const isBinary = await isBinaryFile(filepath)
    if (isBinary) throw new Error(`Cannot read binary file: ${filepath}`)

    const limit = params.limit ?? DEFAULT_READ_LIMIT
    const offset = params.offset || 0
    const lines = await sandbox.fs.readText(filepath).then((text) => text.split("\n"))
    const raw = lines.slice(offset, offset + limit).map((line) => {
      return line.length > MAX_LINE_LENGTH ? line.substring(0, MAX_LINE_LENGTH) + "..." : line
    })
    const content = raw.map((line, index) => {
      return `${(index + offset + 1).toString().padStart(5, "0")}| ${line}`
    })
    const preview = raw.slice(0, 20).join("\n")

    let output = "<file>\n"
    output += content.join("\n")

    const totalLines = lines.length
    const lastReadLine = offset + content.length
    const hasMoreLines = totalLines > lastReadLine

    if (hasMoreLines) {
      output += `\n\n(File has more lines. Use 'offset' parameter to read beyond line ${lastReadLine})`
    } else {
      output += `\n\n(End of file - total ${totalLines} lines)`
    }
    output += "\n</file>"

    FileTime.read(ctx.sessionID, filepath)

    return {
      title,
      output,
      metadata: {
        preview,
      },
    }
  },
})

async function isBinaryFile(filepath: string): Promise<boolean> {
  const ext = Instance.sandbox.path.extname(filepath).toLowerCase()
  // binary check for common non-text extensions
  switch (ext) {
    case ".zip":
    case ".tar":
    case ".gz":
    case ".exe":
    case ".dll":
    case ".so":
    case ".class":
    case ".jar":
    case ".war":
    case ".7z":
    case ".doc":
    case ".docx":
    case ".xls":
    case ".xlsx":
    case ".ppt":
    case ".pptx":
    case ".odt":
    case ".ods":
    case ".odp":
    case ".bin":
    case ".dat":
    case ".obj":
    case ".o":
    case ".a":
    case ".lib":
    case ".wasm":
    case ".pyc":
    case ".pyo":
      return true
    default:
      break
  }

  const stat = await Instance.sandbox.fs.stat(filepath)
  const fileSize = stat.size
  if (fileSize === 0) return false

  const bufferSize = Math.min(4096, fileSize)
  const buffer = await Instance.sandbox.fs.readBytes(filepath)
  if (buffer.length === 0) return false
  const bytes = buffer.slice(0, bufferSize)

  let nonPrintableCount = 0
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 0) return true
    if (bytes[i] < 9 || (bytes[i] > 13 && bytes[i] < 32)) {
      nonPrintableCount++
    }
  }
  // If >30% non-printable characters, consider it binary
  return nonPrintableCount / bytes.length > 0.3
}
