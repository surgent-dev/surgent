import "dotenv/config"
import { Template, defaultBuildLogger } from "e2b"
import { template, templateName } from "./template"

const isProd = process.env.NODE_ENV === "production"

await Template.build(template, {
  alias: templateName,
  cpuCount: isProd ? 2 : 2,
  memoryMB: isProd ? 1024 * 4 : 1024 * 4,
  onBuildLogs: defaultBuildLogger(),
})

