import { BashTool } from "./bash";
import { EditTool } from "./edit";
import { GlobTool } from "./glob";
import { GrepTool } from "./grep";
import { BatchTool } from "./batch";
import { ReadTool } from "./read";
import { TaskTool } from "./task";
import { TodoWriteTool, TodoReadTool } from "./todo";
import { WebFetchTool } from "./webfetch";
import { WriteTool } from "./write";
import { InvalidTool } from "./invalid";
import { SkillTool } from "./skill";
import { DevTool } from "./dev";
import { DevLogsTool } from "./dev-logs";
import { DownloadToRepoTool } from "./download-to-repo";
import { WriteToLocalEnvTool } from "./write-to-local-env";
import { PromptEnvVariableTool } from "./prompt-env-variable";
import type { Agent } from "../agent/agent";
import { Tool } from "./tool";
import { Instance } from "../project/instance";
import { Config } from "../config/config";
import path from "path";
import z from "zod";
import { WebSearchTool } from "./websearch";
import { CodeSearchTool } from "./codesearch";
import { Flag } from "../flag/flag";
import { Log } from "../util/log";
// TODO: Convex tools are WIP
// import {
//   ConvexCreateProjectTool,
//   ConvexDeleteProjectTool,
//   ConvexSetEnvVarsTool,
//   ConvexListEnvVarsTool,
//   ConvexCallQueryTool,
//   ConvexCallMutationTool,
// } from "./convex"

type ToolContext = Pick<Tool.Context, "sessionID" | "messageID" | "agent" | "abort">;

type ToolDefinition<Args extends z.ZodRawShape = z.ZodRawShape> = {
  description: string;
  args: Args;
  execute(args: z.infer<z.ZodObject<Args>>, context: ToolContext): Promise<string>;
};

export namespace ToolRegistry {
  const log = Log.create({ service: "tool.registry" });

  export const state = Instance.state(async () => {
    const custom = [] as Tool.Info[];
    const glob = new Bun.Glob("tool/*.{js,ts}");
    const sandbox = Instance.sandbox;

    for (const dir of await Config.directories()) {
      const isWorkspaceDir = sandbox.contains(dir);
      try {
        for await (const match of glob.scan({
          cwd: dir,
          absolute: true,
          followSymlinks: true,
          dot: true,
        })) {
          if (isWorkspaceDir && !sandbox.contains(match)) continue;
          const namespace = path.basename(match, path.extname(match));
          const mod = await import(match);
          for (const [id, def] of Object.entries<ToolDefinition>(mod)) {
            custom.push(fromToolDefinition(id === "default" ? namespace : `${namespace}_${id}`, def));
          }
        }
      } catch (error) {
        log.debug("skipping custom tool scan", { dir, error });
      }
    }

    return { custom };
  });

  function fromToolDefinition(id: string, def: ToolDefinition): Tool.Info {
    return {
      id,
      init: async () => ({
        parameters: z.object(def.args),
        description: def.description,
        execute: async (args, ctx) => {
          const result = await def.execute(args as any, ctx);
          return {
            title: "",
            output: result,
            metadata: {},
          };
        },
      }),
    };
  }

  export async function register(tool: Tool.Info) {
    const { custom } = await state();
    const idx = custom.findIndex((t) => t.id === tool.id);
    if (idx >= 0) {
      custom.splice(idx, 1, tool);
      return;
    }
    custom.push(tool);
  }

  async function all(): Promise<Tool.Info[]> {
    const custom = await state().then((x) => x.custom);
    const config = await Config.get();

    return [
      InvalidTool,
      BashTool,
      ReadTool,
      GlobTool,
      GrepTool,
      EditTool,
      WriteTool,
      TaskTool,
      WebFetchTool,
      TodoWriteTool,
      TodoReadTool,
      WebSearchTool,
      CodeSearchTool,
      SkillTool,
      DevTool,
      DevLogsTool,
      DownloadToRepoTool,
      WriteToLocalEnvTool,
      PromptEnvVariableTool,
      // TODO: Convex tools are WIP
      // ConvexCreateProjectTool,
      // ConvexDeleteProjectTool,
      // ConvexSetEnvVarsTool,
      // ConvexListEnvVarsTool,
      // ConvexCallQueryTool,
      // ConvexCallMutationTool,
      ...(config.experimental?.batch_tool === true ? [BatchTool] : []),
      ...custom,
    ];
  }

  export async function ids() {
    return all().then((x) => x.map((t) => t.id));
  }

  export async function tools(providerID: string, agent?: Agent.Info) {
    const tools = await all();
    const result = await Promise.all(
      tools
        .filter((t) => {
          // Enable websearch/codesearch for zen users OR via enable flag
          if (t.id === "codesearch" || t.id === "websearch") {
            return providerID === "opencode" || Flag.OPENCODE_ENABLE_EXA;
          }
          return true;
        })
        .map(async (t) => {
          using _ = log.time(t.id);
          return {
            id: t.id,
            ...(await t.init({ agent })),
          };
        }),
    );
    return result;
  }

  export async function enabled(agent: Agent.Info): Promise<Record<string, boolean>> {
    const result: Record<string, boolean> = {};

    if (agent.permission.edit === "deny") {
      result["edit"] = false;
      result["write"] = false;
    }
    if (agent.permission.bash["*"] === "deny" && Object.keys(agent.permission.bash).length === 1) {
      result["bash"] = false;
    }
    if (agent.permission.webfetch === "deny") {
      result["webfetch"] = false;
      result["codesearch"] = false;
      result["websearch"] = false;
    }
    // Disable skill tool if all skills are denied
    if (agent.permission.skill["*"] === "deny" && Object.keys(agent.permission.skill).length === 1) {
      result["skill"] = false;
    }

    return result;
  }
}
