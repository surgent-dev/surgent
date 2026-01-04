import z from "zod"
import { Storage } from "../storage/storage"
import { Log } from "../util/log"
import { Flag } from "@/flag/flag"
import { Session } from "../session"
import { work } from "../util/queue"
import { fn } from "@opencode-ai/util/fn"
import { BusEvent } from "@/bus/bus-event"
import { GlobalBus } from "@/bus/global"
import { create as createSandbox } from "@/sandbox"
import type { Sandbox } from "@/sandbox"

export namespace Project {
  const log = Log.create({ service: "project" })
  export const Info = z
    .object({
      id: z.string(),
      directory: z.string(),
      name: z.string().optional(),
      icon: z
        .object({
          url: z.string().optional(),
          color: z.string().optional(),
        })
        .optional(),
      time: z.object({
        created: z.number(),
        updated: z.number(),
        initialized: z.number().optional(),
      }),
    })
    .meta({
      ref: "Project",
    })
  export type Info = z.infer<typeof Info>

  export const Event = {
    Updated: BusEvent.define("project.updated", Info),
  }

  export async function fromDirectory(directory: string, options?: { sandbox?: Sandbox; sandboxId?: string }) {
    log.info("fromDirectory", { directory, sandboxId: options?.sandboxId })

    const directoryPath = directory
    const idSeed = options?.sandboxId ? `${directoryPath}::${options.sandboxId}` : directoryPath
    const id = `dir_${Bun.hash.xxHash32(idSeed).toString(16)}`

    let existing = await Storage.read<Info>(["project", id]).catch(() => undefined)
    if (!existing) {
      existing = {
        id,
        directory: directoryPath,
        time: {
          created: Date.now(),
          updated: Date.now(),
        },
      }
      if (id !== "global") {
        await migrateFromGlobal(id, directoryPath)
      }
    }
    if (Flag.OPENCODE_EXPERIMENTAL_ICON_DISCOVERY) discover(existing, options?.sandbox)
    const result: Info = {
      ...existing,
      directory: directoryPath,
      time: {
        ...existing.time,
        updated: Date.now(),
      },
    }
    await Storage.write<Info>(["project", id], result)
    GlobalBus.emit("event", {
      payload: {
        type: Event.Updated.type,
        properties: result,
      },
    })
    return result
  }

  export async function discover(input: Info, sandboxOverride?: Sandbox) {
    if (input.icon?.url) return
    const sandbox = sandboxOverride ?? createSandbox(input.directory)
    const glob = new Bun.Glob("**/{favicon}.{ico,png,svg,jpg,jpeg,webp}")
    let matches: string[] = []
    try {
      matches = await Array.fromAsync(
        glob.scan({
          cwd: input.directory,
          absolute: true,
          onlyFiles: true,
          followSymlinks: false,
          dot: false,
        }),
      )
    } catch {
      return
    }
    const shortest = matches.sort((a, b) => a.length - b.length)[0]
    if (!shortest) return
    if (!sandbox.contains(shortest)) return
    const buffer = await sandbox.fs.readBytes(shortest)
    const base64 = Buffer.from(buffer).toString("base64")
    const mime = sandbox.fs.mime(shortest) || "image/png"
    const url = `data:${mime};base64,${base64}`
    await update({
      projectID: input.id,
      icon: {
        url,
      },
    })
    return
  }

  async function migrateFromGlobal(newProjectID: string, directory: string) {
    const globalProject = await Storage.read<Info>(["project", "global"]).catch(() => undefined)
    if (!globalProject) return

    const globalSessions = await Storage.list(["session", "global"]).catch(() => [])
    if (globalSessions.length === 0) return

    log.info("migrating sessions from global", { newProjectID, directory, count: globalSessions.length })

    await work(10, globalSessions, async (key) => {
      const sessionID = key[key.length - 1]
      const session = await Storage.read<Session.Info>(key).catch(() => undefined)
      if (!session) return
      if (session.directory && session.directory !== directory) return

      session.projectID = newProjectID
      log.info("migrating session", { sessionID, from: "global", to: newProjectID })
      await Storage.write(["session", newProjectID, sessionID], session)
      await Storage.remove(key)
    }).catch((error) => {
      log.error("failed to migrate sessions from global to project", { error, projectId: newProjectID })
    })
  }

  export async function setInitialized(projectID: string) {
    await Storage.update<Info>(["project", projectID], (draft) => {
      draft.time.initialized = Date.now()
    })
  }

  export async function list() {
    const keys = await Storage.list(["project"])
    return await Promise.all(keys.map((x) => Storage.read<Info>(x)))
  }

  export const update = fn(
    z.object({
      projectID: z.string(),
      name: z.string().optional(),
      icon: Info.shape.icon.optional(),
    }),
    async (input) => {
      const result = await Storage.update<Info>(["project", input.projectID], (draft) => {
        if (input.name !== undefined) draft.name = input.name
        if (input.icon !== undefined) {
          draft.icon = {
            ...draft.icon,
          }
          if (input.icon.url !== undefined) draft.icon.url = input.icon.url
          if (input.icon.color !== undefined) draft.icon.color = input.icon.color
        }
        draft.time.updated = Date.now()
      })
      GlobalBus.emit("event", {
        payload: {
          type: Event.Updated.type,
          properties: result,
        },
      })
      return result
    },
  )
}
