import { Hono } from "hono";
import { StreamableHTTPTransport } from "@hono/mcp";
import { createConvexMcpServer } from "@/mcp/convex";
import type { AppContext } from "@/types/application";

const mcp = new Hono<AppContext>();

// Create the MCP server and transport
const mcpServer = createConvexMcpServer();
const transport = new StreamableHTTPTransport();

/**
 * MCP endpoint for Convex tools
 *
 * Clients should send MCP requests with context in the request meta:
 * {
 *   "jsonrpc": "2.0",
 *   "method": "tools/call",
 *   "params": {
 *     "name": "call_query",
 *     "arguments": { "path": "messages:list", "args": {} },
 *     "_meta": {
 *       "context": {
 *         "deploymentUrl": "https://xyz.convex.cloud",
 *         "deployKey": "prod:..."
 *       }
 *     }
 *   }
 * }
 */
mcp.all("/convex", async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  if (!mcpServer.isConnected()) {
    await mcpServer.connect(transport);
  }

  return transport.handleRequest(c);
});

export default mcp;
