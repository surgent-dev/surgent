import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  createProjectOnTeam,
  createDeployKey,
  deleteProject,
  setDeploymentEnvVars,
  listDeploymentEnvVars,
  callQuery,
  callMutation,
  type ConvexValue,
} from "@/apis/convex";

// Context passed to MCP tools - contains project credentials
export interface McpContext {
  deploymentUrl: string;
  deployKey: string;
  projectId?: string;
}

// Tool input schemas - using objects compatible with MCP SDK
const createProjectSchema = {
  name: z.string().describe("Name for the new Convex project"),
  deploymentType: z.enum(["dev", "prod"]).optional().describe("Deployment type (default: dev)"),
};

const deleteProjectSchema = {
  projectId: z.string().describe("ID of the project to delete"),
};

const setEnvVarsSchema = {
  vars: z.record(z.string(), z.string()).describe("Key-value pairs of environment variables to set"),
};

const callFunctionSchema = {
  path: z.string().describe('Function path in format "file:functionName" (e.g., "messages:list")'),
  args: z.record(z.string(), z.unknown()).optional().describe("Arguments to pass to the function"),
};

/**
 * Create the Convex MCP server with all tools registered
 */
export function createConvexMcpServer(): McpServer {
  const server = new McpServer({
    name: "convex-mcp",
    version: "1.0.0",
  });

  // Tool: Create Project
  server.registerTool(
    "create_project",
    {
      title: "Create Convex Project",
      description: `Create a new Convex project and deployment under the team account.

Use this when starting a new backend - it provisions a fresh Convex database instance.

Returns:
- project: Object with projectId, deploymentName, deploymentUrl, deployKey
- envVars: Ready-to-use environment variables object (CONVEX_DEPLOYMENT, CONVEX_URL, CONVEX_DEPLOY_KEY, VITE_CONVEX_URL)
- envFileContent: Complete .env file content as a string - write this directly to .env file

To set up the sandbox after creation:
1. Write envFileContent to .env file in the project root
2. Run 'npx convex dev' to start the development server

IMPORTANT: Save deploymentUrl and deployKey - you'll need them in _meta.context for subsequent operations (queries, mutations, env vars).`,
      inputSchema: createProjectSchema,
    },
    async (args) => {
      try {
        const project = await createProjectOnTeam({
          name: args.name,
          deploymentType: args.deploymentType,
        });

        // Create deploy key for the new project
        const deployKey = await createDeployKey(project.deploymentName);

        // Build ready-to-use env vars for the sandbox
        const envVars = {
          CONVEX_DEPLOYMENT: `dev:${project.deploymentName}`,
          CONVEX_URL: project.deploymentUrl,
          CONVEX_DEPLOY_KEY: deployKey,
          // For Vite/frontend apps
          VITE_CONVEX_URL: project.deploymentUrl,
        };

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  success: true,
                  project: {
                    ...project,
                    deployKey,
                  },
                  // Ready-to-use env vars - agent can write these directly to .env
                  envVars,
                  // Or as a single string for .env file
                  envFileContent: Object.entries(envVars)
                    .map(([k, v]) => `${k}=${v}`)
                    .join("\n"),
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
              }),
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Tool: Delete Project
  server.registerTool(
    "delete_project",
    {
      title: "Delete Convex Project",
      description: `Permanently delete a Convex project and all its data.

WARNING: This is irreversible! All data, functions, and deployments will be destroyed.

Use the projectId returned from create_project. Does not require _meta.context.`,
      inputSchema: deleteProjectSchema,
    },
    async (args) => {
      try {
        await deleteProject(args.projectId);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ success: true, message: "Project deleted successfully" }),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
              }),
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Tool: Set Environment Variables
  server.registerTool(
    "set_env_vars",
    {
      title: "Set Environment Variables",
      description: `Set environment variables on a Convex deployment.

Use this to configure API keys, secrets, or any runtime configuration your Convex functions need.
Variables are passed as key-value pairs: {"OPENAI_API_KEY": "sk-...", "DEBUG": "true"}

Existing variables with the same name will be overwritten. Other variables are preserved.

REQUIRES _meta.context with deploymentUrl and deployKey from create_project.`,
      inputSchema: setEnvVarsSchema,
    },
    async (args, extra) => {
      const ctx = extra._meta?.context as McpContext | undefined;
      if (!ctx?.deploymentUrl || !ctx?.deployKey) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: false,
                error: "Missing deployment context (deploymentUrl and deployKey required)",
              }),
            },
          ],
          isError: true,
        };
      }

      try {
        await setDeploymentEnvVars(ctx.deploymentUrl, ctx.deployKey, args.vars);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                message: `Set ${Object.keys(args.vars).length} environment variable(s)`,
              }),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
              }),
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Tool: List Environment Variables
  server.registerTool(
    "list_env_vars",
    {
      title: "List Environment Variables",
      description: `List all environment variables currently set on a Convex deployment.

Returns an array of variable names and values. Use this to verify configuration or debug issues.

REQUIRES _meta.context with deploymentUrl and deployKey from create_project.`,
      inputSchema: {},
    },
    async (_args, extra) => {
      const ctx = extra._meta?.context as McpContext | undefined;
      if (!ctx?.deploymentUrl || !ctx?.deployKey) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: false,
                error: "Missing deployment context (deploymentUrl and deployKey required)",
              }),
            },
          ],
          isError: true,
        };
      }

      try {
        const vars = await listDeploymentEnvVars(ctx.deploymentUrl, ctx.deployKey);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ success: true, environmentVariables: vars }),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
              }),
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Tool: Call Query
  server.registerTool(
    "call_query",
    {
      title: "Call Convex Query",
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
      const ctx = extra._meta?.context as McpContext | undefined;
      if (!ctx?.deploymentUrl || !ctx?.deployKey) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: false,
                error: "Missing deployment context (deploymentUrl and deployKey required)",
              }),
            },
          ],
          isError: true,
        };
      }

      try {
        const funcArgs = (args.args || {}) as Record<string, ConvexValue>;
        const result = await callQuery(ctx.deploymentUrl, ctx.deployKey, args.path, funcArgs);

        if (result.status === "error") {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  success: false,
                  error: result.errorMessage,
                  errorData: result.errorData,
                }),
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ success: true, value: result.value }),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
              }),
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Tool: Call Mutation
  server.registerTool(
    "call_mutation",
    {
      title: "Call Convex Mutation",
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
      const ctx = extra._meta?.context as McpContext | undefined;
      if (!ctx?.deploymentUrl || !ctx?.deployKey) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: false,
                error: "Missing deployment context (deploymentUrl and deployKey required)",
              }),
            },
          ],
          isError: true,
        };
      }

      try {
        const funcArgs = (args.args || {}) as Record<string, ConvexValue>;
        const result = await callMutation(ctx.deploymentUrl, ctx.deployKey, args.path, funcArgs);

        if (result.status === "error") {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  success: false,
                  error: result.errorMessage,
                  errorData: result.errorData,
                }),
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ success: true, value: result.value }),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
              }),
            },
          ],
          isError: true,
        };
      }
    },
  );

  return server;
}
