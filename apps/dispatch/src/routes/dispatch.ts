import { Hono } from "hono";
import type { AppContext } from "@/types/application";

const dispatch = new Hono<AppContext>();

function extractSubdomain(hostname: string): string | null {
  const parts = hostname.split(".");
  return parts.length >= 2 ? parts[0] || null : null;
}

dispatch.all("/*", async (c) => {
  const url = new URL(c.req.url);
  const subdomain = extractSubdomain(url.hostname);

  if (!subdomain) return c.notFound();

  if (!c.env.dispatcher) {
    return c.text("Dispatcher binding is not configured", 500);
  }

  try {
    const worker = c.env.dispatcher.get(subdomain);
    const targetRequest = new Request(url.toString(), c.req.raw);
    return await worker.fetch(targetRequest);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return c.text(`Dispatch failed: ${message}`, 502);
  }
});

export default dispatch;
