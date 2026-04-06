import { config } from '@/lib/config'
import { db } from '@/lib/db'
import { createLogger } from '@/lib/logger'
import { getProvider, workspacePath } from '@/lib/sandbox'
import { storage } from '@/lib/storage'
import { buildBashCommand, shellQuote } from '@/lib/utils'
import { checkBillingFeature } from '@/lib/billing'
import {
  createProjectOnTeam,
  createDeployKey,
  generateAuthKeys,
  setDeploymentEnvVars,
} from '@/apis/convex'
import { withDeployment } from '@/lib/convex-env'
import * as ProjectService from '@/services/projects'
import * as MarketplaceService from '@/services/marketplace'
import {
  buildOpencodeEnv,
  getProjectEnvVars,
  initializeDevServer,
  setupOpencodeAgent,
  finalizeProjectProvisioning,
} from '@/controllers/projects'

const log = createLogger('marketplace-fulfill')

const PREVIEW_PORT = 3000

export interface FulfillmentJobData {
  purchaseId: string
  snapshotId: string
  buyerUserId: string
  buyerOrgId: string
  sellerProjectId: string
  listingId: string
}

interface FulfillmentMeta {
  apiKeyCreatedAt?: string
  sandboxId?: string
  previewUrl?: string
  snapshotExtractedAt?: string
  convexProvisionedAt?: string
  envVarsAppliedAt?: string
  initializedAt?: string
  opencodeReadyAt?: string
}

// Env vars that are re-created by integration provisioners — skip entirely
const REPROVISION_KEYS = new Set([
  'CONVEX_DEPLOYMENT',
  'CONVEX_URL',
  'CONVEX_DEPLOY_KEY',
  'VITE_CONVEX_URL',
])

// Env vars that are freshly generated per buyer project — skip entirely
const REGENERATE_KEYS = new Set(['SURGENT_API_KEY', 'JWT_PRIVATE_KEY', 'JWKS'])

// System-managed env vars — skip entirely
const SKIP_KEYS = new Set([
  'OPENCODE_API_KEY',
  'OPENCODE_BASE_URL',
  'OPENCODE_CONFIG_DIR',
  'SURGENT_BASE_URL',
])

function getMeta(purchase: { metadata: Record<string, unknown> | null }): FulfillmentMeta {
  return (purchase.metadata || {}) as FulfillmentMeta
}

async function updateStep(purchaseId: string, step: string, extra?: Record<string, unknown>) {
  const timestamp = new Date().toISOString()
  await MarketplaceService.updatePurchaseMetadata(purchaseId, {
    [`${step}At`]: timestamp,
    ...extra,
  })
  await MarketplaceService.updatePurchaseStatus(purchaseId, 'provisioning', { step })
  log.info({ purchaseId, step }, 'fulfillment step completed')
}

export async function runMarketplaceFulfillmentJob(data: FulfillmentJobData): Promise<void> {
  const { purchaseId, snapshotId, buyerUserId, buyerOrgId, sellerProjectId } = data

  // Idempotency: skip if already done
  let purchase = await MarketplaceService.getPurchaseById(purchaseId)
  if (!purchase) throw new Error(`Purchase ${purchaseId} not found`)
  if (purchase.status === 'ready') return

  await MarketplaceService.updatePurchaseStatus(purchaseId, 'provisioning')

  const snapshot = await MarketplaceService.getSnapshotById(snapshotId)
  if (!snapshot) throw new Error(`Snapshot ${snapshotId} not found`)

  const sellerProject = await ProjectService.getProjectById(sellerProjectId)
  if (!sellerProject) throw new Error(`Seller project ${sellerProjectId} not found`)

  let meta = getMeta(purchase)

  // ── Step 1: Billing check ──────────────────────────────────────────────
  const projectCount = await ProjectService.countProjectsByOrganizationId(buyerOrgId)
  const access = await checkBillingFeature({
    organizationId: buyerOrgId,
    featureId: 'projects',
    currentProjects: projectCount,
  })
  if (!access.allowed) {
    await MarketplaceService.updatePurchaseStatus(purchaseId, 'failed', {
      failReason: 'Project limit reached. Upgrade your plan to claim this template.',
    })
    return
  }

  // ── Step 2: Create buyer project ───────────────────────────────────────
  let buyerProjectId = purchase.buyerProjectId
  if (!buyerProjectId) {
    const projectName = `${sellerProject.name} (copy)`
    const created = await ProjectService.createProject({
      userId: buyerUserId,
      organizationId: buyerOrgId,
      name: projectName,
      sourceProjectId: sellerProjectId,
      purchaseId,
    })
    buyerProjectId = created.id
    await MarketplaceService.updatePurchaseStatus(purchaseId, 'provisioning', {
      buyerProjectId,
      step: 'project_created',
    })
    log.info({ purchaseId, buyerProjectId }, 'buyer project created')
  }

  // ── Step 3: Create API key ─────────────────────────────────────────────
  if (!meta.apiKeyCreatedAt) {
    const apiKey = `sk_test_${crypto.randomUUID().replace(/-/g, '')}`
    const keyHash = await hashApiKey(apiKey)
    const now = new Date()

    await db
      .insertInto('apikey')
      .values({
        name: `p-${buyerProjectId.slice(0, 8)}`,
        prefix: 'sk_test_',
        start: apiKey.slice(0, 12),
        key: keyHash,
        userId: buyerUserId,
        projectId: buyerProjectId,
        organizationId: buyerOrgId,
        env: 'test',
        enabled: true,
        rateLimitEnabled: false,
        requestCount: 0,
        createdAt: now,
        updatedAt: now,
      })
      .execute()

    await ProjectService.upsertEnvVar({
      projectId: buyerProjectId,
      environment: 'development',
      key: 'SURGENT_API_KEY',
      value: apiKey,
      destination: 'server',
    })

    await updateStep(purchaseId, 'apiKeyCreated')
    purchase = (await MarketplaceService.getPurchaseById(purchaseId))!
    meta = getMeta(purchase)
  }

  // ── Step 4: Create sandbox ─────────────────────────────────────────────
  if (!meta.sandboxId) {
    const apiKey = await getApiKeyValue(buyerProjectId)
    const devEnv = await getProjectEnvVars(buyerProjectId, 'development', { includeServer: false })
    const sandbox = await getProvider().create(buildOpencodeEnv(devEnv, apiKey), 'server')
    const previewUrl = await sandbox.host(PREVIEW_PORT)
    const workingDir = workspacePath(buyerProjectId)

    await ProjectService.mergeProjectMetadata(buyerProjectId, {
      workingDirectory: workingDir,
      provisioning: { sandboxId: sandbox.id, previewUrl },
    })

    await updateStep(purchaseId, 'sandboxCreated', {
      sandboxId: sandbox.id,
      previewUrl,
    })
    purchase = (await MarketplaceService.getPurchaseById(purchaseId))!
    meta = getMeta(purchase)
    log.info({ purchaseId, sandboxId: sandbox.id }, 'sandbox created')
  }

  // ── Step 5: Restore snapshot from R2 ───────────────────────────────────
  if (!meta.snapshotExtractedAt) {
    const sandbox = await getProvider().resume(meta.sandboxId!)
    const workingDir = workspacePath(buyerProjectId)

    const signedUrl = await storage.getSignedUrl(snapshot.storageKey, 3600)
    await sandbox.exec(`mkdir -p ${shellQuote(workingDir)}`, { timeout: 30_000 })

    const download = await sandbox.exec(
      `curl -sL -o /tmp/snapshot.tar.gz ${shellQuote(signedUrl)}`,
      { timeout: 300_000 },
    )
    if (download.code !== 0) {
      throw new Error(`Snapshot download failed: ${download.output}`)
    }

    const extract = await sandbox.exec(
      `tar -xzf /tmp/snapshot.tar.gz -C ${shellQuote(workingDir)}`,
      { timeout: 120_000 },
    )
    if (extract.code !== 0) {
      throw new Error(`Snapshot extraction failed: ${extract.output}`)
    }

    await sandbox.exec('rm -f /tmp/snapshot.tar.gz', { timeout: 10_000 })

    // Fresh git
    await sandbox.exec(buildBashCommand(workingDir, 'git init -b main'), { timeout: 30_000 })

    await updateStep(purchaseId, 'snapshotExtracted')
    purchase = (await MarketplaceService.getPurchaseById(purchaseId))!
    meta = getMeta(purchase)
  }

  // ── Step 6: Provision Convex integration ───────────────────────────────
  if (!meta.convexProvisionedAt) {
    const sellerConvex = await ProjectService.getIntegrationByProvider(sellerProjectId, 'convex')
    if (sellerConvex) {
      await provisionConvexForBuyer(buyerProjectId, meta.sandboxId!)
    }
    await updateStep(purchaseId, 'convexProvisioned')
    purchase = (await MarketplaceService.getPurchaseById(purchaseId))!
    meta = getMeta(purchase)
  }

  // ── Step 7: Transfer env var keys (without values) ─────────────────────
  if (!meta.envVarsAppliedAt) {
    const pendingKeys = await transferEnvVarKeys(buyerProjectId, sellerProjectId)
    await updateStep(purchaseId, 'envVarsApplied')
    if (pendingKeys.length > 0) {
      log.info(
        { purchaseId, buyerProjectId, pendingKeys },
        'buyer has unconfigured env vars that need manual setup',
      )
    }
    purchase = (await MarketplaceService.getPurchaseById(purchaseId))!
    meta = getMeta(purchase)
  }

  // ── Step 8: Install dependencies + start dev server ────────────────────
  if (!meta.initializedAt) {
    const sandbox = await getProvider().resume(meta.sandboxId!)
    const workingDir = workspacePath(buyerProjectId)

    const { processName, startCommand } = await initializeDevServer(
      sandbox,
      buyerProjectId,
      workingDir,
    )

    await ProjectService.mergeProjectMetadata(buyerProjectId, {
      processName,
      startCommand,
      provisioning: { initializedAt: new Date().toISOString() },
    })

    await updateStep(purchaseId, 'initialized')
    purchase = (await MarketplaceService.getPurchaseById(purchaseId))!
    meta = getMeta(purchase)
  }

  // ── Step 9: Start opencode agent ───────────────────────────────────────
  if (!meta.opencodeReadyAt) {
    const sandbox = await getProvider().resume(meta.sandboxId!)
    const workingDir = workspacePath(buyerProjectId)
    const apiKey = await getApiKeyValue(buyerProjectId)

    await setupOpencodeAgent(sandbox, buyerProjectId, workingDir, apiKey)

    await ProjectService.mergeProjectMetadata(buyerProjectId, {
      provisioning: { opencodeReadyAt: new Date().toISOString() },
    })

    await updateStep(purchaseId, 'opencodeReady')
    purchase = (await MarketplaceService.getPurchaseById(purchaseId))!
    meta = getMeta(purchase)
  }

  // ── Step 10: Finalize ──────────────────────────────────────────────────
  const workingDir = workspacePath(buyerProjectId)
  await finalizeProjectProvisioning(buyerProjectId, meta.sandboxId!, meta.previewUrl!, {
    workingDirectory: workingDir,
  })
  await MarketplaceService.updatePurchaseStatus(purchaseId, 'ready')

  log.info({ purchaseId, buyerProjectId }, 'marketplace fulfillment completed')
}

// ── Convex provisioning ──────────────────────────────────────────────────

async function provisionConvexForBuyer(buyerProjectId: string, sandboxId: string): Promise<void> {
  const shortId = buyerProjectId.slice(0, 8)

  // 1. Create new Convex project
  const convexProject = await createProjectOnTeam({
    name: `buyer-${shortId}`,
    deploymentType: 'dev',
  })

  // 2. Create deploy key
  const deployKey = await createDeployKey(convexProject.deploymentName)

  // 3. Generate auth keys
  const authKeys = await generateAuthKeys()

  // 4. Create integration record
  const integration = await ProjectService.createIntegration({
    projectId: buyerProjectId,
    provider: 'convex',
    config: withDeployment({ convexProjectId: convexProject.projectId }, 'development', {
      name: convexProject.deploymentName,
      url: convexProject.deploymentUrl,
    }) as Record<string, unknown>,
    status: 'connected',
  })

  // 5. Set env vars
  await ProjectService.upsertEnvVars(
    buyerProjectId,
    'development',
    {
      CONVEX_DEPLOYMENT: { value: `dev:${convexProject.deploymentName}`, destination: 'client' },
      CONVEX_URL: { value: convexProject.deploymentUrl, destination: 'client' },
      CONVEX_DEPLOY_KEY: { value: deployKey, destination: 'client' },
      VITE_CONVEX_URL: { value: convexProject.deploymentUrl, destination: 'client' },
      JWT_PRIVATE_KEY: { value: authKeys.privateKey, destination: 'server' },
      JWKS: { value: authKeys.jwks, destination: 'server' },
    },
    integration.id,
  )

  // 6. Push auth keys to Convex deployment
  await setDeploymentEnvVars(convexProject.deploymentUrl, deployKey, {
    JWT_PRIVATE_KEY: authKeys.privateKey,
    JWKS: authKeys.jwks,
  })

  // 7. Deploy schema/functions from the snapshot code
  const sandbox = await getProvider().resume(sandboxId)
  const workingDir = workspacePath(buyerProjectId)
  const devEnv = await getProjectEnvVars(buyerProjectId, 'development', { includeServer: false })

  const deploy = await sandbox.exec('bunx convex deploy -y', {
    cwd: workingDir,
    timeout: 300_000,
    env: devEnv,
  })
  if (deploy.code !== 0) {
    throw new Error(
      `Convex schema/function deploy failed for buyer project ${buyerProjectId}: ${deploy.output}`,
    )
  }

  log.info({ buyerProjectId, convexProjectId: convexProject.projectId }, 'convex provisioned')
}

// ── Env var transfer (keys only, no values) ──────────────────────────────

/**
 * Transfers env var keys from the seller project to the buyer project.
 * Values are set to empty strings — the buyer must configure them manually.
 * Returns the list of keys that need buyer configuration.
 */
async function transferEnvVarKeys(
  buyerProjectId: string,
  sellerProjectId: string,
): Promise<string[]> {
  const sellerVars = await ProjectService.getEnvVarsByProjectId(sellerProjectId, 'development')
  const pendingKeys: string[] = []

  for (const v of sellerVars) {
    if (!v.key) continue
    if (REPROVISION_KEYS.has(v.key)) continue
    if (REGENERATE_KEYS.has(v.key)) continue
    if (SKIP_KEYS.has(v.key)) continue

    // Transfer the key and destination but NOT the value
    await ProjectService.upsertEnvVar({
      projectId: buyerProjectId,
      environment: 'development',
      key: v.key,
      value: '',
      destination: v.destination,
    })
    pendingKeys.push(v.key)
  }

  return pendingKeys
}

// ── Helpers ──────────────────────────────────────────────────────────────

async function getApiKeyValue(projectId: string): Promise<string> {
  const rows = await ProjectService.getEnvVarsByProjectId(projectId, 'development')
  const row = rows.find((it) => it.key === 'SURGENT_API_KEY' && it.value)
  if (!row?.value) throw new Error('SURGENT_API_KEY not found for project')
  return row.value
}

async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(key)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}
