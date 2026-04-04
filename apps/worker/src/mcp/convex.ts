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
  listDeployments,
  callQuery,
  callMutation,
  callAction,
  fetchDeploymentLogs,
  fetchFunctionSpec,
  fetchInsights,
  type ConvexValue,
  type LogEntry,
  generateAuthKeys,
} from '@/apis/convex'
import * as ProjectService from '@/services/projects'
import { config } from '@/lib/config'
import {
  getConvexCredentials,
  toEnvMap,
  withDeployment,
  parseDeploymentName,
  parseDeploymentNameFromUrl,
  type ConvexIntegrationConfig,
  type ConvexEnv,
} from '@/lib/convex-env'

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

interface ToolContext {
  projectId: string
  env: ConvexEnv
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
  region: z
    .string()
    .optional()
    .describe(
      'Optional Convex deployment region such as "aws-us-east-1" or "aws-eu-west-1". Uses the team default if omitted.',
    ),
}

const deleteProjectSchema = {
  projectId: z.string().describe('ID of the project to delete'),
}

const envParam = {
  env: z
    .enum(['development', 'production'])
    .default('development')
    .describe('Target environment: "development" or "production".'),
}

const setEnvVarsSchema = {
  ...envParam,
  vars: z
    .record(z.string(), z.string())
    .describe('Required. Object containing key-value pairs to set'),
}

const callFunctionSchema = {
  ...envParam,
  path: z.string().describe('Function path in format "file:functionName" (e.g., "messages:list")'),
  args: z.record(z.string(), z.unknown()).optional().describe('Arguments to pass to the function'),
}

const readLogsSchema = {
  ...envParam,
  limit: z
    .number()
    .int()
    .positive()
    .max(1000)
    .default(50)
    .describe('Number of recent log entries to return (max 1000).'),
  success: z
    .boolean()
    .default(false)
    .describe('Include successful function logs. By default only errors are shown.'),
}

const cloneEnvVarsSchema = {
  sourceEnv: z
    .enum(['development', 'production'])
    .describe('Source environment to copy variables from.'),
  targetEnv: z
    .enum(['development', 'production'])
    .describe('Target environment to copy variables to.'),
  exclude: z
    .array(z.string())
    .optional()
    .describe(
      'Variable names to exclude from cloning (e.g., SITE_URL, CONVEX_DEPLOYMENT). Env-specific vars like SITE_URL are always excluded.',
    ),
  overwrite: z
    .boolean()
    .default(false)
    .describe(
      'Whether to overwrite existing variables on the target. Default: false (skip existing).',
    ),
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

const UDF_PREFIX: Record<string, string> = {
  Query: 'Q',
  Mutation: 'M',
  Action: 'A',
  HttpAction: 'H',
}

function formatLogEntry(e: LogEntry): string {
  const ts = new Date(e.timestamp * 1000).toLocaleString()
  const prefix = UDF_PREFIX[e.udfType] ?? e.udfType[0]
  const header = `[${ts}] [CONVEX ${prefix}(${e.identifier})]`

  const parts: string[] = []
  for (const line of e.logLines) {
    const msg = line.messages.join(' ') + (line.isTruncated ? ' (truncated)' : '')
    parts.push(`${header} [${line.level}] ${msg}`)
  }
  if (e.error) {
    parts.push(`${header} ${e.error}`)
  } else if (e.executionTime != null) {
    parts.push(`${header} Function executed in ${Math.ceil(e.executionTime * 1000)} ms`)
  }
  return parts.join('\n')
}

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

async function getToolContext(extra: unknown, env: ConvexEnv): Promise<ToolContext | null> {
  const projectId = extractProjectId(extra)
  if (!projectId) return null

  const [integration, sandbox, creds] = await Promise.all([
    ProjectService.getIntegrationByProvider(projectId, 'convex'),
    ProjectService.getSandboxByProjectId(projectId),
    getConvexCredentials(projectId, env),
  ])
  if (!integration?.id || !creds) return null

  return {
    projectId,
    env,
    integration,
    sandbox,
    deploymentUrl: creds.deploymentUrl,
    deployKey: creds.deployKey,
  }
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
- project.region: The configured hosting region if one was requested
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
        const [sandbox, existingIntegration, projectEnvVars] = await Promise.all([
          ProjectService.getSandboxByProjectId(projectId),
          ProjectService.getIntegrationByProvider(projectId, 'convex'),
          ProjectService.getEnvVarsByProjectId(projectId, 'development'),
        ])
        const siteUrl = sandbox?.host ?? 'http://localhost:5173'
        const surgentApiKey = projectEnvVars.find((v) => v.key === 'SURGENT_API_KEY')?.value

        if (existingIntegration) {
          const cfg = existingIntegration.config as ConvexIntegrationConfig | null
          const envVarRows = await ProjectService.getEnvVarsByProjectId(projectId, 'development')
          const envMap = toEnvMap(envVarRows)
          const envVars = toEnvMap(envVarRows.filter((row) => row.destination !== 'server'))
          const deploymentUrl = envMap.CONVEX_URL
          const deploymentName =
            parseDeploymentName(envMap.CONVEX_DEPLOYMENT) ??
            parseDeploymentNameFromUrl(deploymentUrl)

          return ok({
            message:
              'Convex integration already exists. Returning existing integration and env vars.',
            alreadyExists: true,
            integration: {
              id: existingIntegration.id,
              provider: 'convex',
              status: existingIntegration.status,
              convexProjectId: cfg?.convexProjectId,
              region: cfg?.region,
              deploymentName,
              deploymentUrl,
            },
            envVars,
            envFileContent: toEnvFileContent(envVars),
          })
        }

        const [project, authKeys] = await Promise.all([
          createProjectOnTeam({
            name: args.name,
            deploymentType: 'dev',
            deploymentRegion: args.region,
          }),
          generateAuthKeys(),
        ])
        const deployKey = await createDeployKey(project.deploymentName)

        if (!surgentApiKey) throw new Error('SURGENT_API_KEY not found for project')

        // Define all env vars with their destinations
        const allEnvVars: Record<string, EnvVarConfig> = {
          // Convex CLI/SDK - client only (dev tooling)
          CONVEX_DEPLOYMENT: { value: `dev:${project.deploymentName}`, destination: 'client' },
          CONVEX_URL: { value: project.deploymentUrl, destination: 'client' },
          CONVEX_DEPLOY_KEY: { value: deployKey, destination: 'client' },
          VITE_CONVEX_URL: { value: project.deploymentUrl, destination: 'client' },
          // Auth - SITE_URL needed both places
          SITE_URL: { value: siteUrl, destination: 'both' },
          JWT_PRIVATE_KEY: { value: authKeys.privateKey, destination: 'server' },
          JWKS: { value: authKeys.jwks, destination: 'server' },
          SURGENT_API_KEY: { value: surgentApiKey, destination: 'server' },
          // Payments - Pay API base URL for Convex actions
          ...(config.surgent.baseUrl && {
            SURPAY_BASE_URL: { value: `${config.surgent.baseUrl}/api/pay`, destination: 'server' },
          }),
        }

        const { server: serverVars, client: clientVars, forDb: dbVars } = splitEnvVars(allEnvVars)

        // Push server vars to Convex deployment
        await setDeploymentEnvVars(project.deploymentUrl, deployKey, serverVars)

        const integration = await ProjectService.createIntegration({
          projectId,
          provider: 'convex',
          config: withDeployment(
            {
              convexProjectId: project.projectId,
              region: project.deploymentRegion,
            },
            'development',
            {
              name: project.deploymentName,
              url: project.deploymentUrl,
            },
          ) as Record<string, unknown>,
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

Input: { "vars": { "KEY": "value" }, "env": "development" }

Pass "env" to target development (default) or production.
Use this to configure API keys, secrets, or any runtime configuration your Convex functions need.
Existing variables with the same name will be overwritten. Other variables are preserved.`,
      inputSchema: setEnvVarsSchema,
    },
    async (args, extra) => {
      const ctx = await getToolContext(extra, args.env)
      if (!ctx) return err(`Convex ${args.env} deployment not provisioned`)

      try {
        await setDeploymentEnvVars(ctx.deploymentUrl, ctx.deployKey, args.vars)

        const dbVars = Object.fromEntries(
          Object.entries(args.vars).map(([key, value]) => [
            key,
            { value, destination: 'server' as const },
          ]),
        )
        await ProjectService.upsertEnvVars(ctx.projectId, ctx.env, dbVars, ctx.integration?.id)

        return ok({
          message: `Set ${Object.keys(args.vars).length} environment variable(s) on ${ctx.env}`,
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

Pass "env" to target development (default) or production.
Returns an array of variable names and values.`,
      inputSchema: envParam,
    },
    async (args, extra) => {
      const ctx = await getToolContext(extra, args.env)
      if (!ctx) return err(`Convex ${args.env} deployment not provisioned`)

      try {
        const vars = await listDeploymentEnvVars(ctx.deploymentUrl, ctx.deployKey)
        return ok({ env: args.env, environmentVariables: vars })
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
Pass "env" to target development (default) or production.

The 'path' format is "filename:functionName":
- "messages:list" → calls the 'list' query in convex/messages.ts
- "users:getById" → calls the 'getById' query in convex/users.ts

Pass arguments as a JSON object matching the function's expected args.`,
      inputSchema: callFunctionSchema,
    },
    async (args, extra) => {
      const ctx = await getToolContext(extra, args.env)
      if (!ctx) return err(`Convex ${args.env} deployment not provisioned`)

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
Pass "env" to target development (default) or production.

The 'path' format is "filename:functionName":
- "messages:send" → calls the 'send' mutation in convex/messages.ts
- "users:create" → calls the 'create' mutation in convex/users.ts
- "tasks:delete" → calls the 'delete' mutation in convex/tasks.ts

Pass arguments as a JSON object matching the function's expected args.`,
      inputSchema: callFunctionSchema,
    },
    async (args, extra) => {
      const ctx = await getToolContext(extra, args.env)
      if (!ctx) return err(`Convex ${args.env} deployment not provisioned`)

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

  server.registerTool(
    'read_logs',
    {
      title: 'Read Convex Logs',
      description: `Fetch recent function execution logs from a Convex deployment.

Pass "env" to target development (default) or production.
Use "limit" to control how many entries (default 50, max 1000).
Shows only errors by default — set "success" to true to include all executions.`,
      inputSchema: readLogsSchema,
    },
    async (args, extra) => {
      const ctx = await getToolContext(extra, args.env)
      if (!ctx) return err(`Convex ${args.env} deployment not provisioned`)

      try {
        const { entries } = await fetchDeploymentLogs(ctx.deploymentUrl, ctx.deployKey)

        const filtered = args.success ? entries : entries.filter((e) => e.error)
        const limited = filtered.slice(-args.limit)

        if (!limited.length) {
          const msg = args.success ? `No ${args.env} logs found` : `No ${args.env} errors found`
          return ok({ env: args.env, count: 0, message: msg })
        }

        return ok({
          env: args.env,
          count: limited.length,
          logs: limited.map(formatLogEntry).join('\n\n'),
        })
      } catch (e) {
        return err(errMsg(e))
      }
    },
  )

  server.registerTool(
    'call_action',
    {
      title: 'Call Convex Action',
      description: `Execute a Convex action function for external API calls or side effects.

Actions are for calling third-party APIs, sending emails, processing files, etc.
They run in Node.js and can use any npm package. They CANNOT access the database directly.
Pass "env" to target development (default) or production.

The 'path' format is "filename:functionName":
- "ai:generate" → calls the 'generate' action in convex/ai.ts
- "emails:sendWelcome" → calls the 'sendWelcome' action in convex/emails.ts

Pass arguments as a JSON object matching the function's expected args.`,
      inputSchema: callFunctionSchema,
    },
    async (args, extra) => {
      const ctx = await getToolContext(extra, args.env)
      if (!ctx) return err(`Convex ${args.env} deployment not provisioned`)

      try {
        const funcArgs = (args.args ?? {}) as Record<string, ConvexValue>
        const result = await callAction(ctx.deploymentUrl, ctx.deployKey, args.path, funcArgs)
        if (result.status === 'error') return err(result.errorMessage)
        return ok({ value: result.value })
      } catch (e) {
        return err(errMsg(e))
      }
    },
  )

  server.registerTool(
    'get_insights',
    {
      title: 'Get Deployment Insights',
      description: `Fetch deployment health insights for the last 72 hours.

Shows OCC (Optimistic Concurrency Control) conflicts, resource limit issues, slow functions,
and other operational diagnostics. Use this BEFORE blaming code when things aren't working.

Pass "env" to target development (default) or production.
Returns a list of insight entries with type, message, severity, and optional details.`,
      inputSchema: envParam,
    },
    async (args, extra) => {
      const ctx = await getToolContext(extra, args.env)
      if (!ctx) return err(`Convex ${args.env} deployment not provisioned`)

      try {
        const teamId = config.convex.teamId
        if (!teamId) return err('Missing CONVEX_TEAM_ID')

        const deploymentName = parseDeploymentNameFromUrl(ctx.deploymentUrl) ?? ctx.deploymentUrl
        const insights = await fetchInsights(teamId, deploymentName)

        if (!insights.length) {
          return ok({ env: args.env, count: 0, message: `No issues found in the last 72 hours` })
        }

        return ok({
          env: args.env,
          count: insights.length,
          insights,
        })
      } catch (e) {
        return err(errMsg(e))
      }
    },
  )

  server.registerTool(
    'function_spec',
    {
      title: 'Get Function Spec',
      description: `Fetch metadata for all registered Convex functions on a deployment.

Returns function paths, types (Query/Mutation/Action/HttpAction), visibility (public/internal),
and argument/return validators. Use this to understand the available API surface.

Pass "env" to target development (default) or production.`,
      inputSchema: envParam,
    },
    async (args, extra) => {
      const ctx = await getToolContext(extra, args.env)
      if (!ctx) return err(`Convex ${args.env} deployment not provisioned`)

      try {
        const spec = await fetchFunctionSpec(ctx.deploymentUrl, ctx.deployKey)
        const grouped = {
          queries: spec.filter((f) => f.functionType === 'Query'),
          mutations: spec.filter((f) => f.functionType === 'Mutation'),
          actions: spec.filter((f) => f.functionType === 'Action'),
          httpActions: spec.filter((f) => f.functionType === 'HttpAction'),
        }
        return ok({
          env: args.env,
          totalFunctions: spec.length,
          ...grouped,
        })
      } catch (e) {
        return err(errMsg(e))
      }
    },
  )

  server.registerTool(
    'list_deployments',
    {
      title: 'List Deployments',
      description: `List all deployments (dev, prod, preview) for the current Convex project.

Returns deployment names, types, URLs, and regions. Useful for understanding the deployment
landscape before creating new deployments or promoting environments.`,
      inputSchema: {},
    },
    async (_args, extra) => {
      const projectId = extractProjectId(extra)
      if (!projectId) return err('Missing projectId')

      try {
        const integration = await ProjectService.getIntegrationByProvider(projectId, 'convex')
        if (!integration) return err('Convex integration not found')

        const cfg = integration.config as ConvexIntegrationConfig | null
        if (!cfg?.convexProjectId) return err('Missing Convex project ID')

        const deployments = await listDeployments(cfg.convexProjectId)
        return ok({ deployments })
      } catch (e) {
        return err(errMsg(e))
      }
    },
  )

  server.registerTool(
    'clone_env_vars',
    {
      title: 'Clone Environment Variables',
      description: `Copy environment variables from one deployment environment to another.

Clones all server-side environment variables from source to target. Env-specific variables
(SITE_URL, CONVEX_DEPLOYMENT, VITE_CONVEX_URL, CONVEX_URL, CONVEX_DEPLOY_KEY) are always excluded.

Set "overwrite" to true to replace existing variables on the target. By default, existing
variables on the target are preserved (skipped).

Common use case: clone dev env vars to production before first deploy.`,
      inputSchema: cloneEnvVarsSchema,
    },
    async (args, extra) => {
      const sourceCtx = await getToolContext(extra, args.sourceEnv)
      if (!sourceCtx) return err(`Convex ${args.sourceEnv} deployment not provisioned`)

      const targetCtx = await getToolContext(extra, args.targetEnv)
      if (!targetCtx) return err(`Convex ${args.targetEnv} deployment not provisioned`)

      try {
        const sourceVars = await listDeploymentEnvVars(sourceCtx.deploymentUrl, sourceCtx.deployKey)

        // Always exclude env-specific variables
        const alwaysExclude = new Set([
          'SITE_URL',
          'CONVEX_DEPLOYMENT',
          'VITE_CONVEX_URL',
          'CONVEX_URL',
          'CONVEX_DEPLOY_KEY',
          ...(args.exclude ?? []),
        ])

        const varsToClone: Record<string, string> = {}
        for (const [key, value] of Object.entries(sourceVars)) {
          if (!alwaysExclude.has(key)) varsToClone[key] = value
        }

        if (!Object.keys(varsToClone).length) {
          return ok({ message: 'No variables to clone (all excluded)', cloned: 0, skipped: 0 })
        }

        let targetVars: Record<string, string> = {}
        if (!args.overwrite) {
          targetVars = await listDeploymentEnvVars(targetCtx.deploymentUrl, targetCtx.deployKey)
        }

        const toSet: Record<string, string> = {}
        let skipped = 0
        for (const [key, value] of Object.entries(varsToClone)) {
          if (!args.overwrite && key in targetVars) {
            skipped++
          } else {
            toSet[key] = value
          }
        }

        if (Object.keys(toSet).length) {
          await setDeploymentEnvVars(targetCtx.deploymentUrl, targetCtx.deployKey, toSet)
        }

        return ok({
          message: `Cloned ${Object.keys(toSet).length} variable(s) from ${args.sourceEnv} to ${args.targetEnv}`,
          cloned: Object.keys(toSet).length,
          skipped,
          variables: Object.keys(toSet),
        })
      } catch (e) {
        return err(errMsg(e))
      }
    },
  )

  server.registerTool(
    'env_diff',
    {
      title: 'Compare Environment Variables',
      description: `Compare environment variables between development and production deployments.

Shows which variables exist only in dev, only in prod, and which have different values.
Useful before promoting to production to ensure all required variables are set.`,
      inputSchema: {},
    },
    async (_args, extra) => {
      const devCtx = await getToolContext(extra, 'development')
      if (!devCtx) return err('Convex development deployment not provisioned')

      const prodCtx = await getToolContext(extra, 'production')
      if (!prodCtx) return err('Convex production deployment not provisioned')

      try {
        const [devVars, prodVars] = await Promise.all([
          listDeploymentEnvVars(devCtx.deploymentUrl, devCtx.deployKey),
          listDeploymentEnvVars(prodCtx.deploymentUrl, prodCtx.deployKey),
        ])

        const allKeys = new Set([...Object.keys(devVars), ...Object.keys(prodVars)])
        const onlyInDev: string[] = []
        const onlyInProd: string[] = []
        const different: string[] = []
        const same: string[] = []

        for (const key of allKeys) {
          if (!(key in prodVars)) onlyInDev.push(key)
          else if (!(key in devVars)) onlyInProd.push(key)
          else if (devVars[key] !== prodVars[key]) different.push(key)
          else same.push(key)
        }

        return ok({
          onlyInDev,
          onlyInProd,
          different,
          same: same.length,
          summary: `${onlyInDev.length} dev-only, ${onlyInProd.length} prod-only, ${different.length} different, ${same.length} matching`,
        })
      } catch (e) {
        return err(errMsg(e))
      }
    },
  )

  return server
}
