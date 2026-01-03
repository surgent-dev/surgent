import { Log } from "../util/log"
import path from "path"
import os from "os"
import z from "zod"
import { ModelsDev } from "../provider/models"
import { mergeDeep, pipe } from "remeda"
import { Global } from "../global"
import fs from "fs/promises"
import { lazy } from "../util/lazy"
import { NamedError } from "@opencode-ai/util/error"
import { Flag } from "../flag/flag"
import { type ParseError as JsoncParseError, parse as parseJsonc, printParseErrorCode } from "jsonc-parser"
import { Instance } from "../project/instance"

export namespace Config {
  const log = Log.create({ service: "config" })

  export const state = Instance.state(async () => {
    let result = await global()

    // Override with custom config if provided
    if (Flag.OPENCODE_CONFIG) {
      result = mergeDeep(result, await loadFile(Flag.OPENCODE_CONFIG))
      log.debug("loaded custom config", { path: Flag.OPENCODE_CONFIG })
    }

    for (const file of ["opencode.jsonc", "opencode.json"]) {
      result = mergeDeep(result, await loadFile(path.join(Instance.directory, file)))
    }

    if (Flag.OPENCODE_CONFIG_CONTENT) {
      result = mergeDeep(result, JSON.parse(Flag.OPENCODE_CONFIG_CONTENT))
      log.debug("loaded custom config from OPENCODE_CONFIG_CONTENT")
    }

    result.agent = result.agent || {}
    result.mode = result.mode || {}

    const directories = [Global.Path.config, Instance.directory]

    // Migrate deprecated mode field to agent field
    for (const [name, mode] of Object.entries(result.mode)) {
      result.agent = mergeDeep(result.agent ?? {}, {
        [name]: {
          ...mode,
          mode: "primary" as const,
        },
      })
    }

    if (Flag.OPENCODE_PERMISSION) {
      result.permission = mergeDeep(result.permission ?? {}, JSON.parse(Flag.OPENCODE_PERMISSION))
    }

    if (!result.username) result.username = os.userInfo().username

    if (!result.keybinds) result.keybinds = Info.shape.keybinds.parse({})

    // Apply flag overrides for compaction settings
    if (Flag.OPENCODE_DISABLE_AUTOCOMPACT) {
      result.compaction = { ...result.compaction, auto: false }
    }
    if (Flag.OPENCODE_DISABLE_PRUNE) {
      result.compaction = { ...result.compaction, prune: false }
    }

    return {
      config: result,
      directories,
    }
  })


  export const McpLocal = z
    .object({
      type: z.literal("local").describe("Type of MCP server connection"),
      command: z.string().array().describe("Command and arguments to run the MCP server"),
      environment: z
        .record(z.string(), z.string())
        .optional()
        .describe("Environment variables to set when running the MCP server"),
      enabled: z.boolean().optional().describe("Enable or disable the MCP server on startup"),
      timeout: z
        .number()
        .int()
        .positive()
        .optional()
        .describe(
          "Timeout in ms for fetching tools from the MCP server. Defaults to 5000 (5 seconds) if not specified.",
        ),
    })
    .strict()
    .meta({
      ref: "McpLocalConfig",
    })

  export const McpOAuth = z
    .object({
      clientId: z
        .string()
        .optional()
        .describe("OAuth client ID. If not provided, dynamic client registration (RFC 7591) will be attempted."),
      clientSecret: z.string().optional().describe("OAuth client secret (if required by the authorization server)"),
      scope: z.string().optional().describe("OAuth scopes to request during authorization"),
    })
    .strict()
    .meta({
      ref: "McpOAuthConfig",
    })
  export type McpOAuth = z.infer<typeof McpOAuth>

  export const McpRemote = z
    .object({
      type: z.literal("remote").describe("Type of MCP server connection"),
      url: z.string().describe("URL of the remote MCP server"),
      enabled: z.boolean().optional().describe("Enable or disable the MCP server on startup"),
      headers: z.record(z.string(), z.string()).optional().describe("Headers to send with the request"),
      oauth: z
        .union([McpOAuth, z.literal(false)])
        .optional()
        .describe(
          "OAuth authentication configuration for the MCP server. Set to false to disable OAuth auto-detection.",
        ),
      timeout: z
        .number()
        .int()
        .positive()
        .optional()
        .describe(
          "Timeout in ms for fetching tools from the MCP server. Defaults to 5000 (5 seconds) if not specified.",
        ),
    })
    .strict()
    .meta({
      ref: "McpRemoteConfig",
    })

  export const Mcp = z.discriminatedUnion("type", [McpLocal, McpRemote])
  export type Mcp = z.infer<typeof Mcp>

  export const Permission = z.enum(["ask", "allow", "deny"])
  export type Permission = z.infer<typeof Permission>

  export const Command = z.object({
    template: z.string(),
    description: z.string().optional(),
    agent: z.string().optional(),
    model: z.string().optional(),
    subtask: z.boolean().optional(),
  })
  export type Command = z.infer<typeof Command>

  export const Agent = z
    .object({
      model: z.string().optional(),
      temperature: z.number().optional(),
      top_p: z.number().optional(),
      prompt: z.string().optional(),
      tools: z.record(z.string(), z.boolean()).optional(),
      disable: z.boolean().optional(),
      description: z.string().optional().describe("Description of when to use the agent"),
      mode: z.enum(["subagent", "primary", "all"]).optional(),
      color: z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/, "Invalid hex color format")
        .optional()
        .describe("Hex color code for the agent (e.g., #FF5733)"),
      maxSteps: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Maximum number of agentic iterations before forcing text-only response"),
      permission: z
        .object({
          edit: Permission.optional(),
          bash: z.union([Permission, z.record(z.string(), Permission)]).optional(),
          skill: z.union([Permission, z.record(z.string(), Permission)]).optional(),
          webfetch: Permission.optional(),
          doom_loop: Permission.optional(),
          external_directory: Permission.optional(),
        })
        .optional(),
    })
    .catchall(z.any())
    .meta({
      ref: "AgentConfig",
    })
  export type Agent = z.infer<typeof Agent>

  export const Keybinds = z
    .object({
      leader: z.string().optional().default("ctrl+x").describe("Leader key for keybind combinations"),
      app_exit: z.string().optional().default("ctrl+c,ctrl+d,<leader>q").describe("Exit the application"),
      editor_open: z.string().optional().default("<leader>e").describe("Open external editor"),
      theme_list: z.string().optional().default("<leader>t").describe("List available themes"),
      sidebar_toggle: z.string().optional().default("<leader>b").describe("Toggle sidebar"),
      scrollbar_toggle: z.string().optional().default("none").describe("Toggle session scrollbar"),
      username_toggle: z.string().optional().default("none").describe("Toggle username visibility"),
      status_view: z.string().optional().default("<leader>s").describe("View status"),
      session_export: z.string().optional().default("<leader>x").describe("Export session to editor"),
      session_new: z.string().optional().default("<leader>n").describe("Create a new session"),
      session_list: z.string().optional().default("<leader>l").describe("List all sessions"),
      session_timeline: z.string().optional().default("<leader>g").describe("Show session timeline"),
      session_fork: z.string().optional().default("none").describe("Fork session from message"),
      session_rename: z.string().optional().default("none").describe("Rename session"),
      session_interrupt: z.string().optional().default("escape").describe("Interrupt current session"),
      session_compact: z.string().optional().default("<leader>c").describe("Compact the session"),
      messages_page_up: z.string().optional().default("pageup").describe("Scroll messages up by one page"),
      messages_page_down: z.string().optional().default("pagedown").describe("Scroll messages down by one page"),
      messages_half_page_up: z.string().optional().default("ctrl+alt+u").describe("Scroll messages up by half page"),
      messages_half_page_down: z
        .string()
        .optional()
        .default("ctrl+alt+d")
        .describe("Scroll messages down by half page"),
      messages_first: z.string().optional().default("ctrl+g,home").describe("Navigate to first message"),
      messages_last: z.string().optional().default("ctrl+alt+g,end").describe("Navigate to last message"),
      messages_next: z.string().optional().default("none").describe("Navigate to next message"),
      messages_previous: z.string().optional().default("none").describe("Navigate to previous message"),
      messages_last_user: z.string().optional().default("none").describe("Navigate to last user message"),
      messages_copy: z.string().optional().default("<leader>y").describe("Copy message"),
      messages_undo: z.string().optional().default("<leader>u").describe("Undo message"),
      messages_redo: z.string().optional().default("<leader>r").describe("Redo message"),
      messages_toggle_conceal: z
        .string()
        .optional()
        .default("<leader>h")
        .describe("Toggle code block concealment in messages"),
      tool_details: z.string().optional().default("none").describe("Toggle tool details visibility"),
      model_list: z.string().optional().default("<leader>m").describe("List available models"),
      model_cycle_recent: z.string().optional().default("f2").describe("Next recently used model"),
      model_cycle_recent_reverse: z.string().optional().default("shift+f2").describe("Previous recently used model"),
      model_cycle_favorite: z.string().optional().default("none").describe("Next favorite model"),
      model_cycle_favorite_reverse: z.string().optional().default("none").describe("Previous favorite model"),
      command_list: z.string().optional().default("ctrl+p").describe("List available commands"),
      agent_list: z.string().optional().default("<leader>a").describe("List agents"),
      agent_cycle: z.string().optional().default("tab").describe("Next agent"),
      agent_cycle_reverse: z.string().optional().default("shift+tab").describe("Previous agent"),
      input_clear: z.string().optional().default("ctrl+c").describe("Clear input field"),
      input_paste: z.string().optional().default("ctrl+v").describe("Paste from clipboard"),
      input_submit: z.string().optional().default("return").describe("Submit input"),
      input_newline: z
        .string()
        .optional()
        .default("shift+return,ctrl+return,alt+return,ctrl+j")
        .describe("Insert newline in input"),
      input_move_left: z.string().optional().default("left,ctrl+b").describe("Move cursor left in input"),
      input_move_right: z.string().optional().default("right,ctrl+f").describe("Move cursor right in input"),
      input_move_up: z.string().optional().default("up").describe("Move cursor up in input"),
      input_move_down: z.string().optional().default("down").describe("Move cursor down in input"),
      input_select_left: z.string().optional().default("shift+left").describe("Select left in input"),
      input_select_right: z.string().optional().default("shift+right").describe("Select right in input"),
      input_select_up: z.string().optional().default("shift+up").describe("Select up in input"),
      input_select_down: z.string().optional().default("shift+down").describe("Select down in input"),
      input_line_home: z.string().optional().default("ctrl+a").describe("Move to start of line in input"),
      input_line_end: z.string().optional().default("ctrl+e").describe("Move to end of line in input"),
      input_select_line_home: z
        .string()
        .optional()
        .default("ctrl+shift+a")
        .describe("Select to start of line in input"),
      input_select_line_end: z.string().optional().default("ctrl+shift+e").describe("Select to end of line in input"),
      input_visual_line_home: z.string().optional().default("alt+a").describe("Move to start of visual line in input"),
      input_visual_line_end: z.string().optional().default("alt+e").describe("Move to end of visual line in input"),
      input_select_visual_line_home: z
        .string()
        .optional()
        .default("alt+shift+a")
        .describe("Select to start of visual line in input"),
      input_select_visual_line_end: z
        .string()
        .optional()
        .default("alt+shift+e")
        .describe("Select to end of visual line in input"),
      input_buffer_home: z.string().optional().default("home").describe("Move to start of buffer in input"),
      input_buffer_end: z.string().optional().default("end").describe("Move to end of buffer in input"),
      input_select_buffer_home: z
        .string()
        .optional()
        .default("shift+home")
        .describe("Select to start of buffer in input"),
      input_select_buffer_end: z.string().optional().default("shift+end").describe("Select to end of buffer in input"),
      input_delete_line: z.string().optional().default("ctrl+shift+d").describe("Delete line in input"),
      input_delete_to_line_end: z.string().optional().default("ctrl+k").describe("Delete to end of line in input"),
      input_delete_to_line_start: z.string().optional().default("ctrl+u").describe("Delete to start of line in input"),
      input_backspace: z.string().optional().default("backspace,shift+backspace").describe("Backspace in input"),
      input_delete: z.string().optional().default("ctrl+d,delete,shift+delete").describe("Delete character in input"),
      input_undo: z.string().optional().default("ctrl+-,super+z").describe("Undo in input"),
      input_redo: z.string().optional().default("ctrl+.,super+shift+z").describe("Redo in input"),
      input_word_forward: z
        .string()
        .optional()
        .default("alt+f,alt+right,ctrl+right")
        .describe("Move word forward in input"),
      input_word_backward: z
        .string()
        .optional()
        .default("alt+b,alt+left,ctrl+left")
        .describe("Move word backward in input"),
      input_select_word_forward: z
        .string()
        .optional()
        .default("alt+shift+f,alt+shift+right")
        .describe("Select word forward in input"),
      input_select_word_backward: z
        .string()
        .optional()
        .default("alt+shift+b,alt+shift+left")
        .describe("Select word backward in input"),
      input_delete_word_forward: z
        .string()
        .optional()
        .default("alt+d,alt+delete,ctrl+delete")
        .describe("Delete word forward in input"),
      input_delete_word_backward: z
        .string()
        .optional()
        .default("ctrl+w,ctrl+backspace,alt+backspace")
        .describe("Delete word backward in input"),
      history_previous: z.string().optional().default("up").describe("Previous history item"),
      history_next: z.string().optional().default("down").describe("Next history item"),
      session_child_cycle: z.string().optional().default("<leader>right").describe("Next child session"),
      session_child_cycle_reverse: z.string().optional().default("<leader>left").describe("Previous child session"),
      session_parent: z.string().optional().default("<leader>up").describe("Go to parent session"),
      terminal_suspend: z.string().optional().default("ctrl+z").describe("Suspend terminal"),
      terminal_title_toggle: z.string().optional().default("none").describe("Toggle terminal title"),
      tips_toggle: z.string().optional().default("<leader>h").describe("Toggle tips on home screen"),
    })
    .strict()
    .meta({
      ref: "KeybindsConfig",
    })

  export const TUI = z.object({
    scroll_speed: z.number().min(0.001).optional().describe("TUI scroll speed"),
    scroll_acceleration: z
      .object({
        enabled: z.boolean().describe("Enable scroll acceleration"),
      })
      .optional()
      .describe("Scroll acceleration settings"),
    diff_style: z
      .enum(["auto", "stacked"])
      .optional()
      .describe("Control diff rendering style: 'auto' adapts to terminal width, 'stacked' always shows single column"),
  })

  export const Layout = z.enum(["auto", "stretch"]).meta({
    ref: "LayoutConfig",
  })
  export type Layout = z.infer<typeof Layout>

  export const Provider = ModelsDev.Provider.partial()
    .extend({
      whitelist: z.array(z.string()).optional(),
      blacklist: z.array(z.string()).optional(),
      models: z.record(z.string(), ModelsDev.Model.partial()).optional(),
      options: z
        .object({
          apiKey: z.string().optional(),
          baseURL: z.string().optional(),
          enterpriseUrl: z.string().optional().describe("GitHub Enterprise URL for copilot authentication"),
          setCacheKey: z.boolean().optional().describe("Enable promptCacheKey for this provider (default false)"),
          timeout: z
            .union([
              z
                .number()
                .int()
                .positive()
                .describe(
                  "Timeout in milliseconds for requests to this provider. Default is 300000 (5 minutes). Set to false to disable timeout.",
                ),
              z.literal(false).describe("Disable timeout for this provider entirely."),
            ])
            .optional()
            .describe(
              "Timeout in milliseconds for requests to this provider. Default is 300000 (5 minutes). Set to false to disable timeout.",
            ),
        })
        .catchall(z.any())
        .optional(),
    })
    .strict()
    .meta({
      ref: "ProviderConfig",
    })
  export type Provider = z.infer<typeof Provider>

  export const Info = z
    .object({
      $schema: z.string().optional().describe("JSON schema reference for configuration validation"),
      theme: z.string().optional().describe("Theme name to use for the interface"),
      keybinds: Keybinds.optional().describe("Custom keybind configurations"),
      logLevel: Log.Level.optional().describe("Log level"),
      tui: TUI.optional().describe("TUI specific settings"),
      command: z
        .record(z.string(), Command)
        .optional()
        .describe("Command configuration, see https://opencode.ai/docs/commands"),
      autoupdate: z
        .union([z.boolean(), z.literal("notify")])
        .optional()
        .describe(
          "Automatically update to the latest version. Set to true to auto-update, false to disable, or 'notify' to show update notifications",
        ),
      disabled_providers: z.array(z.string()).optional().describe("Disable providers that are loaded automatically"),
      enabled_providers: z
        .array(z.string())
        .optional()
        .describe("When set, ONLY these providers will be enabled. All other providers will be ignored"),
      model: z.string().describe("Model to use in the format of provider/model, eg anthropic/claude-2").optional(),
      small_model: z
        .string()
        .describe("Small model to use for tasks like title generation in the format of provider/model")
        .optional(),
      default_agent: z
        .string()
        .optional()
        .describe(
          "Default agent to use when none is specified. Must be a primary agent. Falls back to 'build' if not set or if the specified agent is invalid.",
        ),
      username: z
        .string()
        .optional()
        .describe("Custom username to display in conversations instead of system username"),
      mode: z
        .object({
          build: Agent.optional(),
          plan: Agent.optional(),
        })
        .catchall(Agent)
        .optional()
        .describe("@deprecated Use `agent` field instead."),
      agent: z
        .object({
          // primary
          plan: Agent.optional(),
          build: Agent.optional(),
          // subagent
          general: Agent.optional(),
          explore: Agent.optional(),
          // specialized
          title: Agent.optional(),
          summary: Agent.optional(),
          compaction: Agent.optional(),
        })
        .catchall(Agent)
        .optional()
        .describe("Agent configuration, see https://opencode.ai/docs/agent"),
      provider: z
        .record(z.string(), Provider)
        .optional()
        .describe("Custom provider configurations and model overrides"),
      mcp: z.record(z.string(), Mcp).optional().describe("MCP (Model Context Protocol) server configurations"),
      instructions: z.array(z.string()).optional().describe("Additional instruction files or patterns to include"),
      layout: Layout.optional().describe("@deprecated Always uses stretch layout."),
      permission: z
        .object({
          edit: Permission.optional(),
          bash: z.union([Permission, z.record(z.string(), Permission)]).optional(),
          skill: z.union([Permission, z.record(z.string(), Permission)]).optional(),
          webfetch: Permission.optional(),
          doom_loop: Permission.optional(),
          external_directory: Permission.optional(),
        })
        .optional(),
      tools: z.record(z.string(), z.boolean()).optional(),
      enterprise: z
        .object({
          url: z.string().optional().describe("Enterprise URL"),
        })
        .optional(),
      compaction: z
        .object({
          auto: z.boolean().optional().describe("Enable automatic compaction when context is full (default: true)"),
          prune: z.boolean().optional().describe("Enable pruning of old tool outputs (default: true)"),
        })
        .optional(),
      experimental: z
        .object({
          hook: z
            .object({
              file_edited: z
                .record(
                  z.string(),
                  z
                    .object({
                      command: z.string().array(),
                      environment: z.record(z.string(), z.string()).optional(),
                    })
                    .array(),
                )
                .optional(),
              session_completed: z
                .object({
                  command: z.string().array(),
                  environment: z.record(z.string(), z.string()).optional(),
                })
                .array()
                .optional(),
            })
            .optional(),
          chatMaxRetries: z.number().optional().describe("Number of retries for chat completions on failure"),
          disable_paste_summary: z.boolean().optional(),
          batch_tool: z.boolean().optional().describe("Enable the batch tool"),
          openTelemetry: z
            .boolean()
            .optional()
            .describe("Enable OpenTelemetry spans for AI SDK calls (using the 'experimental_telemetry' flag)"),
          primary_tools: z
            .array(z.string())
            .optional()
            .describe("Tools that should only be available to primary agents."),
          continue_loop_on_deny: z.boolean().optional().describe("Continue the agent loop when a tool call is denied"),
        })
        .optional(),
    })
    .strict()
    .meta({
      ref: "Config",
    })

  export type Info = z.output<typeof Info>

  export const global = lazy(async () => {
    let result: Info = pipe(
      {},
      mergeDeep(await loadFile(path.join(Global.Path.config, "config.json"))),
      mergeDeep(await loadFile(path.join(Global.Path.config, "opencode.json"))),
      mergeDeep(await loadFile(path.join(Global.Path.config, "opencode.jsonc"))),
    )

    await import(path.join(Global.Path.config, "config"), {
      with: {
        type: "toml",
      },
    })
      .then(async (mod) => {
        const { provider, model, ...rest } = mod.default
        if (provider && model) result.model = `${provider}/${model}`
        result["$schema"] = "https://opencode.ai/config.json"
        result = mergeDeep(result, rest)
        await Bun.write(path.join(Global.Path.config, "config.json"), JSON.stringify(result, null, 2))
        await fs.unlink(path.join(Global.Path.config, "config"))
      })
      .catch(() => {})

    return result
  })

  async function readText(filepath: string): Promise<string> {
    const sandbox = Instance.sandbox
    if (sandbox.contains(filepath)) return sandbox.fs.readText(filepath)
    return Bun.file(filepath).text()
  }

  async function writeText(filepath: string, content: string): Promise<void> {
    const sandbox = Instance.sandbox
    if (sandbox.contains(filepath)) return sandbox.fs.writeText(filepath, content)
    await Bun.write(filepath, content)
  }

  async function loadFile(filepath: string): Promise<Info> {
    log.info("loading", { path: filepath })
    let text = await readText(filepath)
      .catch((err) => {
        if (err.code === "ENOENT") return
        throw new JsonError({ path: filepath }, { cause: err })
      })
    if (!text) return {}
    return load(text, filepath)
  }

  async function load(text: string, configFilepath: string) {
    text = text.replace(/\{env:([^}]+)\}/g, (_, varName) => {
      return process.env[varName] || ""
    })

    const fileMatches = text.match(/\{file:[^}]+\}/g)
    if (fileMatches) {
      const configDir = path.dirname(configFilepath)
      const lines = text.split("\n")

      for (const match of fileMatches) {
        const lineIndex = lines.findIndex((line) => line.includes(match))
        if (lineIndex !== -1 && lines[lineIndex].trim().startsWith("//")) {
          continue // Skip if line is commented
        }
        let filePath = match.replace(/^\{file:/, "").replace(/\}$/, "")
        if (filePath.startsWith("~/")) {
          filePath = path.join(os.homedir(), filePath.slice(2))
        }
        const resolvedPath = path.isAbsolute(filePath) ? filePath : path.resolve(configDir, filePath)
        const fileContent = (
          await readText(resolvedPath).catch((error) => {
            const errMsg = `bad file reference: "${match}"`
            if (error.code === "ENOENT") {
              throw new InvalidError(
                {
                  path: configFilepath,
                  message: errMsg + ` ${resolvedPath} does not exist`,
                },
                { cause: error },
              )
            }
            throw new InvalidError({ path: configFilepath, message: errMsg }, { cause: error })
          })
        ).trim()
        // escape newlines/quotes, strip outer quotes
        text = text.replace(match, JSON.stringify(fileContent).slice(1, -1))
      }
    }

    const errors: JsoncParseError[] = []
    const data = parseJsonc(text, errors, { allowTrailingComma: true })
    if (errors.length) {
      const lines = text.split("\n")
      const errorDetails = errors
        .map((e) => {
          const beforeOffset = text.substring(0, e.offset).split("\n")
          const line = beforeOffset.length
          const column = beforeOffset[beforeOffset.length - 1].length + 1
          const problemLine = lines[line - 1]

          const error = `${printParseErrorCode(e.error)} at line ${line}, column ${column}`
          if (!problemLine) return error

          return `${error}\n   Line ${line}: ${problemLine}\n${"".padStart(column + 9)}^`
        })
        .join("\n")

      throw new JsonError({
        path: configFilepath,
        message: `\n--- JSONC Input ---\n${text}\n--- Errors ---\n${errorDetails}\n--- End ---`,
      })
    }

    const parsed = Info.safeParse(data)
    if (parsed.success) {
      if (!parsed.data.$schema) {
        parsed.data.$schema = "https://opencode.ai/config.json"
        await writeText(configFilepath, JSON.stringify(parsed.data, null, 2))
      }
      const data = parsed.data
      return data
    }

    throw new InvalidError({
      path: configFilepath,
      issues: parsed.error.issues,
    })
  }
  export const JsonError = NamedError.create(
    "ConfigJsonError",
    z.object({
      path: z.string(),
      message: z.string().optional(),
    }),
  )

  export const InvalidError = NamedError.create(
    "ConfigInvalidError",
    z.object({
      path: z.string(),
      issues: z.custom<z.core.$ZodIssue[]>().optional(),
      message: z.string().optional(),
    }),
  )

  export async function get() {
    return state().then((x) => x.config)
  }

  export async function update(config: Info) {
    const filepath = path.join(Instance.directory, "config.json")
    const existing = await loadFile(filepath)
    await writeText(filepath, JSON.stringify(mergeDeep(existing, config), null, 2))
    await Instance.dispose()
  }

  export async function directories() {
    return state().then((x) => x.directories)
  }
}
