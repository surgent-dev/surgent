import { Log } from "@/util/log"
import { Context } from "../util/context"
import { Project } from "./project"
import { State } from "./state"
import { iife } from "@/util/iife"
import { GlobalBus } from "@/bus/global"
import { create as createSandbox, createDaytonaSandbox } from "@/sandbox"
import type { Sandbox } from "@/sandbox"

interface InstanceContext {
  directory: string
  project: Project.Info
  sandbox: Sandbox
  sandboxId?: string
}

const context = Context.create<InstanceContext>("instance")
const cache = new Map<string, Promise<InstanceContext>>()

function key(directory: string, sandboxId?: string) {
  return sandboxId ? `${directory}::${sandboxId}` : directory
}

export const Instance = {
  async provide<R>(input: {
    directory: string
    sandboxId?: string
    init?: () => Promise<any>
    fn: () => R
  }): Promise<R> {
    const cacheKey = key(input.directory, input.sandboxId)
    let existing = cache.get(cacheKey)

    if (!existing) {
      Log.Default.info("creating instance", {
        directory: input.directory,
        sandboxId: input.sandboxId,
      })

      existing = iife(async () => {
        const sandbox = input.sandboxId
          ? createDaytonaSandbox({ sandboxId: input.sandboxId, root: input.directory })
          : createSandbox(input.directory)

        const project = await Project.fromDirectory(input.directory, { sandbox })

        const ctx: InstanceContext = {
          directory: input.directory,
          project,
          sandbox,
          sandboxId: input.sandboxId,
        }

        await context.provide(ctx, () => input.init?.())
        return ctx
      })

      cache.set(cacheKey, existing)
    }

    return context.provide(await existing, () => input.fn())
  },

  get directory() {
    return context.use().directory
  },

  get project() {
    return context.use().project
  },

  get sandbox() {
    return context.use().sandbox
  },

  get sandboxId() {
    return context.use().sandboxId
  },

  state<S>(init: () => S, dispose?: (state: Awaited<S>) => Promise<void>): () => S {
    return State.create(() => {
      const { directory, sandboxId } = context.use()
      return key(directory, sandboxId)
    }, init, dispose)
  },

  async dispose() {
    const { directory, sandboxId } = context.use()
    const cacheKey = key(directory, sandboxId)

    Log.Default.info("disposing instance", { directory, sandboxId })

    await State.dispose(cacheKey)
    cache.delete(cacheKey)

    GlobalBus.emit("event", {
      directory,
      payload: {
        type: "server.instance.disposed",
        properties: { directory },
      },
    })
  },

  async disposeAll() {
    Log.Default.info("disposing all instances")

    for (const [, value] of cache) {
      const ctx = await value.catch(() => undefined)
      if (ctx) {
        await context.provide(ctx, () => Instance.dispose())
      }
    }

    cache.clear()
  },
}
