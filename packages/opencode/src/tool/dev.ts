import z from "zod"
import { Tool } from "./tool"
import { Instance } from "../project/instance"

export const DevTool = Tool.define("dev", {
  description: "Ensures the development server is running. Runs if dev server is not already running.",
  parameters: z.object({}),
  async execute() {
    const sandbox = Instance.sandbox
    const root = Instance.directory
    const cfg = await sandbox.fs.readText(sandbox.path.join(root, "surgent.json"))
      .then(JSON.parse)
      .catch(() => { throw new Error("surgent.json not found or invalid") })

    const name = cfg.name?.trim()
    const dev = cfg.scripts?.dev
    if (!name) throw new Error('Missing "name" in surgent.json')
    if (!dev) throw new Error('Missing "scripts.dev" in surgent.json')

    const shell = (await sandbox.proc.which("bash")) || (await sandbox.proc.which("sh")) || "/bin/sh"
    const run = (cmd: string) => sandbox.proc.run([shell, "-c", cmd], { cwd: root })

    const steps: string[] = []

    if (cfg.scripts?.lint) {
      const lint = await run(cfg.scripts.lint)
      if (lint.exitCode !== 0) throw new Error(lint.stderr || lint.stdout || "Lint failed")
      steps.push("Ran lint")
    }

    const pm2 = await run("pm2 jlist")
    if (pm2.exitCode !== 0) throw new Error(pm2.stderr || pm2.stdout || "pm2 jlist failed")

    const procs: { name?: string; pm2_env?: { status?: string } }[] = JSON.parse(pm2.stdout)
    const commands = Array.isArray(dev) ? dev : [dev]

    for (const [i, cmd] of commands.entries()) {
      const proc = commands.length > 1 ? `${name}:${i + 1}` : name
      if (procs.find((p) => p.name === proc)?.pm2_env?.status === "online") {
        steps.push(`Already online: ${proc}`)
        continue
      }
      await run(`pm2 start "${cmd}" --name ${proc}`)
      steps.push(`Started: ${proc}`)
    }

    return { title: "dev", output: steps.join("\n"), metadata: {} }
  },
})
