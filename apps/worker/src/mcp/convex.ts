import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { parse as parseDotEnv } from 'dotenv'
import { Sandbox as E2BSandbox } from 'e2b'
import type { ProjectMetadata, EnvDestination } from '@repo/db'
import {
  createProjectOnTeam,
  createDeployKey,
  deleteProject,
  setDeploymentEnvVars,
  listDeploymentEnvVars,
  callQuery,
  callMutation,
  generateAuthKeys,
  type ConvexValue,
} from '@/apis/convex'
import * as ProjectService from '@/services/projects'

interface EnvVarConfig {
  value: string
  destination: EnvDestination
}

interface EnvVarWithDestination {
  value: string
  destination: EnvDestination
}

function splitEnvVars(vars: Record<string, EnvVarConfig>): {
  server: Record<string, string> // Push to Convex deployment
  client: Record<string, string> // Write to sandbox .env
  forDb: Record<string, EnvVarWithDestination> // Store in Surgent DB with destination
} {
  const server: Record<string, string> = {}
  const client: Record<string, string> = {}
  const forDb: Record<string, EnvVarWithDestination> = {}

  for (const [key, { value, destination }] of Object.entries(vars)) {
    forDb[key] = { value, destination }
    if (destination === 'server' || destination === 'both') server[key] = value
    if (destination === 'client' || destination === 'both') client[key] = value
  }

  return { server, client, forDb }
}

// ============================================
// Types
// ============================================

export interface McpContext {
  deploymentUrl: string
  deployKey: string
  projectId?: string
  sandboxId?: string
  sandboxProvider?: string
  workingDirectory?: string
  envFile?: string
}

interface ConvexIntegrationConfig {
  convexProjectId?: string
  deployments?: {
    development?: { name?: string; url?: string }
    production?: { name?: string; url?: string }
  }
}

interface ToolContext {
  projectId: string
  integration: Awaited<ReturnType<typeof ProjectService.getIntegrationByProvider>>
  sandbox: Awaited<ReturnType<typeof ProjectService.getSandboxByProjectId>>
  deploymentUrl: string
  deployKey: string
}

type McpResponse = { content: { type: 'text'; text: string }[]; isError?: boolean }

type EnvWriteResult = { status: 'written'; path: string } | { status: 'failed'; error: string }

// ============================================
// Schemas
// ============================================

const createProjectSchema = {
  name: z.string().describe('Name for the new Convex project'),
}

const deleteProjectSchema = {
  projectId: z.string().describe('ID of the project to delete'),
}

const setEnvVarsSchema = {
  vars: z
    .record(z.string(), z.string())
    .describe('Key-value pairs of environment variables to set'),
  destination: z
    .enum(['server', 'client', 'both'])
    .optional()
    .describe('Where these vars should be stored (server, client, or both)'),
}

const callFunctionSchema = {
  path: z.string().describe('Function path in format "file:functionName" (e.g., "messages:list")'),
  args: z.record(z.string(), z.unknown()).optional().describe('Arguments to pass to the function'),
}

// ============================================
// Helpers
// ============================================

const ok = (data: Record<string, unknown>): McpResponse => ({
  content: [{ type: 'text', text: JSON.stringify({ success: true, ...data }, null, 2) }],
})

const err = (error: string): McpResponse => ({
  content: [{ type: 'text', text: JSON.stringify({ success: false, error }) }],
  isError: true,
})

const errMsg = (e: unknown): string => (e instanceof Error ? e.message : String(e))

function toEnvFileContent(vars: Record<string, string>): string {
  return Object.entries(vars)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')
}

function formatEnvWithQuotes(vars: Record<string, string>): string {
  const lines = Object.entries(vars).map(
    ([k, v]) => `${k}=${/^[A-Za-z0-9_./:@-]+$/.test(v) ? v : JSON.stringify(v)}`,
  )
  return lines.length ? `${lines.join('\n')}\n` : ''
}

function extractProjectId(extra: unknown): string | undefined {
  const meta = extra as { _meta?: { context?: { projectId?: string } } } | undefined
  return meta?._meta?.context?.projectId
}

async function getToolContext(extra: unknown): Promise<ToolContext | null> {
  const projectId = extractProjectId(extra)
  if (!projectId) return null

  const [integration, sandbox] = await Promise.all([
    ProjectService.getIntegrationByProvider(projectId, 'convex'),
    ProjectService.getSandboxByProjectId(projectId),
  ])
  if (!integration?.id) return null

  const config = integration.config as ConvexIntegrationConfig | null
  const deploymentUrl = config?.deployments?.development?.url
  if (!deploymentUrl) return null

  const vars = await ProjectService.getEnvVarsByProjectId(projectId, 'development', integration.id)
  const deployKey = vars.find((v) => v.key === 'CONVEX_DEPLOY_KEY')?.value
  if (!deployKey) return null

  return { projectId, integration, sandbox, deploymentUrl, deployKey }
}

async function writeEnvToSandbox(
  projectId: string,
  sandbox: ToolContext['sandbox'],
  vars: Record<string, string>,
): Promise<EnvWriteResult> {
  if (!sandbox?.id) return { status: 'failed', error: 'No sandbox available' }

  try {
    const project = await ProjectService.getProjectById(projectId)
    const metadata = project?.metadata as ProjectMetadata | undefined
    if (!metadata?.workingDirectory) return { status: 'failed', error: 'No working directory' }

    const path = `${metadata.workingDirectory.replace(/\/$/, '')}/.env`
    const sb = await E2BSandbox.connect(sandbox.id)
    const existing = await sb.files.read(path).catch(() => '')
    await sb.files.write(path, formatEnvWithQuotes({ ...parseDotEnv(existing), ...vars }))
    return { status: 'written', path }
  } catch (e) {
    return { status: 'failed', error: errMsg(e) }
  }
}

// ============================================
// MCP Server
// ============================================

export function createConvexMcpServer(): McpServer {
  const server = new McpServer({ name: 'convex-mcp', version: '1.0.0' })

  server.registerTool(
    'create_project',
    {
      title: 'Create Convex Project',
      description: `Create a new Convex project for backend development.

Use this when starting a new backend - it provisions a fresh Convex database instance.

Returns:
- project: Object with projectId, deploymentName, deploymentUrl, deployKey
- envVars: Environment variables (CONVEX_DEPLOYMENT, CONVEX_URL, CONVEX_DEPLOY_KEY, VITE_CONVEX_URL, SITE_URL)
- envFileContent: Complete .env file content as a string
- integration: The integration record (id, provider, status)

If Convex integration already exists, returns existing. Subsequent tools auto-resolve credentials from projectId.`,
      inputSchema: createProjectSchema,
    },
    async (args, extra) => {
      const projectId = extractProjectId(extra)
      if (!projectId) return err('Missing projectId')

      try {
        const sandbox = await ProjectService.getSandboxByProjectId(projectId)
        const siteUrl = sandbox?.host ?? 'http://localhost:5173'

        const existingIntegration = await ProjectService.getIntegrationByProvider(
          projectId,
          'convex',
        )

        if (existingIntegration) {
          const config = existingIntegration.config as ConvexIntegrationConfig | null
          const dev = config?.deployments?.development
          const envVarRows = await ProjectService.getEnvVarsByProjectId(
            projectId,
            'development',
            existingIntegration.id ?? undefined,
          )
          const envVars = Object.fromEntries(
            envVarRows
              .filter((row) => row.value && row.destination !== 'server')
              .map((row) => [row.key, row.value as string]),
          )

          return ok({
            message:
              'Convex integration already exists. Returning existing integration and env vars.',
            alreadyExists: true,
            integration: {
              id: existingIntegration.id,
              provider: 'convex',
              status: existingIntegration.status,
              convexProjectId: config?.convexProjectId,
              deploymentName: dev?.name,
              deploymentUrl: dev?.url,
            },
            envVars,
            envFileContent: toEnvFileContent(envVars),
          })
        }

        const project = await createProjectOnTeam({ name: args.name, deploymentType: 'dev' })
        const deployKey = await createDeployKey(project.deploymentName)
        const authKeys = await generateAuthKeys()

        // Define all env vars with their destinations
        const allEnvVars: Record<string, EnvVarConfig> = {
          // Convex CLI/SDK - client only (dev tooling)
          CONVEX_DEPLOYMENT: { value: `dev:${project.deploymentName}`, destination: 'client' },
          CONVEX_URL: { value: project.deploymentUrl, destination: 'client' },
          CONVEX_DEPLOY_KEY: { value: deployKey, destination: 'client' },
          VITE_CONVEX_URL: { value: project.deploymentUrl, destination: 'client' },
          // Auth - SITE_URL needed both places, keys are secrets (server only)
          SITE_URL: { value: siteUrl, destination: 'both' },
          JWT_PRIVATE_KEY: { value: authKeys.privateKey, destination: 'server' },
          JWKS: { value: authKeys.jwks, destination: 'server' },
        }

        const { server: serverVars, client: clientVars, forDb: dbVars } = splitEnvVars(allEnvVars)

        // Push server vars to Convex deployment
        await setDeploymentEnvVars(project.deploymentUrl, deployKey, serverVars)

        const integration = await ProjectService.createIntegration({
          projectId,
          provider: 'convex',
          config: {
            convexProjectId: project.projectId,
            deployments: {
              development: { name: project.deploymentName, url: project.deploymentUrl },
            },
          },
          status: 'connected',
        })

        // Save ALL vars to Surgent DB (with destination), but only CLIENT vars to sandbox .env
        await ProjectService.upsertEnvVars(projectId, 'development', dbVars, integration.id)

        const envFileWrite = await writeEnvToSandbox(projectId, sandbox, clientVars)

        const message =
          envFileWrite.status === 'written'
            ? `Convex project created and env variables saved. Also written to ${envFileWrite.path}.`
            : 'Convex project created and env variables saved. Write envFileContent to .env to configure your app.'

        return ok({
          message,
          alreadyExists: false,
          project: { ...project, deployKey },
          integration: { id: integration.id, provider: 'convex', status: 'connected' },
          envVars: clientVars,
          envFileContent: toEnvFileContent(clientVars),
          envFileWrite,
        })
      } catch (e) {
        return err(errMsg(e))
      }
    },
  )

  server.registerTool(
    'delete_project',
    {
      title: 'Delete Convex Project',
      description: `Permanently delete a Convex project and all its data.

WARNING: This is irreversible! All data, functions, and deployments will be destroyed.

Use the projectId returned from create_project.`,
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

  server.registerTool(
    'set_env_vars',
    {
      title: 'Set Environment Variables',
      description: `Set environment variables on a Convex deployment.

Use this to configure API keys, secrets, or any runtime configuration your Convex functions need.
Variables are passed as key-value pairs: {"OPENAI_API_KEY": "sk-...", "DEBUG": "true"}
Optional "destination" controls where vars are stored: server (default), client, or both.

Existing variables with the same name will be overwritten. Other variables are preserved.`,
      inputSchema: setEnvVarsSchema,
    },
    async (args, extra) => {
      const ctx = await getToolContext(extra)
      if (!ctx) return err('Convex not provisioned')

      try {
        const destination = args.destination ?? 'server'
        const dbVars = Object.fromEntries(
          Object.entries(args.vars).map(([key, value]) => [key, { value, destination }]),
        )
        const shouldSetServer = destination === 'server' || destination === 'both'
        const shouldWriteClient = destination === 'client' || destination === 'both'

        if (shouldSetServer) {
          await setDeploymentEnvVars(ctx.deploymentUrl, ctx.deployKey, args.vars)
        }

        await ProjectService.upsertEnvVars(
          ctx.projectId,
          'development',
          dbVars,
          ctx.integration?.id,
        )

        const envFileWrite = shouldWriteClient
          ? await writeEnvToSandbox(ctx.projectId, ctx.sandbox, args.vars)
          : { status: 'failed', error: 'Skipped writing .env for server-only vars' }
        return ok({
          message: `Set ${Object.keys(args.vars).length} environment variable(s)`,
          envFileWrite,
        })
      } catch (e) {
        return err(errMsg(e))
      }
    },
  )

  server.registerTool(
    'list_env_vars',
    {
      title: 'List Environment Variables',
      description: `List all environment variables currently set on a Convex deployment.

Returns an array of variable names and values.`,
      inputSchema: {},
    },
    async (_args, extra) => {
      const ctx = await getToolContext(extra)
      if (!ctx) return err('Convex not provisioned')

      try {
        const vars = await listDeploymentEnvVars(ctx.deploymentUrl, ctx.deployKey)
        return ok({ environmentVariables: vars })
      } catch (e) {
        return err(errMsg(e))
      }
    },
  )

  server.registerTool(
    'call_query',
    {
      title: 'Call Convex Query',
      description: `Execute a read-only Convex query function to fetch data from the database.

Queries are for reading data - they cannot modify the database. Use call_mutation for writes.

The 'path' format is "filename:functionName":
- "messages:list" → calls the 'list' query in convex/messages.ts
- "users:getById" → calls the 'getById' query in convex/users.ts

Pass arguments as a JSON object matching the function's expected args.`,
      inputSchema: callFunctionSchema,
    },
    async (args, extra) => {
      const ctx = await getToolContext(extra)
      if (!ctx) return err('Convex not provisioned')

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

Pass arguments as a JSON object matching the function's expected args.`,
      inputSchema: callFunctionSchema,
    },
    async (args, extra) => {
      const ctx = await getToolContext(extra)
      if (!ctx) return err('Convex not provisioned')

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
