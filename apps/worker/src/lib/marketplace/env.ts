import { generateAuthKeys } from '@/apis/convex'
import { config } from '@/lib/config'
import { db } from '@/lib/db'
import * as ProjectService from '@/services/projects'
import type { EnvDestination } from '@repo/db'
import type { EnvClassification, EnvRule } from './types'

const DEFAULT_CLASSIFICATIONS: Record<string, EnvClassification> = {
  // Integration-owned (Convex) — reprovisioned fresh
  CONVEX_DEPLOYMENT: 're-provision',
  CONVEX_URL: 're-provision',
  CONVEX_DEPLOY_KEY: 're-provision',
  VITE_CONVEX_URL: 're-provision',
  // System keys — regenerated per project
  JWT_PRIVATE_KEY: 're-generate',
  JWKS: 're-generate',
  SURGENT_API_KEY: 're-generate',
  OPENCODE_API_KEY: 're-generate',
  // Platform URLs — derived from config
  SURGENT_BASE_URL: 're-generate',
  OPENCODE_BASE_URL: 're-generate',
  SITE_URL: 're-generate',
  SURPAY_BASE_URL: 're-generate',
  OPENCODE_CONFIG_DIR: 're-generate',
}

export { DEFAULT_CLASSIFICATIONS }

export async function classifyEnvVars(
  listingId: string,
  sourceProjectId: string,
): Promise<EnvRule[]> {
  // Load explicit per-listing rules
  const explicitRules = await db
    .selectFrom('marketplace_env_rule')
    .select(['key', 'classification'])
    .where('listingId', '=', listingId)
    .execute()

  const ruleMap = new Map<string, EnvClassification>()
  for (const rule of explicitRules) {
    ruleMap.set(rule.key, rule.classification as EnvClassification)
  }

  // Load source env vars to discover all keys
  const sourceVars = await ProjectService.getEnvVarsByProjectId(sourceProjectId, 'development')

  const rules: EnvRule[] = []
  for (const v of sourceVars) {
    // Priority: explicit rule > integration-linked > default > skip
    if (ruleMap.has(v.key)) {
      rules.push({ key: v.key, classification: ruleMap.get(v.key)! })
    } else if (v.integrationId) {
      rules.push({ key: v.key, classification: 're-provision' })
    } else if (DEFAULT_CLASSIFICATIONS[v.key]) {
      rules.push({ key: v.key, classification: DEFAULT_CLASSIFICATIONS[v.key] })
    } else {
      rules.push({ key: v.key, classification: 'skip' })
    }
  }

  return rules
}

interface SourceVar {
  key: string
  value: string | null
  destination: EnvDestination | null
}

interface ResolveContext {
  apiKey: string
  previewUrl: string
}

export async function resolveEnvVars(
  rules: EnvRule[],
  sourceVars: SourceVar[],
  provisionedVars: Record<string, { value: string; destination: EnvDestination }>,
  ctx: ResolveContext,
): Promise<Record<string, { value: string; destination: EnvDestination }>> {
  const sourceMap = new Map<string, SourceVar>()
  for (const v of sourceVars) {
    sourceMap.set(v.key, v)
  }

  const result: Record<string, { value: string; destination: EnvDestination }> = {}

  // Cache auth keys so we only generate once
  let authKeys: { privateKey: string; jwks: string } | null = null

  for (const rule of rules) {
    const source = sourceMap.get(rule.key)
    const destination = source?.destination || 'client'

    switch (rule.classification) {
      case 're-provision': {
        const provisioned = provisionedVars[rule.key]
        if (provisioned) {
          result[rule.key] = provisioned
        }
        break
      }

      case 're-generate': {
        const value = await regenerateValue(rule.key, ctx, async () => {
          if (!authKeys) authKeys = await generateAuthKeys()
          return authKeys
        })
        if (value !== null) {
          result[rule.key] = { value, destination }
        }
        break
      }

      case 'copy': {
        if (source?.value) {
          result[rule.key] = { value: source.value, destination }
        }
        break
      }

      case 'skip':
        // Buyer must configure manually
        break
    }
  }

  return result
}

async function regenerateValue(
  key: string,
  ctx: ResolveContext,
  getAuthKeys: () => Promise<{ privateKey: string; jwks: string }>,
): Promise<string | null> {
  switch (key) {
    case 'JWT_PRIVATE_KEY':
      return (await getAuthKeys()).privateKey
    case 'JWKS':
      return (await getAuthKeys()).jwks
    case 'SURGENT_API_KEY':
    case 'OPENCODE_API_KEY':
      return ctx.apiKey
    case 'SURGENT_BASE_URL':
      return config.surgent.baseUrl || null
    case 'OPENCODE_BASE_URL':
      return config.opencode.baseUrl || null
    case 'OPENCODE_CONFIG_DIR':
      return config.opencode.configDir || null
    case 'SITE_URL':
      return ctx.previewUrl
    case 'SURPAY_BASE_URL':
      return config.surgent.baseUrl ? `${config.surgent.baseUrl}/api/pay` : null
    default:
      return null
  }
}
