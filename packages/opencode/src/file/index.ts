import { BusEvent } from "@/bus/bus-event"
import z from "zod"
import ignore from "ignore"
import { Log } from "../util/log"
import { Instance } from "../project/instance"
import { Ripgrep } from "./ripgrep"
import fuzzysort from "fuzzysort"

export namespace File {
  const log = Log.create({ service: "file" })

  export const Info = z
    .object({
      path: z.string(),
      added: z.number().int(),
      removed: z.number().int(),
      status: z.enum(["added", "deleted", "modified"]),
    })
    .meta({
      ref: "File",
    })

  export type Info = z.infer<typeof Info>

  export const Node = z
    .object({
      name: z.string(),
      path: z.string(),
      absolute: z.string(),
      type: z.enum(["file", "directory"]),
      ignored: z.boolean(),
    })
    .meta({
      ref: "FileNode",
    })
  export type Node = z.infer<typeof Node>

  export const Content = z
    .object({
      type: z.literal("text"),
      content: z.string(),
      encoding: z.literal("base64").optional(),
      mimeType: z.string().optional(),
    })
    .meta({
      ref: "FileContent",
    })
  export type Content = z.infer<typeof Content>

  async function shouldEncode(mime?: string): Promise<boolean> {
    const type = mime?.toLowerCase()
    log.info("shouldEncode", { type })
    if (!type) return false

    if (type.startsWith("text/")) return false
    if (type.includes("charset=")) return false

    const parts = type.split("/", 2)
    const top = parts[0]
    const rest = parts[1] ?? ""
    const sub = rest.split(";", 1)[0]

    const tops = ["image", "audio", "video", "font", "model", "multipart"]
    if (tops.includes(top)) return true

    const bins = [
      "zip",
      "gzip",
      "bzip",
      "compressed",
      "binary",
      "pdf",
      "msword",
      "powerpoint",
      "excel",
      "ogg",
      "exe",
      "dmg",
      "iso",
      "rar",
    ]
    if (bins.some((mark) => sub.includes(mark))) return true

    return false
  }

  export const Event = {
    Edited: BusEvent.define(
      "file.edited",
      z.object({
        file: z.string(),
      }),
    ),
  }

  export async function status() {
    const sandbox = Instance.sandbox
    const path = sandbox.path
    const diffOutput = await sandbox.proc
      .run(["git", "diff", "--numstat", "HEAD"], { cwd: Instance.directory })
      .then((result) => result.stdout)
      .catch(() => "")

    const changedFiles: Info[] = []

    if (diffOutput.trim()) {
      const lines = diffOutput.trim().split("\n")
      for (const line of lines) {
        const [added, removed, filepath] = line.split("\t")
        changedFiles.push({
          path: filepath,
          added: added === "-" ? 0 : parseInt(added, 10),
          removed: removed === "-" ? 0 : parseInt(removed, 10),
          status: "modified",
        })
      }
    }

    const untrackedOutput = await sandbox.proc
      .run(["git", "ls-files", "--others", "--exclude-standard"], { cwd: Instance.directory })
      .then((result) => result.stdout)
      .catch(() => "")

    if (untrackedOutput.trim()) {
      const untrackedFiles = untrackedOutput.trim().split("\n")
      for (const filepath of untrackedFiles) {
        try {
          const fullPath = path.resolve(filepath)
          const content = await sandbox.fs.readText(fullPath)
          const lines = content.split("\n").length
          changedFiles.push({
            path: filepath,
            added: lines,
            removed: 0,
            status: "added",
          })
        } catch {
          continue
        }
      }
    }

    // Get deleted files
    const deletedOutput = await sandbox.proc
      .run(["git", "diff", "--name-only", "--diff-filter=D", "HEAD"], { cwd: Instance.directory })
      .then((result) => result.stdout)
      .catch(() => "")

    if (deletedOutput.trim()) {
      const deletedFiles = deletedOutput.trim().split("\n")
      for (const filepath of deletedFiles) {
        changedFiles.push({
          path: filepath,
          added: 0,
          removed: 0, // Could get original line count but would require another git command
          status: "deleted",
        })
      }
    }

    return changedFiles.map((x) => ({
      ...x,
      path: path.relative(Instance.directory, x.path),
    }))
  }

  export async function read(file: string): Promise<Content> {
    using _ = log.time("read", { file })
    const sandbox = Instance.sandbox
    const full = sandbox.path.resolve(file)

    // TODO: Sandbox.contains is lexical only - symlinks inside the project can escape.
    // TODO: On Windows, cross-drive paths bypass this check. Consider realpath canonicalization.
    if (!sandbox.contains(full)) {
      throw new Error(`Access denied: path escapes project directory`)
    }

    if (!(await sandbox.fs.exists(full))) {
      return { type: "text", content: "" }
    }

    const mimeType = sandbox.fs.mime(full)
    const encode = await shouldEncode(mimeType)

    if (encode) {
      const buffer = await sandbox.fs.readBytes(full).catch(() => new Uint8Array(0))
      const content = Buffer.from(buffer).toString("base64")
      const mimeTypeOrDefault = mimeType || "application/octet-stream"
      return { type: "text", content, mimeType: mimeTypeOrDefault, encoding: "base64" }
    }

    const content = await sandbox.fs.readText(full).catch(() => "").then((x) => x.trim())

    return { type: "text", content }
  }

  export async function list(dir?: string) {
    const sandbox = Instance.sandbox
    const path = sandbox.path
    const exclude = [".git", ".DS_Store"]
    let ignored = (_: string) => false
    const ig = ignore()
    if (await sandbox.fs.exists(".gitignore")) {
      ig.add(await sandbox.fs.readText(".gitignore"))
    }
    if (await sandbox.fs.exists(".ignore")) {
      ig.add(await sandbox.fs.readText(".ignore"))
    }
    ignored = ig.ignores.bind(ig)
    const resolved = dir ? path.resolve(dir) : Instance.directory

    // TODO: Sandbox.contains is lexical only - symlinks inside the project can escape.
    // TODO: On Windows, cross-drive paths bypass this check. Consider realpath canonicalization.
    if (!sandbox.contains(resolved)) {
      throw new Error(`Access denied: path escapes project directory`)
    }

    const nodes: Node[] = []
    for (const entry of await sandbox.fs.readdir(resolved).catch(() => [])) {
      if (exclude.includes(entry.name)) continue
      const fullPath = entry.path
      const relativePath = path.relative(Instance.directory, fullPath)
      const type = entry.isDir ? "directory" : "file"
      nodes.push({
        name: entry.name,
        path: relativePath,
        absolute: fullPath,
        type,
        ignored: ignored(type === "directory" ? relativePath + "/" : relativePath),
      })
    }
    return nodes.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === "directory" ? -1 : 1
      }
      return a.name.localeCompare(b.name)
    })
  }

  export async function search(input: { query: string; limit?: number; dirs?: boolean }) {
    log.info("search", { query: input.query })
    const sandbox = Instance.sandbox
    const path = sandbox.path
    const limit = input.limit ?? 100
    const files = await Array.fromAsync(Ripgrep.files({ cwd: Instance.directory }))
    const dirs = [] as string[]
    if (input.dirs !== false) {
      const set = new Set<string>()
      for (const file of files) {
        let current = file
        while (true) {
          const dir = path.dirname(current)
          if (dir === ".") break
          if (dir === current) break
          current = dir
          if (set.has(dir)) continue
          set.add(dir)
          dirs.push(dir + "/")
        }
      }
    }
    if (!input.query) {
      return input.dirs !== false ? dirs.toSorted().slice(0, limit) : files.slice(0, limit)
    }
    const items = input.dirs !== false ? [...files, ...dirs] : files
    const sorted = fuzzysort.go(input.query, items, { limit }).map((r) => r.target)
    log.info("search", { query: input.query, results: sorted.length })
    return sorted
  }
}
