#!/usr/bin/env bun
/**
 * Main entry point for running OpenCode as a backend service.
 *
 * Configuration via environment variables:
 *   PORT - HTTP port (default: 4096)
 *   HOST - Hostname to bind (default: 127.0.0.1)
 *   LOG_LEVEL - DEBUG | INFO | WARN | ERROR (default: INFO)
 *
 * Runner is resolved per-request based on x-sandbox-id header:
 *   - With sandboxId → E2B sandbox
 *   - Without sandboxId → LocalRunner (runs locally)
 */
import { Log } from "./util/log"
import { Server } from "./server/server"

const port = Number(process.env.PORT ?? "4096")
const host = process.env.HOST ?? "127.0.0.1"
const logLevel = (process.env.LOG_LEVEL ?? "INFO") as Log.Level

await Log.init({ print: true, level: logLevel, dev: false })

const server = Server.listen({ port, hostname: host })
console.log(`OpenCode running at http://${host}:${server.port}`)
