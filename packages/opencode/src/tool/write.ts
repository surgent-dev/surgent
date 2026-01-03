import z from "zod"
import { Tool } from "./tool"
import { Permission } from "../permission"
import DESCRIPTION from "./write.txt"
import { Bus } from "../bus"
import { File } from "../file"
import { FileTime } from "../file/time"
import { Instance } from "../project/instance"
import { Agent } from "../agent/agent"

export const WriteTool = Tool.define("write", {
  description: DESCRIPTION,
  parameters: z.object({
    content: z.string().describe("The content to write to the file"),
    filePath: z.string().describe("The absolute path to the file to write (must be absolute, not relative)"),
  }),
  async execute(params, ctx) {
    const agent = await Agent.get(ctx.agent)
    const filepath = Instance.sandbox.path.isAbsolute(params.filePath) ? params.filePath : Instance.sandbox.path.resolve(params.filePath)
    if (!Instance.sandbox.contains(filepath)) {
      const parentDir = Instance.sandbox.path.dirname(filepath)
      if (agent.permission.external_directory === "ask") {
        await Permission.ask({
          type: "external_directory",
          pattern: [parentDir, Instance.sandbox.path.join(parentDir, "*")],
          sessionID: ctx.sessionID,
          messageID: ctx.messageID,
          callID: ctx.callID,
          title: `Write file outside working directory: ${filepath}`,
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

    const exists = await Instance.sandbox.fs.exists(filepath)
    if (exists) await FileTime.assert(ctx.sessionID, filepath)

    if (agent.permission.edit === "ask")
      await Permission.ask({
        type: "write",
        sessionID: ctx.sessionID,
        messageID: ctx.messageID,
        callID: ctx.callID,
        title: exists ? "Overwrite this file: " + filepath : "Create new file: " + filepath,
        metadata: {
          filePath: filepath,
          content: params.content,
          exists,
        },
      })

    await Instance.sandbox.fs.writeText(filepath, params.content)
    await Bus.publish(File.Event.Edited, {
      file: filepath,
    })
    FileTime.read(ctx.sessionID, filepath)

    return {
      title: Instance.sandbox.path.relative(Instance.directory, filepath),
      metadata: {
        filepath,
        exists: exists,
      },
      output: "",
    }
  },
})
