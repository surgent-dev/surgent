import { Provider } from "@/provider/provider"

import { fn } from "@/util/fn"
import z from "zod"
import { Session } from "."

import { MessageV2 } from "./message-v2"
import { Log } from "@/util/log"

import { LLM } from "./llm"
import { Agent } from "@/agent/agent"

export namespace SessionSummary {
  const log = Log.create({ service: "session.summary" })

  export const summarize = fn(
    z.object({
      sessionID: z.string(),
      messageID: z.string(),
    }),
    async (input) => {
      const all = await Session.messages({ sessionID: input.sessionID })
      await Promise.all([
        summarizeSession({ sessionID: input.sessionID, messages: all }),
        summarizeMessage({ messageID: input.messageID, messages: all }),
      ])
    },
  )

  async function summarizeSession(input: { sessionID: string; messages: MessageV2.WithParts[] }) {
    await Session.update(input.sessionID, (draft) => {
      draft.summary = {
        additions: 0,
        deletions: 0,
        files: 0,
      }
    })
  }

  async function summarizeMessage(input: { messageID: string; messages: MessageV2.WithParts[] }) {
    const messages = input.messages.filter(
      (m) => m.info.id === input.messageID || (m.info.role === "assistant" && m.info.parentID === input.messageID),
    )
    const msgWithParts = messages.find((m) => m.info.id === input.messageID)!
    const userMsg = msgWithParts.info as MessageV2.User
    userMsg.summary = {
      ...userMsg.summary,
    }
    await Session.updateMessage(userMsg)

    const assistantMsg = messages.find((m) => m.info.role === "assistant")!.info as MessageV2.Assistant
    const small =
      (await Provider.getSmallModel(assistantMsg.providerID)) ??
      (await Provider.getModel(assistantMsg.providerID, assistantMsg.modelID))

    const textPart = msgWithParts.parts.find((p) => p.type === "text" && !p.synthetic) as MessageV2.TextPart
    if (textPart && !userMsg.summary?.title) {
      const agent = await Agent.get("title")
      const stream = await LLM.stream({
        agent,
        user: userMsg,
        tools: {},
        model: agent.model ? await Provider.getModel(agent.model.providerID, agent.model.modelID) : small,
        small: true,
        messages: [
          {
            role: "user" as const,
            content: `
              The following is the text to summarize:
              <text>
              ${textPart?.text ?? ""}
              </text>
            `,
          },
        ],
        abort: new AbortController().signal,
        sessionID: userMsg.sessionID,
        system: [],
        retries: 3,
      })
      const result = await stream.text
      log.info("title", { title: result })
      userMsg.summary.title = result
      await Session.updateMessage(userMsg)
    }

    if (
      messages.some(
        (m) =>
          m.info.role === "assistant" && m.parts.some((p) => p.type === "step-finish" && p.reason !== "tool-calls"),
      )
    ) {
      for (const msg of messages) {
        for (const part of msg.parts) {
          if (part.type === "tool" && part.state.status === "completed") {
            part.state.output = "[TOOL OUTPUT PRUNED]"
          }
        }
      }
      const summaryAgent = await Agent.get("summary")
      const stream = await LLM.stream({
        agent: summaryAgent,
        user: userMsg,
        tools: {},
        model: summaryAgent.model
          ? await Provider.getModel(summaryAgent.model.providerID, summaryAgent.model.modelID)
          : small,
        small: true,
        messages: [
          ...MessageV2.toModelMessage(messages),
          {
            role: "user" as const,
            content: `Summarize the above conversation according to your system prompts.`,
          },
        ],
        abort: new AbortController().signal,
        sessionID: userMsg.sessionID,
        system: [],
        retries: 3,
      })
      const result = await stream.text
      if (result) {
        userMsg.summary.body = result
      }
      await Session.updateMessage(userMsg)
    }
  }
}
