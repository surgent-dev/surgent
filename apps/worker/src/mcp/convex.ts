import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { parse as parseDotEnv } from 'dotenv'
import { Sandbox as E2BSandbox } from 'e2b'
import {
  createProjectOnTeam,
  createDeployKey,
  deleteProject,
  setDeploymentEnvVars,
  listDeploymentEnvVars,
  callQuery,
  callMutation,
  type ConvexValue,
} from '@/apis/convex'
import { workspacePath, defaultProviderName } from '@/lib/sandbox'

// Context passed to MCP tools - contains project credentials and optional sandbox info
export interface McpContext {
  deploymentUrl: string
  deployKey: string
  projectId?: string
  sandboxId?: string
  sandboxProvider?: string
  workingDirectory?: string
  envFile?: string
}

// Tool input schemas - using objects compatible with MCP SDK
const createProjectSchema = {
  name: z.string().describe('Name for the new Convex project'),
  deploymentType: z.enum(['dev', 'prod']).optional().describe('Deployment type (default: dev)'),
}

const deleteProjectSchema = {
  projectId: z.string().describe('ID of the project to delete'),
}

const setEnvVarsSchema = {
  vars: z
    .record(z.string(), z.string())
    .describe('Key-value pairs of environment variables to set'),
}

const callFunctionSchema = {
  path: z.string().describe('Function path in format "file:functionName" (e.g., "messages:list")'),
  args: z.record(z.string(), z.unknown()).optional().describe('Arguments to pass to the function'),
}

// Response helpers
type McpResponse = { content: { type: 'text'; text: string }[]; isError?: boolean }
const ok = (data: Record<string, unknown>): McpResponse => ({
  content: [{ type: 'text', text: JSON.stringify({ success: true, ...data }, null, 2) }],
})
const err = (error: string): McpResponse => ({
  content: [{ type: 'text', text: JSON.stringify({ success: false, error }) }],
  isError: true,
})
const errMsg = (e: unknown): string => (e instanceof Error ? e.message : String(e))

function getContext(extra: { _meta?: { context?: unknown } }): McpContext | undefined {
  const ctx = extra._meta?.context
  if (!ctx || typeof ctx !== 'object') return undefined
  return ctx as McpContext
}

function resolveEnvPath(ctx: McpContext): string | undefined {
  const dir = ctx.workingDirectory ?? (ctx.projectId ? workspacePath(ctx.projectId) : undefined)
  if (!dir) return undefined
  const root = dir.replace(/\/$/, '') || '/'
  if (!ctx.envFile) return `${root}/.env.local`
  if (ctx.envFile.startsWith('/')) return ctx.envFile
  return `${root}/${ctx.envFile}`
}

function formatEnv(vars: Record<string, string>): string {
  const lines = Object.entries(vars).map(
    ([k, v]) => `${k}=${/^[A-Za-z0-9_./:@-]+$/.test(v) ? v : JSON.stringify(v)}`,
  )
  return lines.length ? `${lines.join('\n')}\n` : ''
}

type EnvWriteResult =
  | { status: 'written'; path: string }
  | { status: 'skipped'; reason: string }
  | { status: 'failed'; error: string }

async function writeEnvToSandbox(
  ctx: McpContext | undefined,
  vars: Record<string, string>,
): Promise<EnvWriteResult> {
  if (!ctx?.sandboxId) return { status: 'skipped', reason: 'Missing sandboxId' }
  const provider = ctx.sandboxProvider ?? defaultProviderName
  if (provider !== 'e2b') return { status: 'skipped', reason: `Provider ${provider} not supported` }
  const path = resolveEnvPath(ctx)
  if (!path) return { status: 'skipped', reason: 'Missing workingDirectory or projectId' }

  let sandbox: E2BSandbox | undefined
  try {
    sandbox = await E2BSandbox.connect(ctx.sandboxId)
    const existing = await sandbox.files.read(path).catch(() => '') // file may not exist
    const merged = { ...parseDotEnv(existing), ...vars }
    await sandbox.files.write(path, formatEnv(merged))
    return { status: 'written', path }
  } catch (e) {
    return { status: 'failed', error: errMsg(e) }
  } finally {
    await sandbox?.close?.().catch(() => {}) // best-effort cleanup
  }
}

/**
 * Create the Convex MCP server with all tools registered
 */
export function createConvexMcpServer(): McpServer {
  const server = new McpServer({
    name: 'convex-mcp',
    version: '1.0.0',
  })

  // Tool: Create Project
  server.registerTool(
    'create_project',
    {
      title: 'Create Convex Project',
      description: `Create a new Convex project and deployment under the team account.

Use this when starting a new backend - it provisions a fresh Convex database instance.

Returns:
- project: Object with projectId, deploymentName, deploymentUrl, deployKey
- envVars: Ready-to-use environment variables object (CONVEX_DEPLOYMENT, CONVEX_URL, CONVEX_DEPLOY_KEY, VITE_CONVEX_URL)
- envFileContent: Complete .env file content as a string - write this directly to .env file

To set up the sandbox after creation:
1. Write envFileContent to .env file in the project root
2. Run 'npx convex dev' to start the development server

IMPORTANT: Save deploymentUrl and deployKey - you'll need them in _meta.context for subsequent operations (queries, mutations, env vars).

Optional sandbox write-through:
- If _meta.context includes sandboxId and either workingDirectory or projectId,
  the tool will write env vars directly to .env.local in the sandbox repo.
- You can override the target file with _meta.context.envFile.`,
      inputSchema: createProjectSchema,
    },
    async (args, extra) => {
      const ctx = getContext(extra)
      try {
        const project = await createProjectOnTeam({
          name: args.name,
          deploymentType: args.deploymentType,
        })
        const deployKey = await createDeployKey(project.deploymentName)
        const envVars = {
          CONVEX_DEPLOYMENT: `dev:${project.deploymentName}`,
          CONVEX_URL: project.deploymentUrl,
          CONVEX_DEPLOY_KEY: deployKey,
          VITE_CONVEX_URL: project.deploymentUrl,
        }
        const envFileWrite = await writeEnvToSandbox(ctx, envVars)

        const message =
          envFileWrite.status === 'written'
            ? `Convex project created and env variables already written to ${envFileWrite.path}. No manual setup needed - continue building your app.`
            : 'Convex project created successfully. Write envFileContent to .env.local to configure your app.'

        return ok({
          message,
          project: { ...project, deployKey },
          envVars,
          envFileContent: Object.entries(envVars)
            .map(([k, v]) => `${k}=${v}`)
            .join('\n'),
          envFileWrite,
        })
      } catch (e) {
        return err(errMsg(e))
      }
    },
  )

  // Tool: Delete Project
  server.registerTool(
    'delete_project',
    {
      title: 'Delete Convex Project',
      description: `Permanently delete a Convex project and all its data.

WARNING: This is irreversible! All data, functions, and deployments will be destroyed.

Use the projectId returned from create_project. Does not require _meta.context.`,
      inputSchema: deleteProjectSchema,
    },
    async (args) => {
      try {
        await deleteProject(args.projectId)
        return ok({ message: 'Project deleted successfully' })
      } catch (e) {
        return err(errMsg(e))
      }
    },
  )

  // Tool: Set Environment Variables
  server.registerTool(
    'set_env_vars',
    {
      title: 'Set Environment Variables',
      description: `Set environment variables on a Convex deployment.

Use this to configure API keys, secrets, or any runtime configuration your Convex functions need.
Variables are passed as key-value pairs: {"OPENAI_API_KEY": "sk-...", "DEBUG": "true"}

Existing variables with the same name will be overwritten. Other variables are preserved.

REQUIRES _meta.context with deploymentUrl and deployKey from create_project.

Optional sandbox write-through:
- If _meta.context includes sandboxId and either workingDirectory or projectId,
  the tool will write env vars directly to .env.local in the sandbox repo.
- You can override the target file with _meta.context.envFile.`,
      inputSchema: setEnvVarsSchema,
    },
    async (args, extra) => {
      const ctx = getContext(extra)
      if (!ctx?.deploymentUrl || !ctx?.deployKey) return err('Missing deployment context')

      try {
        await setDeploymentEnvVars(ctx.deploymentUrl, ctx.deployKey, args.vars)
        const envFileWrite = await writeEnvToSandbox(ctx, args.vars)
        return ok({
          message: `Set ${Object.keys(args.vars).length} environment variable(s)`,
          envFileWrite,
        })
      } catch (e) {
        return err(errMsg(e))
      }
    },
  )

  // Tool: List Environment Variables
  server.registerTool(
    'list_env_vars',
    {
      title: 'List Environment Variables',
      description: `List all environment variables currently set on a Convex deployment.

Returns an array of variable names and values. Use this to verify configuration or debug issues.

REQUIRES _meta.context with deploymentUrl and deployKey from create_project.`,
      inputSchema: {},
    },
    async (_args, extra) => {
      const ctx = getContext(extra)
      if (!ctx?.deploymentUrl || !ctx?.deployKey) return err('Missing deployment context')

      try {
        const vars = await listDeploymentEnvVars(ctx.deploymentUrl, ctx.deployKey)
        return ok({ environmentVariables: vars })
      } catch (e) {
        return err(errMsg(e))
      }
    },
  )

  // Tool: Call Query
  server.registerTool(
    'call_query',
    {
      title: 'Call Convex Query',
      description: `Execute a read-only Convex query function to fetch data from the database.

Queries are for reading data - they cannot modify the database. Use call_mutation for writes.

The 'path' format is "filename:functionName":
- "messages:list" → calls the 'list' query in convex/messages.ts
- "users:getById" → calls the 'getById' query in convex/users.ts

Pass arguments as a JSON object matching the function's expected args.

Returns the query result (can be any JSON-serializable value).

REQUIRES _meta.context with deploymentUrl and deployKey from create_project.`,
      inputSchema: callFunctionSchema,
    },
    async (args, extra) => {
      const ctx = getContext(extra)
      if (!ctx?.deploymentUrl || !ctx?.deployKey) return err('Missing deployment context')

      try {
        const funcArgs = (args.args ?? {}) as Record<string, ConvexValue>
        const result = await callQuery(ctx.deploymentUrl, ctx.deployKey, args.path, funcArgs)
        if (result.status === 'error') return err(result.errorMessage)
        return ok({ value: result.value })
      } catch (e) {
        return err(errMsg(e))
      }
    },
  )

  // Tool: Call Mutation
  server.registerTool(
    'call_mutation',
    {
      title: 'Call Convex Mutation',
      description: `Execute a Convex mutation function to modify data in the database.

Mutations are for writing data - creating, updating, or deleting records. Use call_query for reads.

The 'path' format is "filename:functionName":
- "messages:send" → calls the 'send' mutation in convex/messages.ts
- "users:create" → calls the 'create' mutation in convex/users.ts
- "tasks:delete" → calls the 'delete' mutation in convex/tasks.ts

Pass arguments as a JSON object matching the function's expected args.

Returns the mutation result (often the ID of created/modified document, or null).

REQUIRES _meta.context with deploymentUrl and deployKey from create_project.`,
      inputSchema: callFunctionSchema,
    },
    async (args, extra) => {
      const ctx = getContext(extra)
      if (!ctx?.deploymentUrl || !ctx?.deployKey) return err('Missing deployment context')

      try {
        const funcArgs = (args.args ?? {}) as Record<string, ConvexValue>
        const result = await callMutation(ctx.deploymentUrl, ctx.deployKey, args.path, funcArgs)
        if (result.status === 'error') return err(result.errorMessage)
        return ok({ value: result.value })
      } catch (e) {
        return err(errMsg(e))
      }
    },
  )

  return server
}
