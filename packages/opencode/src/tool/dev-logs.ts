import z from "zod";
import { Tool } from "./tool";
import { Instance } from "../project/instance";

export const DevLogsTool = Tool.define("dev-logs", {
  description: "Show recent dev server logs. Use to debug errors. Default 20 lines.",
  parameters: z.object({
    lines: z.number().optional().describe("Number of log lines to show (default: 20)"),
  }),
  async execute(params) {
    const sandbox = Instance.sandbox;
    const root = Instance.directory;
    const cfg = await sandbox.fs
      .readText(sandbox.path.join(root, "surgent.json"))
      .then(JSON.parse)
      .catch(() => {
        throw new Error("surgent.json not found or invalid");
      });

    const name = cfg.name?.trim();
    if (!name) throw new Error('Missing "name" in surgent.json');

    const result = await sandbox.proc.run(["pm2", "logs", name, "--lines", String(params.lines ?? 20), "--nostream"], {
      cwd: root,
    });
    if (result.exitCode !== 0) throw new Error(result.stderr || result.stdout || "pm2 logs failed");

    return { title: name, output: result.stdout, metadata: {} };
  },
});
