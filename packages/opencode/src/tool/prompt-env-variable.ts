import z from "zod"
import { Tool } from "./tool"

export const PromptEnvVariableTool = Tool.define("prompt-env-variable", {
  description: "Prompt user for input via UI dialog. Value gets stored as env variable on the backend (Convex Environment). It is used by backend functions in Convex.",
  parameters: z.object({
    question: z.string().min(1).describe("Question to ask the user"),
    key: z.string().optional().describe("Env variable name to store response (e.g. 'API_KEY')"),
  }),
  async execute(params) {
    const question = params.question.trim()
    const key = params.key?.trim()

    return {
      title: key || "prompt",
      output: key ? `Prompting: ${question}\nWill store as: ${key}` : `Prompting: ${question}. It is stored`,
      metadata: { type: "prompt-env-variable", question, key },
    }
  },
})
