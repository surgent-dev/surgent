import z from "zod";
import { Config } from "../config/config";
import { Instance } from "../project/instance";
import { NamedError } from "@opencode-ai/util/error";
import { ConfigMarkdown } from "../config/markdown";
import { Log } from "../util/log";

export namespace Skill {
  const log = Log.create({ service: "skill" });
  export const Info = z.object({
    name: z.string(),
    description: z.string(),
    location: z.string(),
  });
  export type Info = z.infer<typeof Info>;

  export const InvalidError = NamedError.create(
    "SkillInvalidError",
    z.object({
      path: z.string(),
      message: z.string().optional(),
      issues: z.custom<z.core.$ZodIssue[]>().optional(),
    }),
  );

  export const NameMismatchError = NamedError.create(
    "SkillNameMismatchError",
    z.object({
      path: z.string(),
      expected: z.string(),
      actual: z.string(),
    }),
  );

  const SKILL_GLOB = new Bun.Glob("{skill,skills}/**/SKILL.md");

  export const state = Instance.state(async () => {
    const directories = await Config.directories();
    const skills: Record<string, Info> = {};
    const sandbox = Instance.sandbox;

    for (const dir of directories) {
      const isWorkspaceDir = sandbox.contains(dir);
      try {
        for await (const match of SKILL_GLOB.scan({
          cwd: dir,
          absolute: true,
          onlyFiles: true,
          followSymlinks: true,
        })) {
          if (isWorkspaceDir && !sandbox.contains(match)) continue;
          const md = await ConfigMarkdown.parse(match);
          if (!md) {
            continue;
          }

          const parsed = Info.pick({ name: true, description: true }).safeParse(md.data);
          if (!parsed.success) continue;

          // Warn on duplicate skill names
          if (skills[parsed.data.name]) {
            log.warn("duplicate skill name", {
              name: parsed.data.name,
              existing: skills[parsed.data.name].location,
              duplicate: match,
            });
          }

          skills[parsed.data.name] = {
            name: parsed.data.name,
            description: parsed.data.description,
            location: match,
          };
        }
      } catch (error) {
        log.debug("skipping skill scan", { dir, error });
      }
    }

    return skills;
  });

  export async function get(name: string) {
    return state().then((x) => x[name]);
  }

  export async function all() {
    return state().then((x) => Object.values(x));
  }
}
