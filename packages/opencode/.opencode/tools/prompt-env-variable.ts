import { tool } from '@opencode-ai/plugin'

export default tool({
  description:
    'Prompt user for input via UI dialog. Value gets stored as env variable on the backend (Convex Environment). It is used by backend functions in Convex.',
  args: {
    question: tool.schema.string().min(1).describe('Question to ask the user'),
    key: tool.schema.string().optional().describe("Env variable name to store response (e.g. 'API_KEY')"),
  },
  async execute({ question, key }): Promise<string> {
    const q = question.trim()
    const k = key?.trim()
    return JSON.stringify({
      title: k || 'prompt',
      output: k ? `Prompting: ${q}\nWill store as: ${k}` : `Prompting: ${q}. It is stored`,
      metadata: { type: 'prompt-env-variable', question: q, key: k },
    })
  },
})
