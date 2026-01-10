import { BusEvent } from "../bus/bus-event"
import { Bus } from "../bus"
import { GlobalBus } from "../bus/global"
import { Log } from "../util/log"
import { describeRoute, validator, resolver } from "hono-openapi"
import { Hono } from "hono"
import { cors } from "hono/cors"
import { stream, streamSSE } from "hono/streaming"
import { proxy } from "hono/proxy"
import { Session } from "../session"
import z from "zod"
import { Provider } from "../provider/provider"
import { filter, mapValues, sortBy, pipe } from "remeda"
import { NamedError } from "@opencode-ai/util/error"
import { ModelsDev } from "../provider/models"
import { Ripgrep } from "../file/ripgrep"
import { Config } from "../config/config"
import { File } from "../file"
import { MessageV2 } from "../session/message-v2"
import { Permission } from "../permission"
import { Instance } from "../project/instance"
import { Agent } from "../agent/agent"
import { Auth } from "../auth"
import { Command } from "../command"
import { Global } from "../global"
import { ProjectRoute } from "./project"
import { ToolRegistry } from "../tool/registry"
import { zodToJsonSchema } from "zod-to-json-schema"
import { SessionPrompt } from "../session/prompt"
import { SessionCompaction } from "../session/compaction"
import { lazy } from "../util/lazy"
import { Todo } from "../session/todo"
import { InstanceBootstrap } from "../project/bootstrap"
import { MCP } from "../mcp"
import { Storage } from "../storage/storage"
import type { ContentfulStatusCode } from "hono/utils/http-status"
import { SessionStatus } from "../session/status"
import { websocket } from "hono/bun"
import { errors } from "./error"
import { Installation } from "../installation"

// @ts-ignore This global is needed to prevent ai-sdk from logging warnings to stdout https://github.com/vercel/ai/blob/2dc67e0ef538307f21368db32d5a12345d98831b/packages/ai/src/logger/log-warnings.ts#L85
globalThis.AI_SDK_LOG_WARNINGS = false

export namespace Server {
  const log = Log.create({ service: "server" })
  let _corsWhitelist: string[] = []

  export const Event = {
    Connected: BusEvent.define("server.connected", z.object({})),
    Disposed: BusEvent.define("global.disposed", z.object({})),
  }

  const app = new Hono()
  export const App = lazy(() =>
    app
      .onError((err, c) => {
        log.error("failed", {
          error: err,
        })
        if (err instanceof NamedError) {
          let status: ContentfulStatusCode
          if (err instanceof Storage.NotFoundError) status = 404
          else if (err instanceof Provider.ModelNotFoundError) status = 400
          else status = 500
          return c.json(err.toObject(), { status })
        }
        const message = err instanceof Error && err.stack ? err.stack : err.toString()
        return c.json(new NamedError.Unknown({ message }).toObject(), {
          status: 500,
        })
      })
      .use(async (c, next) => {
        const skipLogging = c.req.path === "/log"
        if (!skipLogging) {
          log.info("request", {
            method: c.req.method,
            path: c.req.path,
          })
        }
        const timer = log.time("request", {
          method: c.req.method,
          path: c.req.path,
        })
        await next()
        if (!skipLogging) {
          timer.stop()
        }
      })
      .use(
        cors({
          origin: (input) => {
            if (/^https:\/\/([a-z0-9-]+\.)*opencode\.ai$/.test(input)) {
              return input
            }
            if (_corsWhitelist.includes(input)) {
              return input
            }
            return
          },
        }),
      )
      .get(
        "/global/health",
        describeRoute({
          summary: "Get health",
          description: "Get health information about the OpenCode server.",
          operationId: "global.health",
          responses: {
            200: {
              description: "Health information",
              content: {
                "application/json": {
                  schema: resolver(z.object({ healthy: z.literal(true), version: z.string() })),
                },
              },
            },
          },
        }),
        async (c) => {
          return c.json({ healthy: true, version: Installation.VERSION })
        },
      )
      .get(
        "/global/event",
        describeRoute({
          summary: "Get global events",
          description: "Subscribe to global events from the OpenCode system using server-sent events.",
          operationId: "global.event",
          responses: {
            200: {
              description: "Event stream",
              content: {
                "text/event-stream": {
                  schema: resolver(
                    z
                      .object({
                        directory: z.string(),
                        payload: BusEvent.payloads(),
                      })
                      .meta({
                        ref: "GlobalEvent",
                      }),
                  ),
                },
              },
            },
          },
        }),
        async (c) => {
          log.info("global event connected")
          return streamSSE(c, async (stream) => {
            stream.writeSSE({
              data: JSON.stringify({
                payload: {
                  type: "server.connected",
                  properties: {},
                },
              }),
            })
            async function handler(event: any) {
              await stream.writeSSE({
                data: JSON.stringify(event),
              })
            }
            GlobalBus.on("event", handler)

            // Send heartbeat every 30s to prevent WKWebView timeout (60s default)
            const heartbeat = setInterval(() => {
              stream.writeSSE({
                data: JSON.stringify({
                  payload: {
                    type: "server.heartbeat",
                    properties: {},
                  },
                }),
              })
            }, 30000)

            await new Promise<void>((resolve) => {
              stream.onAbort(() => {
                clearInterval(heartbeat)
                GlobalBus.off("event", handler)
                resolve()
                log.info("global event disconnected")
              })
            })
          })
        },
      )
      .post(
        "/global/dispose",
        describeRoute({
          summary: "Dispose instance",
          description: "Clean up and dispose all OpenCode instances, releasing all resources.",
          operationId: "global.dispose",
          responses: {
            200: {
              description: "Global disposed",
              content: {
                "application/json": {
                  schema: resolver(z.boolean()),
                },
              },
            },
          },
        }),
        async (c) => {
          await Instance.disposeAll()
          GlobalBus.emit("event", {
            directory: "global",
            payload: {
              type: Event.Disposed.type,
              properties: {},
            },
          })
          return c.json(true)
        },
      )
      .use(async (c, next) => {
        const sandboxId = c.req.header("x-sandbox-id") || c.req.query("sandboxId")
        const defaultDirectory = sandboxId ? "/home/user/workspace" : process.cwd()
        const directory = c.req.query("directory") || c.req.header("x-opencode-directory") || defaultDirectory
        return Instance.provide({
          directory,
          sandboxId: sandboxId || undefined,
          init: InstanceBootstrap,
          async fn() {
            return next()
          },
        })
      })
      .use(validator("query", z.object({ directory: z.string().optional(), sandboxId: z.string().optional() })))

      .route("/project", ProjectRoute)

      .get(
        "/config",
        describeRoute({
          summary: "Get configuration",
          description: "Retrieve the current OpenCode configuration settings and preferences.",
          operationId: "config.get",
          responses: {
            200: {
              description: "Get config info",
              content: {
                "application/json": {
                  schema: resolver(Config.Info),
                },
              },
            },
          },
        }),
        async (c) => {
          return c.json(await Config.get())
        },
      )

      .patch(
        "/config",
        describeRoute({
          summary: "Update configuration",
          description: "Update OpenCode configuration settings and preferences.",
          operationId: "config.update",
          responses: {
            200: {
              description: "Successfully updated config",
              content: {
                "application/json": {
                  schema: resolver(Config.Info),
                },
              },
            },
            ...errors(400),
          },
        }),
        validator("json", Config.Info),
        async (c) => {
          const config = c.req.valid("json")
          await Config.update(config)
          return c.json(config)
        },
      )
      .get(
        "/experimental/tool/ids",
        describeRoute({
          summary: "List tool IDs",
          description:
            "Get a list of all available tool IDs, including both built-in tools and dynamically registered tools.",
          operationId: "tool.ids",
          responses: {
            200: {
              description: "Tool IDs",
              content: {
                "application/json": {
                  schema: resolver(z.array(z.string()).meta({ ref: "ToolIDs" })),
                },
              },
            },
            ...errors(400),
          },
        }),
        async (c) => {
          return c.json(await ToolRegistry.ids())
        },
      )
      .get(
        "/experimental/tool",
        describeRoute({
          summary: "List tools",
          description:
            "Get a list of available tools with their JSON schema parameters for a specific provider and model combination.",
          operationId: "tool.list",
          responses: {
            200: {
              description: "Tools",
              content: {
                "application/json": {
                  schema: resolver(
                    z
                      .array(
                        z
                          .object({
                            id: z.string(),
                            description: z.string(),
                            parameters: z.any(),
                          })
                          .meta({ ref: "ToolListItem" }),
                      )
                      .meta({ ref: "ToolList" }),
                  ),
                },
              },
            },
            ...errors(400),
          },
        }),
        validator(
          "query",
          z.object({
            provider: z.string(),
            model: z.string(),
          }),
        ),
        async (c) => {
          const { provider } = c.req.valid("query")
          const tools = await ToolRegistry.tools(provider)
          return c.json(
            tools.map((t) => ({
              id: t.id,
              description: t.description,
              // Handle both Zod schemas and plain JSON schemas
              parameters: (t.parameters as any)?._def ? zodToJsonSchema(t.parameters as any) : t.parameters,
            })),
          )
        },
      )
      .post(
        "/instance/dispose",
        describeRoute({
          summary: "Dispose instance",
          description: "Clean up and dispose the current OpenCode instance, releasing all resources.",
          operationId: "instance.dispose",
          responses: {
            200: {
              description: "Instance disposed",
              content: {
                "application/json": {
                  schema: resolver(z.boolean()),
                },
              },
            },
          },
        }),
        async (c) => {
          await Instance.dispose()
          return c.json(true)
        },
      )
      .get(
        "/path",
        describeRoute({
          summary: "Get paths",
          description: "Retrieve the current working directory and related path information for the OpenCode instance.",
          operationId: "path.get",
          responses: {
            200: {
              description: "Path",
              content: {
                "application/json": {
                  schema: resolver(
                    z
                      .object({
                        home: z.string(),
                        state: z.string(),
                        config: z.string(),
                        directory: z.string(),
                      })
                      .meta({
                        ref: "Path",
                      }),
                  ),
                },
              },
            },
          },
        }),
        async (c) => {
          return c.json({
            home: Global.Path.home,
            state: Global.Path.state,
            config: Global.Path.config,
            directory: Instance.directory,
          })
        },
      )
      .get(
        "/session",
        describeRoute({
          summary: "List sessions",
          description: "Get a list of all OpenCode sessions, sorted by most recently updated.",
          operationId: "session.list",
          responses: {
            200: {
              description: "List of sessions",
              content: {
                "application/json": {
                  schema: resolver(Session.Info.array()),
                },
              },
            },
          },
        }),
        async (c) => {
          const sessions = await Array.fromAsync(Session.list())
          pipe(
            await Array.fromAsync(Session.list()),
            filter((s) => !s.time.archived),
            sortBy((s) => s.time.updated),
          )
          return c.json(sessions)
        },
      )
      .get(
        "/session/status",
        describeRoute({
          summary: "Get session status",
          description: "Retrieve the current status of all sessions, including active, idle, and completed states.",
          operationId: "session.status",
          responses: {
            200: {
              description: "Get session status",
              content: {
                "application/json": {
                  schema: resolver(z.record(z.string(), SessionStatus.Info)),
                },
              },
            },
            ...errors(400),
          },
        }),
        async (c) => {
          const result = SessionStatus.list()
          return c.json(result)
        },
      )
      .get(
        "/session/:sessionID",
        describeRoute({
          summary: "Get session",
          description: "Retrieve detailed information about a specific OpenCode session.",
          tags: ["Session"],
          operationId: "session.get",
          responses: {
            200: {
              description: "Get session",
              content: {
                "application/json": {
                  schema: resolver(Session.Info),
                },
              },
            },
            ...errors(400, 404),
          },
        }),
        validator(
          "param",
          z.object({
            sessionID: Session.get.schema,
          }),
        ),
        async (c) => {
          const sessionID = c.req.valid("param").sessionID
          log.info("SEARCH", { url: c.req.url })
          const session = await Session.get(sessionID)
          return c.json(session)
        },
      )
      .get(
        "/session/:sessionID/children",
        describeRoute({
          summary: "Get session children",
          tags: ["Session"],
          description: "Retrieve all child sessions that were forked from the specified parent session.",
          operationId: "session.children",
          responses: {
            200: {
              description: "List of children",
              content: {
                "application/json": {
                  schema: resolver(Session.Info.array()),
                },
              },
            },
            ...errors(400, 404),
          },
        }),
        validator(
          "param",
          z.object({
            sessionID: Session.children.schema,
          }),
        ),
        async (c) => {
          const sessionID = c.req.valid("param").sessionID
          const session = await Session.children(sessionID)
          return c.json(session)
        },
      )
      .get(
        "/session/:sessionID/todo",
        describeRoute({
          summary: "Get session todos",
          description: "Retrieve the todo list associated with a specific session, showing tasks and action items.",
          operationId: "session.todo",
          responses: {
            200: {
              description: "Todo list",
              content: {
                "application/json": {
                  schema: resolver(Todo.Info.array()),
                },
              },
            },
            ...errors(400, 404),
          },
        }),
        validator(
          "param",
          z.object({
            sessionID: z.string().meta({ description: "Session ID" }),
          }),
        ),
        async (c) => {
          const sessionID = c.req.valid("param").sessionID
          const todos = await Todo.get(sessionID)
          return c.json(todos)
        },
      )
      .post(
        "/session",
        describeRoute({
          summary: "Create session",
          description: "Create a new OpenCode session for interacting with AI assistants and managing conversations.",
          operationId: "session.create",
          responses: {
            ...errors(400),
            200: {
              description: "Successfully created session",
              content: {
                "application/json": {
                  schema: resolver(Session.Info),
                },
              },
            },
          },
        }),
        validator("json", Session.create.schema.optional()),
        async (c) => {
          const body = c.req.valid("json") ?? {}
          const session = await Session.create(body)
          return c.json(session)
        },
      )
      .delete(
        "/session/:sessionID",
        describeRoute({
          summary: "Delete session",
          description: "Delete a session and permanently remove all associated data, including messages and history.",
          operationId: "session.delete",
          responses: {
            200: {
              description: "Successfully deleted session",
              content: {
                "application/json": {
                  schema: resolver(z.boolean()),
                },
              },
            },
            ...errors(400, 404),
          },
        }),
        validator(
          "param",
          z.object({
            sessionID: Session.remove.schema,
          }),
        ),
        async (c) => {
          const sessionID = c.req.valid("param").sessionID
          await Session.remove(sessionID)
          return c.json(true)
        },
      )
      .patch(
        "/session/:sessionID",
        describeRoute({
          summary: "Update session",
          description: "Update properties of an existing session, such as title or other metadata.",
          operationId: "session.update",
          responses: {
            200: {
              description: "Successfully updated session",
              content: {
                "application/json": {
                  schema: resolver(Session.Info),
                },
              },
            },
            ...errors(400, 404),
          },
        }),
        validator(
          "param",
          z.object({
            sessionID: z.string(),
          }),
        ),
        validator(
          "json",
          z.object({
            title: z.string().optional(),
            time: z
              .object({
                archived: z.number().optional(),
              })
              .optional(),
          }),
        ),
        async (c) => {
          const sessionID = c.req.valid("param").sessionID
          const updates = c.req.valid("json")

          const updatedSession = await Session.update(sessionID, (session) => {
            if (updates.title !== undefined) {
              session.title = updates.title
            }
            if (updates.time?.archived !== undefined) session.time.archived = updates.time.archived
          })

          return c.json(updatedSession)
        },
      )
      .post(
        "/session/:sessionID/init",
        describeRoute({
          summary: "Initialize session",
          description:
            "Analyze the current application and create an AGENTS.md file with project-specific agent configurations.",
          operationId: "session.init",
          responses: {
            200: {
              description: "200",
              content: {
                "application/json": {
                  schema: resolver(z.boolean()),
                },
              },
            },
            ...errors(400, 404),
          },
        }),
        validator(
          "param",
          z.object({
            sessionID: z.string().meta({ description: "Session ID" }),
          }),
        ),
        validator("json", Session.initialize.schema.omit({ sessionID: true })),
        async (c) => {
          const sessionID = c.req.valid("param").sessionID
          const body = c.req.valid("json")
          await Session.initialize({ ...body, sessionID })
          return c.json(true)
        },
      )
      .post(
        "/session/:sessionID/fork",
        describeRoute({
          summary: "Fork session",
          description: "Create a new session by forking an existing session at a specific message point.",
          operationId: "session.fork",
          responses: {
            200: {
              description: "200",
              content: {
                "application/json": {
                  schema: resolver(Session.Info),
                },
              },
            },
          },
        }),
        validator(
          "param",
          z.object({
            sessionID: Session.fork.schema.shape.sessionID,
          }),
        ),
        validator("json", Session.fork.schema.omit({ sessionID: true })),
        async (c) => {
          const sessionID = c.req.valid("param").sessionID
          const body = c.req.valid("json")
          const result = await Session.fork({ ...body, sessionID })
          return c.json(result)
        },
      )
      .post(
        "/session/:sessionID/abort",
        describeRoute({
          summary: "Abort session",
          description: "Abort an active session and stop any ongoing AI processing or command execution.",
          operationId: "session.abort",
          responses: {
            200: {
              description: "Aborted session",
              content: {
                "application/json": {
                  schema: resolver(z.boolean()),
                },
              },
            },
            ...errors(400, 404),
          },
        }),
        validator(
          "param",
          z.object({
            sessionID: z.string(),
          }),
        ),
        async (c) => {
          SessionPrompt.cancel(c.req.valid("param").sessionID)
          return c.json(true)
        },
      )
      .post(
        "/session/:sessionID/summarize",
        describeRoute({
          summary: "Summarize session",
          description: "Generate a concise summary of the session using AI compaction to preserve key information.",
          operationId: "session.summarize",
          responses: {
            200: {
              description: "Summarized session",
              content: {
                "application/json": {
                  schema: resolver(z.boolean()),
                },
              },
            },
            ...errors(400, 404),
          },
        }),
        validator(
          "param",
          z.object({
            sessionID: z.string().meta({ description: "Session ID" }),
          }),
        ),
        validator(
          "json",
          z.object({
            providerID: z.string(),
            modelID: z.string(),
            auto: z.boolean().optional().default(false),
          }),
        ),
        async (c) => {
          const sessionID = c.req.valid("param").sessionID
          const body = c.req.valid("json")
          const msgs = await Session.messages({ sessionID })
          let currentAgent = await Agent.defaultAgent()
          for (let i = msgs.length - 1; i >= 0; i--) {
            const info = msgs[i].info
            if (info.role === "user") {
              currentAgent = info.agent || (await Agent.defaultAgent())
              break
            }
          }
          await SessionCompaction.create({
            sessionID,
            agent: currentAgent,
            model: {
              providerID: body.providerID,
              modelID: body.modelID,
            },
            auto: body.auto,
          })
          await SessionPrompt.loop(sessionID)
          return c.json(true)
        },
      )
      .get(
        "/session/:sessionID/message",
        describeRoute({
          summary: "Get session messages",
          description: "Retrieve all messages in a session, including user prompts and AI responses.",
          operationId: "session.messages",
          responses: {
            200: {
              description: "List of messages",
              content: {
                "application/json": {
                  schema: resolver(MessageV2.WithParts.array()),
                },
              },
            },
            ...errors(400, 404),
          },
        }),
        validator(
          "param",
          z.object({
            sessionID: z.string().meta({ description: "Session ID" }),
          }),
        ),
        validator(
          "query",
          z.object({
            limit: z.coerce.number().optional(),
          }),
        ),
        async (c) => {
          const query = c.req.valid("query")
          const messages = await Session.messages({
            sessionID: c.req.valid("param").sessionID,
            limit: query.limit,
          })
          return c.json(messages)
        },
      )
      .get(
        "/session/:sessionID/message/:messageID",
        describeRoute({
          summary: "Get message",
          description: "Retrieve a specific message from a session by its message ID.",
          operationId: "session.message",
          responses: {
            200: {
              description: "Message",
              content: {
                "application/json": {
                  schema: resolver(
                    z.object({
                      info: MessageV2.Info,
                      parts: MessageV2.Part.array(),
                    }),
                  ),
                },
              },
            },
            ...errors(400, 404),
          },
        }),
        validator(
          "param",
          z.object({
            sessionID: z.string().meta({ description: "Session ID" }),
            messageID: z.string().meta({ description: "Message ID" }),
          }),
        ),
        async (c) => {
          const params = c.req.valid("param")
          const message = await MessageV2.get({
            sessionID: params.sessionID,
            messageID: params.messageID,
          })
          return c.json(message)
        },
      )
      .delete(
        "/session/:sessionID/message/:messageID/part/:partID",
        describeRoute({
          description: "Delete a part from a message",
          operationId: "part.delete",
          responses: {
            200: {
              description: "Successfully deleted part",
              content: {
                "application/json": {
                  schema: resolver(z.boolean()),
                },
              },
            },
            ...errors(400, 404),
          },
        }),
        validator(
          "param",
          z.object({
            sessionID: z.string().meta({ description: "Session ID" }),
            messageID: z.string().meta({ description: "Message ID" }),
            partID: z.string().meta({ description: "Part ID" }),
          }),
        ),
        async (c) => {
          const params = c.req.valid("param")
          await Session.removePart({
            sessionID: params.sessionID,
            messageID: params.messageID,
            partID: params.partID,
          })
          return c.json(true)
        },
      )
      .patch(
        "/session/:sessionID/message/:messageID/part/:partID",
        describeRoute({
          description: "Update a part in a message",
          operationId: "part.update",
          responses: {
            200: {
              description: "Successfully updated part",
              content: {
                "application/json": {
                  schema: resolver(MessageV2.Part),
                },
              },
            },
            ...errors(400, 404),
          },
        }),
        validator(
          "param",
          z.object({
            sessionID: z.string().meta({ description: "Session ID" }),
            messageID: z.string().meta({ description: "Message ID" }),
            partID: z.string().meta({ description: "Part ID" }),
          }),
        ),
        validator("json", MessageV2.Part),
        async (c) => {
          const params = c.req.valid("param")
          const body = c.req.valid("json")
          if (body.id !== params.partID || body.messageID !== params.messageID || body.sessionID !== params.sessionID) {
            throw new Error(
              `Part mismatch: body.id='${body.id}' vs partID='${params.partID}', body.messageID='${body.messageID}' vs messageID='${params.messageID}', body.sessionID='${body.sessionID}' vs sessionID='${params.sessionID}'`,
            )
          }
          const part = await Session.updatePart(body)
          return c.json(part)
        },
      )
      .post(
        "/session/:sessionID/message",
        describeRoute({
          summary: "Send message",
          description: "Create and send a new message to a session, streaming the AI response.",
          operationId: "session.prompt",
          responses: {
            200: {
              description: "Created message",
              content: {
                "application/json": {
                  schema: resolver(
                    z.object({
                      info: MessageV2.Assistant,
                      parts: MessageV2.Part.array(),
                    }),
                  ),
                },
              },
            },
            ...errors(400, 404),
          },
        }),
        validator(
          "param",
          z.object({
            sessionID: z.string().meta({ description: "Session ID" }),
          }),
        ),
        validator("json", SessionPrompt.PromptInput.omit({ sessionID: true })),
        async (c) => {
          c.status(200)
          c.header("Content-Type", "application/json")
          return stream(c, async (stream) => {
            const sessionID = c.req.valid("param").sessionID
            const body = c.req.valid("json")
            const msg = await SessionPrompt.prompt({ ...body, sessionID })
            stream.write(JSON.stringify(msg))
          })
        },
      )
      .post(
        "/session/:sessionID/prompt_async",
        describeRoute({
          summary: "Send async message",
          description:
            "Create and send a new message to a session asynchronously, starting the session if needed and returning immediately.",
          operationId: "session.prompt_async",
          responses: {
            204: {
              description: "Prompt accepted",
            },
            ...errors(400, 404),
          },
        }),
        validator(
          "param",
          z.object({
            sessionID: z.string().meta({ description: "Session ID" }),
          }),
        ),
        validator("json", SessionPrompt.PromptInput.omit({ sessionID: true })),
        async (c) => {
          c.status(204)
          c.header("Content-Type", "application/json")
          return stream(c, async () => {
            const sessionID = c.req.valid("param").sessionID
            const body = c.req.valid("json")
            SessionPrompt.prompt({ ...body, sessionID })
          })
        },
      )
      .post(
        "/session/:sessionID/command",
        describeRoute({
          summary: "Send command",
          description: "Send a new command to a session for execution by the AI assistant.",
          operationId: "session.command",
          responses: {
            200: {
              description: "Created message",
              content: {
                "application/json": {
                  schema: resolver(
                    z.object({
                      info: MessageV2.Assistant,
                      parts: MessageV2.Part.array(),
                    }),
                  ),
                },
              },
            },
            ...errors(400, 404),
          },
        }),
        validator(
          "param",
          z.object({
            sessionID: z.string().meta({ description: "Session ID" }),
          }),
        ),
        validator("json", SessionPrompt.CommandInput.omit({ sessionID: true })),
        async (c) => {
          const sessionID = c.req.valid("param").sessionID
          const body = c.req.valid("json")
          const msg = await SessionPrompt.command({ ...body, sessionID })
          return c.json(msg)
        },
      )
      .post(
        "/session/:sessionID/shell",
        describeRoute({
          summary: "Run shell command",
          description: "Execute a shell command within the session context and return the AI's response.",
          operationId: "session.shell",
          responses: {
            200: {
              description: "Created message",
              content: {
                "application/json": {
                  schema: resolver(MessageV2.Assistant),
                },
              },
            },
            ...errors(400, 404),
          },
        }),
        validator(
          "param",
          z.object({
            sessionID: z.string().meta({ description: "Session ID" }),
          }),
        ),
        validator("json", SessionPrompt.ShellInput.omit({ sessionID: true })),
        async (c) => {
          const sessionID = c.req.valid("param").sessionID
          const body = c.req.valid("json")
          const msg = await SessionPrompt.shell({ ...body, sessionID })
          return c.json(msg)
        },
      )
      .post(
        "/session/:sessionID/permissions/:permissionID",
        describeRoute({
          summary: "Respond to permission",
          description: "Approve or deny a permission request from the AI assistant.",
          operationId: "permission.respond",
          responses: {
            200: {
              description: "Permission processed successfully",
              content: {
                "application/json": {
                  schema: resolver(z.boolean()),
                },
              },
            },
            ...errors(400, 404),
          },
        }),
        validator(
          "param",
          z.object({
            sessionID: z.string(),
            permissionID: z.string(),
          }),
        ),
        validator("json", z.object({ response: Permission.Response })),
        async (c) => {
          const params = c.req.valid("param")
          const sessionID = params.sessionID
          const permissionID = params.permissionID
          Permission.respond({
            sessionID,
            permissionID,
            response: c.req.valid("json").response,
          })
          return c.json(true)
        },
      )
      .get(
        "/permission",
        describeRoute({
          summary: "List pending permissions",
          description: "Get all pending permission requests across all sessions.",
          operationId: "permission.list",
          responses: {
            200: {
              description: "List of pending permissions",
              content: {
                "application/json": {
                  schema: resolver(Permission.Info.array()),
                },
              },
            },
          },
        }),
        async (c) => {
          const permissions = Permission.list()
          return c.json(permissions)
        },
      )
      .get(
        "/command",
        describeRoute({
          summary: "List commands",
          description: "Get a list of all available commands in the OpenCode system.",
          operationId: "command.list",
          responses: {
            200: {
              description: "List of commands",
              content: {
                "application/json": {
                  schema: resolver(Command.Info.array()),
                },
              },
            },
          },
        }),
        async (c) => {
          const commands = await Command.list()
          return c.json(commands)
        },
      )
      .get(
        "/config/providers",
        describeRoute({
          summary: "List config providers",
          description: "Get a list of all configured AI providers and their default models.",
          operationId: "config.providers",
          responses: {
            200: {
              description: "List of providers",
              content: {
                "application/json": {
                  schema: resolver(
                    z.object({
                      providers: Provider.Info.array(),
                      default: z.record(z.string(), z.string()),
                    }),
                  ),
                },
              },
            },
          },
        }),
        async (c) => {
          using _ = log.time("providers")
          const providers = await Provider.list().then((x) => mapValues(x, (item) => item))
          return c.json({
            providers: Object.values(providers),
            default: mapValues(providers, (item) => Provider.sort(Object.values(item.models))[0].id),
          })
        },
      )
      .get(
        "/provider",
        describeRoute({
          summary: "List providers",
          description: "Get a list of all available AI providers, including both available and connected ones.",
          operationId: "provider.list",
          responses: {
            200: {
              description: "List of providers",
              content: {
                "application/json": {
                  schema: resolver(
                    z.object({
                      all: ModelsDev.Provider.array(),
                      default: z.record(z.string(), z.string()),
                      connected: z.array(z.string()),
                    }),
                  ),
                },
              },
            },
          },
        }),
        async (c) => {
          const config = await Config.get()
          const disabled = new Set(config.disabled_providers ?? [])
          const enabled = config.enabled_providers ? new Set(config.enabled_providers) : undefined

          const allProviders = await ModelsDev.get()
          const filteredProviders: Record<string, (typeof allProviders)[string]> = {}
          for (const [key, value] of Object.entries(allProviders)) {
            if ((enabled ? enabled.has(key) : true) && !disabled.has(key)) {
              filteredProviders[key] = value
            }
          }

          const connected = await Provider.list()
          const providers = Object.assign(
            mapValues(filteredProviders, (x) => Provider.fromModelsDevProvider(x)),
            connected,
          )
          return c.json({
            all: Object.values(providers),
            default: mapValues(providers, (item) => Provider.sort(Object.values(item.models))[0].id),
            connected: Object.keys(connected),
          })
        },
      )
      .get(
        "/find",
        describeRoute({
          summary: "Find text",
          description: "Search for text patterns across files in the project using ripgrep.",
          operationId: "find.text",
          responses: {
            200: {
              description: "Matches",
              content: {
                "application/json": {
                  schema: resolver(Ripgrep.Match.shape.data.array()),
                },
              },
            },
          },
        }),
        validator(
          "query",
          z.object({
            pattern: z.string(),
          }),
        ),
        async (c) => {
          const pattern = c.req.valid("query").pattern
          const result = await Ripgrep.search({
            cwd: Instance.directory,
            pattern,
            limit: 10,
          })
          return c.json(result)
        },
      )
      .get(
        "/find/file",
        describeRoute({
          summary: "Find files",
          description: "Search for files by name or pattern in the project directory.",
          operationId: "find.files",
          responses: {
            200: {
              description: "File paths",
              content: {
                "application/json": {
                  schema: resolver(z.string().array()),
                },
              },
            },
          },
        }),
        validator(
          "query",
          z.object({
            query: z.string(),
            dirs: z.enum(["true", "false"]).optional(),
          }),
        ),
        async (c) => {
          const query = c.req.valid("query").query
          const dirs = c.req.valid("query").dirs
          const results = await File.search({
            query,
            limit: 10,
            dirs: dirs !== "false",
          })
          return c.json(results)
        },
      )
      .get(
        "/file",
        describeRoute({
          summary: "List files",
          description: "List files and directories in a specified path.",
          operationId: "file.list",
          responses: {
            200: {
              description: "Files and directories",
              content: {
                "application/json": {
                  schema: resolver(File.Node.array()),
                },
              },
            },
          },
        }),
        validator(
          "query",
          z.object({
            path: z.string(),
          }),
        ),
        async (c) => {
          const path = c.req.valid("query").path
          const content = await File.list(path)
          return c.json(content)
        },
      )
      .get(
        "/file/content",
        describeRoute({
          summary: "Read file",
          description: "Read the content of a specified file.",
          operationId: "file.read",
          responses: {
            200: {
              description: "File content",
              content: {
                "application/json": {
                  schema: resolver(File.Content),
                },
              },
            },
          },
        }),
        validator(
          "query",
          z.object({
            path: z.string(),
          }),
        ),
        async (c) => {
          const path = c.req.valid("query").path
          const content = await File.read(path)
          return c.json(content)
        },
      )
      .get(
        "/file/status",
        describeRoute({
          summary: "Get file status",
          description: "Get the git status of all files in the project.",
          operationId: "file.status",
          responses: {
            200: {
              description: "File status",
              content: {
                "application/json": {
                  schema: resolver(File.Info.array()),
                },
              },
            },
          },
        }),
        async (c) => {
          const content = await File.status()
          return c.json(content)
        },
      )
      .post(
        "/log",
        describeRoute({
          summary: "Write log",
          description: "Write a log entry to the server logs with specified level and metadata.",
          operationId: "app.log",
          responses: {
            200: {
              description: "Log entry written successfully",
              content: {
                "application/json": {
                  schema: resolver(z.boolean()),
                },
              },
            },
            ...errors(400),
          },
        }),
        validator(
          "json",
          z.object({
            service: z.string().meta({ description: "Service name for the log entry" }),
            level: z.enum(["debug", "info", "error", "warn"]).meta({ description: "Log level" }),
            message: z.string().meta({ description: "Log message" }),
            extra: z
              .record(z.string(), z.any())
              .optional()
              .meta({ description: "Additional metadata for the log entry" }),
          }),
        ),
        async (c) => {
          const { service, level, message, extra } = c.req.valid("json")
          const logger = Log.create({ service })

          switch (level) {
            case "debug":
              logger.debug(message, extra)
              break
            case "info":
              logger.info(message, extra)
              break
            case "error":
              logger.error(message, extra)
              break
            case "warn":
              logger.warn(message, extra)
              break
          }

          return c.json(true)
        },
      )
      .get(
        "/agent",
        describeRoute({
          summary: "List agents",
          description: "Get a list of all available AI agents in the OpenCode system.",
          operationId: "app.agents",
          responses: {
            200: {
              description: "List of agents",
              content: {
                "application/json": {
                  schema: resolver(Agent.Info.array()),
                },
              },
            },
          },
        }),
        async (c) => {
          const modes = await Agent.list()
          return c.json(modes)
        },
      )
      .get(
        "/mcp",
        describeRoute({
          summary: "Get MCP status",
          description: "Get the status of all Model Context Protocol (MCP) servers.",
          operationId: "mcp.status",
          responses: {
            200: {
              description: "MCP server status",
              content: {
                "application/json": {
                  schema: resolver(z.record(z.string(), MCP.Status)),
                },
              },
            },
          },
        }),
        async (c) => {
          return c.json(await MCP.status())
        },
      )
      .post(
        "/mcp",
        describeRoute({
          summary: "Add MCP server",
          description: "Dynamically add a new Model Context Protocol (MCP) server to the system.",
          operationId: "mcp.add",
          responses: {
            200: {
              description: "MCP server added successfully",
              content: {
                "application/json": {
                  schema: resolver(z.record(z.string(), MCP.Status)),
                },
              },
            },
            ...errors(400),
          },
        }),
        validator(
          "json",
          z.object({
            name: z.string(),
            config: Config.Mcp,
          }),
        ),
        async (c) => {
          const { name, config } = c.req.valid("json")
          const result = await MCP.add(name, config)
          return c.json(result.status)
        },
      )
      .post(
        "/mcp/:name/auth",
        describeRoute({
          summary: "Start MCP OAuth",
          description: "Start OAuth authentication flow for a Model Context Protocol (MCP) server.",
          operationId: "mcp.auth.start",
          responses: {
            200: {
              description: "OAuth flow started",
              content: {
                "application/json": {
                  schema: resolver(
                    z.object({
                      authorizationUrl: z.string().describe("URL to open in browser for authorization"),
                    }),
                  ),
                },
              },
            },
            ...errors(400, 404),
          },
        }),
        async (c) => {
          const name = c.req.param("name")
          const supportsOAuth = await MCP.supportsOAuth(name)
          if (!supportsOAuth) {
            return c.json({ error: `MCP server ${name} does not support OAuth` }, 400)
          }
          const result = await MCP.startAuth(name)
          return c.json(result)
        },
      )
      .post(
        "/mcp/:name/auth/callback",
        describeRoute({
          summary: "Complete MCP OAuth",
          description:
            "Complete OAuth authentication for a Model Context Protocol (MCP) server using the authorization code.",
          operationId: "mcp.auth.callback",
          responses: {
            200: {
              description: "OAuth authentication completed",
              content: {
                "application/json": {
                  schema: resolver(MCP.Status),
                },
              },
            },
            ...errors(400, 404),
          },
        }),
        validator(
          "json",
          z.object({
            code: z.string().describe("Authorization code from OAuth callback"),
          }),
        ),
        async (c) => {
          const name = c.req.param("name")
          const { code } = c.req.valid("json")
          const status = await MCP.finishAuth(name, code)
          return c.json(status)
        },
      )
      .post(
        "/mcp/:name/auth/authenticate",
        describeRoute({
          summary: "Authenticate MCP OAuth",
          description: "Start OAuth flow and wait for callback (opens browser)",
          operationId: "mcp.auth.authenticate",
          responses: {
            200: {
              description: "OAuth authentication completed",
              content: {
                "application/json": {
                  schema: resolver(MCP.Status),
                },
              },
            },
            ...errors(400, 404),
          },
        }),
        async (c) => {
          const name = c.req.param("name")
          const supportsOAuth = await MCP.supportsOAuth(name)
          if (!supportsOAuth) {
            return c.json({ error: `MCP server ${name} does not support OAuth` }, 400)
          }
          const status = await MCP.authenticate(name)
          return c.json(status)
        },
      )
      .delete(
        "/mcp/:name/auth",
        describeRoute({
          summary: "Remove MCP OAuth",
          description: "Remove OAuth credentials for an MCP server",
          operationId: "mcp.auth.remove",
          responses: {
            200: {
              description: "OAuth credentials removed",
              content: {
                "application/json": {
                  schema: resolver(z.object({ success: z.literal(true) })),
                },
              },
            },
            ...errors(404),
          },
        }),
        async (c) => {
          const name = c.req.param("name")
          await MCP.removeAuth(name)
          return c.json({ success: true as const })
        },
      )
      .post(
        "/mcp/:name/connect",
        describeRoute({
          description: "Connect an MCP server",
          operationId: "mcp.connect",
          responses: {
            200: {
              description: "MCP server connected successfully",
              content: {
                "application/json": {
                  schema: resolver(z.boolean()),
                },
              },
            },
          },
        }),
        validator("param", z.object({ name: z.string() })),
        async (c) => {
          const { name } = c.req.valid("param")
          await MCP.connect(name)
          return c.json(true)
        },
      )
      .post(
        "/mcp/:name/disconnect",
        describeRoute({
          description: "Disconnect an MCP server",
          operationId: "mcp.disconnect",
          responses: {
            200: {
              description: "MCP server disconnected successfully",
              content: {
                "application/json": {
                  schema: resolver(z.boolean()),
                },
              },
            },
          },
        }),
        validator("param", z.object({ name: z.string() })),
        async (c) => {
          const { name } = c.req.valid("param")
          await MCP.disconnect(name)
          return c.json(true)
        },
      )
      .put(
        "/auth/:providerID",
        describeRoute({
          summary: "Set auth credentials",
          description: "Set authentication credentials",
          operationId: "auth.set",
          responses: {
            200: {
              description: "Successfully set authentication credentials",
              content: {
                "application/json": {
                  schema: resolver(z.boolean()),
                },
              },
            },
            ...errors(400),
          },
        }),
        validator(
          "param",
          z.object({
            providerID: z.string(),
          }),
        ),
        validator("json", Auth.Info),
        async (c) => {
          const providerID = c.req.valid("param").providerID
          const info = c.req.valid("json")
          await Auth.set(providerID, info)
          return c.json(true)
        },
      )
      .get(
        "/event",
        describeRoute({
          summary: "Subscribe to events",
          description: "Get events",
          operationId: "event.subscribe",
          responses: {
            200: {
              description: "Event stream",
              content: {
                "text/event-stream": {
                  schema: resolver(BusEvent.payloads()),
                },
              },
            },
          },
        }),
        async (c) => {
          log.info("event connected")
          return streamSSE(c, async (stream) => {
            stream.writeSSE({
              data: JSON.stringify({
                type: "server.connected",
                properties: {},
              }),
            })
            const unsub = Bus.subscribeAll(async (event) => {
              await stream.writeSSE({
                data: JSON.stringify(event),
              })
              if (event.type === Bus.InstanceDisposed.type) {
                stream.close()
              }
            })

            // Send heartbeat every 30s to prevent WKWebView timeout (60s default)
            const heartbeat = setInterval(() => {
              stream.writeSSE({
                data: JSON.stringify({
                  type: "server.heartbeat",
                  properties: {},
                }),
              })
            }, 30000)

            await new Promise<void>((resolve) => {
              stream.onAbort(() => {
                clearInterval(heartbeat)
                unsub()
                resolve()
                log.info("event disconnected")
              })
            })
          })
        },
      )
      .all("/*", async (c) => {
        return proxy(`https://app.opencode.ai${c.req.path}`, {
          ...c.req,
          headers: {
            host: "app.opencode.ai",
          },
        })
      }),
  )

  export function listen(opts: { port: number; hostname: string; cors?: string[] }) {
    _corsWhitelist = opts.cors ?? []
    const args = {
      hostname: opts.hostname,
      idleTimeout: 0,
      fetch: App().fetch,
      websocket: websocket,
    } as const
    if (opts.port === 0) {
      try {
        return Bun.serve({ ...args, port: 4096 })
      } catch {
        // port 4096 not available, fall through to use port 0
      }
    }
    return Bun.serve({ ...args, port: opts.port })
  }
}
