import z from "zod";
import { Tool } from "./tool";
import { Instance } from "../project/instance";

export const WriteToLocalEnvTool = Tool.define("write-to-local-env", {
  description: "Write env variables to .env file. Merges with existing values.",
  parameters: z.object({
    vars: z.record(z.string(), z.string()).describe("Key-value pairs to write"),
    file: z.string().optional().describe("Target file (default: .env.local)"),
  }),
  async execute(params) {
    const sandbox = Instance.sandbox;
    const root = Instance.directory;
    const file = params.file || ".env.local";
    const filepath = sandbox.path.resolve(root, file);

    if (!sandbox.contains(filepath)) throw new Error("File must be within project root");

    const existing: Record<string, string> = {};
    const content = await sandbox.fs.readText(filepath).catch(() => "");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq > 0) existing[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
    }

    const merged = { ...existing, ...params.vars };
    const output =
      Object.entries(merged)
        .map(([k, v]) => `${k}=${v}`)
        .join("\n") + "\n";
    await sandbox.fs.writeText(filepath, output);

    const keys = Object.keys(params.vars);
    return {
      title: file,
      output: `Wrote ${keys.length} var(s) to ${file}:\n${keys.map((k) => `  ${k}=***`).join("\n")}`,
      metadata: { filepath },
    };
  },
});
