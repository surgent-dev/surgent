import { Hono } from "hono";
import { db } from "@/lib/db";
import { requireAuth } from "../middleware/auth";
import type { AppContext } from "@/types/application";
import { config } from "@/lib/config";
import { localWorkspacePath } from "@/lib/workspace";

const agent = new Hono<AppContext>();

// Proxy all OpenCode endpoints: /api/agent/:id/* → local opencode server with x-sandbox-id header
agent.all("/:id/*", requireAuth, async (c) => {
  const projectId = c.req.param("id");

  const project = await db
    .selectFrom("project")
    .select(["sandbox", "userId"])
    .where("id", "=", projectId)
    .executeTakeFirst();

  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }
  if (project.userId !== c.get("user")?.id) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const sandbox = project.sandbox as { id?: string; provider?: string } | null;
  if (!sandbox?.id) {
    return c.json({ error: "Sandbox not found" }, 400);
  }

  const url = new URL(c.req.url);
  const pathname = url.pathname.replace(`/api/agent/${projectId}`, "");

  const targetUrl = new URL(config.opencode.url);
  targetUrl.pathname = pathname;
  targetUrl.search = url.search;

  // Prefix sandbox ID with provider for opencode (e.g., "e2b:abc123" or "daytona:xyz")
  const prefixedSandboxId = sandbox.provider ? `${sandbox.provider}:${sandbox.id}` : sandbox.id;

  const headers = new Headers(c.req.raw.headers);
  headers.set("x-sandbox-id", prefixedSandboxId);
  headers.set("x-opencode-directory", localWorkspacePath(projectId));
  headers.delete("host");

  const accept = headers.get("accept") || "";
  const isSse = accept.includes("text/event-stream") || pathname === "/event" || pathname === "/global/event";

  try {
    const upstreamResp = await fetch(
      new Request(targetUrl.toString(), {
        method: c.req.method,
        headers,
        body: c.req.raw.body,
        signal: c.req.raw.signal,
      }),
    );

    if (!isSse) {
      return upstreamResp;
    }

    // Prevent buffering for SSE streams
    const outHeaders = new Headers(upstreamResp.headers);
    outHeaders.set("cache-control", "no-cache, no-transform");

    return new Response(upstreamResp.body, {
      status: upstreamResp.status,
      headers: outHeaders,
    });
  } catch {
    return c.text("Upstream unavailable", 502);
  }
});

export default agent;
