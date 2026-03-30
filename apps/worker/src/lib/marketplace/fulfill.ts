import type { Kysely } from 'kysely'
import stripJsonComments from 'strip-json-comments'
import type { Database, FulfillmentMetadata, ProjectMetadata } from '@repo/db'
import { config } from '@/lib/config'
import { db } from '@/lib/db'
import { createLogger } from '@/lib/logger'
import { getProvider, workspacePath, defaultProviderName } from '@/lib/sandbox'
import { buildBashCommand } from '@/lib/utils'
import { ensureActiveOrganization } from '@/lib/organizations'
import * as ProjectService from '@/services/projects'
import {
  ensureOpencodeConfigRepo,
  ensurePm2Process,
  getProjectEnvVars,
  startOpencodeServer,
} from '@/controllers/projects'
import { restoreSnapshot } from './snapshot'
import { getProvisioner } from './provisioner'
import { classifyEnvVars, resolveEnvVars } from './env'
import { enqueueFulfillmentJob } from './queue'
import type { FulfillmentJobData } from './types'

// Ensure convex provisioner is registered
import './convex-provisioner'

const log = createLogger('marketplace-fulfill')

const PREVIEW_PORT = 3000

function buildOpencodeEnv(devEnv: Record<string, string>, apiKey: string) {
  return {
    ...devEnv,
    SURGENT_API_KEY: apiKey,
    SURGENT_BASE_URL: config.surgent.baseUrl!,
    OPENCODE_API_KEY: apiKey,
    OPENCODE_BASE_URL: config.opencode.baseUrl!,
    OPENCODE_CONFIG_DIR: config.opencode.configDir,
  }
}

export async function runFulfillmentJob(data: FulfillmentJobData): Promise<void> {
  const { purchaseId } = data
  const purchase = await ProjectService.getPurchaseById(purchaseId)
  if (!purchase) throw new Error(`Purchase ${purchaseId} not found`)
  if (purchase.status === 'fulfilled') return

  await ProjectService.updatePurchaseStatus(purchaseId, 'provisioning')

  let fulfillment = (purchase.fulfillment || {}) as FulfillmentMetadata
  const listing = await db
    .selectFrom('listing')
    .select(['id', 'projectId', 'title'])
    .where('id', '=', purchase.listingId)
    .executeTakeFirst()
  if (!listing) throw new Error(`Listing ${purchase.listingId} not found`)

  // ── Step 1: Create buyer's project ──
  let projectId = purchase.projectId

  if (!fulfillment.projectCreatedAt) {
    log.info({ purchaseId }, 'step 1: creating buyer project')
    const organizationId = await ensureActiveOrganization(purchase.buyerId)

    const created = await ProjectService.createProject({
      userId: purchase.buyerId,
      organizationId,
      name: listing.title || 'Marketplace App',
    })
    projectId = created.id

    // Create API key via direct DB insert (no request context in background job)
    const rawKey = `sk_test_${crypto.randomUUID().replace(/-/g, '')}`
    const encoder = new TextEncoder()
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(rawKey))
    const hashedKey = Buffer.from(hashBuffer).toString('hex')

    await db
      .insertInto('apikey')
      .values({
        name: `p-${projectId.slice(0, 8)}`,
        prefix: 'sk_test_',
        start: rawKey.slice(0, 12),
        key: hashedKey,
        userId: purchase.buyerId,
        projectId,
        organizationId,
        enabled: true,
        env: 'test',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .execute()

    await db
      .insertInto('env_var')
      .values({
        projectId,
        environment: 'development',
        key: 'SURGENT_API_KEY',
        value: rawKey,
        destination: 'server',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .execute()

    await ProjectService.updatePurchaseProjectId(purchaseId, projectId)
    fulfillment = await ProjectService.mergePurchaseFulfillment(purchaseId, {
      projectCreatedAt: new Date().toISOString(),
    })
  }

  if (!projectId) throw new Error('Project not created for purchase')
  const workDir = workspacePath(projectId)

  // ── Step 2: Provision sandbox ──
  let sandboxId: string | undefined
  let previewUrl: string | undefined

  if (!fulfillment.sandboxProvisionedAt) {
    log.info({ purchaseId, projectId }, 'step 2: provisioning sandbox')
    const apiKey = await getApiKey(projectId)
    const devEnv = await getProjectEnvVars(projectId, 'development', { includeServer: false })
    const sandbox = await getProvider().create(buildOpencodeEnv(devEnv, apiKey), 'server')
    previewUrl = await sandbox.host(PREVIEW_PORT)
    sandboxId = sandbox.id

    await ProjectService.mergeProjectMetadata(projectId, {
      workingDirectory: workDir,
      provisioning: { sandboxId, previewUrl },
    })

    await ProjectService.upsertSandbox({
      id: sandboxId,
      projectId,
      provider: defaultProviderName,
      status: 'started',
      host: previewUrl,
    })

    fulfillment = await ProjectService.mergePurchaseFulfillment(purchaseId, {
      sandboxProvisionedAt: new Date().toISOString(),
    })
  }

  // Recover sandbox state from project metadata if resuming
  if (!sandboxId || !previewUrl) {
    const project = await ProjectService.getProjectById(projectId)
    const meta = project?.metadata as ProjectMetadata | null
    sandboxId = meta?.provisioning?.sandboxId
    previewUrl = meta?.provisioning?.previewUrl
  }
  if (!sandboxId || !previewUrl) throw new Error('Sandbox not provisioned')

  // ── Step 3: Restore codebase ──
  if (!fulfillment.codebaseRestoredAt) {
    log.info({ purchaseId, projectId }, 'step 3: restoring codebase')
    const snapshot = purchase.snapshotId
      ? await ProjectService.getSnapshotById(purchase.snapshotId)
      : await ProjectService.getSnapshotByListingId(purchase.listingId)

    if (!snapshot) throw new Error('No snapshot available for listing')

    const sandbox = await getProvider().resume(sandboxId)
    await restoreSnapshot(snapshot.storageKey, sandbox, workDir)

    // Re-init git
    const reset = await sandbox.exec(buildBashCommand(workDir, 'rm -rf .git && git init -b main'), {
      timeout: 60_000,
    })
    if (reset.code !== 0) {
      throw new Error(`Failed to reset git: ${reset.output}`)
    }

    fulfillment = await ProjectService.mergePurchaseFulfillment(purchaseId, {
      codebaseRestoredAt: new Date().toISOString(),
    })
  }

  // ── Step 4: Provision integrations ──
  let provisionedVars: Record<
    string,
    { value: string; destination: import('@repo/db').EnvDestination }
  > = {}

  if (!fulfillment.integrationsProvisionedAt) {
    log.info({ purchaseId, projectId }, 'step 4: provisioning integrations')
    const sandbox = await getProvider().resume(sandboxId)

    const sourceIntegrations = await db
      .selectFrom('integration')
      .selectAll()
      .where('projectId', '=', purchase.sourceProjectId)
      .execute()

    for (const integration of sourceIntegrations) {
      const provisioner = getProvisioner(integration.provider)
      if (!provisioner?.canAutoProvision) continue

      const result = await provisioner.provision({
        projectId,
        buyerId: purchase.buyerId,
        sourceProjectId: purchase.sourceProjectId,
        sandbox,
        workDir,
      })

      for (const [key, val] of Object.entries(result.envVars)) {
        provisionedVars[key] = val
      }
    }

    fulfillment = await ProjectService.mergePurchaseFulfillment(purchaseId, {
      integrationsProvisionedAt: new Date().toISOString(),
    })
  }

  // ── Step 5: Set up env vars ──
  if (!fulfillment.envVarsSetAt) {
    log.info({ purchaseId, projectId }, 'step 5: setting up env vars')
    const apiKey = await getApiKey(projectId)
    const rules = await classifyEnvVars(purchase.listingId, purchase.sourceProjectId)
    const sourceVars = await ProjectService.getEnvVarsByProjectId(
      purchase.sourceProjectId,
      'development',
    )

    const resolved = await resolveEnvVars(rules, sourceVars, provisionedVars, {
      apiKey,
      previewUrl,
    })

    // Upsert all resolved vars
    const dbVars: Record<
      string,
      { value: string; destination: import('@repo/db').EnvDestination }
    > = {}
    for (const [key, val] of Object.entries(resolved)) {
      dbVars[key] = val
    }
    await ProjectService.upsertEnvVars(projectId, 'development', dbVars)

    // Write client vars to sandbox .env
    const sandbox = await getProvider().resume(sandboxId)
    const clientLines: string[] = []
    for (const [key, { value, destination }] of Object.entries(resolved)) {
      if (destination === 'client' || destination === 'both') {
        clientLines.push(`${key}=${value}`)
      }
    }
    if (clientLines.length > 0) {
      const envContent = clientLines.join('\n') + '\n'
      const escaped = envContent.replace(/'/g, "'\"'\"'")
      await sandbox.exec(`printf '%s' '${escaped}' > ${workDir}/.env`, { timeout: 10_000 })
    }

    fulfillment = await ProjectService.mergePurchaseFulfillment(purchaseId, {
      envVarsSetAt: new Date().toISOString(),
    })
  }

  // ── Step 6: Install deps + start dev server ──
  if (!fulfillment.devServerStartedAt) {
    log.info({ purchaseId, projectId }, 'step 6: installing deps and starting dev server')
    const sandbox = await getProvider().resume(sandboxId)
    let processName = `${projectId}-vite-server`
    let startCommand: string | undefined
    let initScript: string | undefined

    // Read surgent.json for scripts
    try {
      const content = (await sandbox.read(`${workDir}/surgent.json`)).toString('utf8')
      const cfg = JSON.parse(stripJsonComments(content))
      initScript = cfg?.scripts?.init
      startCommand = cfg?.scripts?.dev
      if (cfg?.name?.trim()) processName = cfg.name.trim()
    } catch {
      log.debug({ purchaseId, projectId }, 'surgent.json missing or invalid')
    }

    if (initScript) {
      const init = await sandbox.exec(buildBashCommand(workDir, initScript), {
        timeout: 600_000,
      })
      if (init.code !== 0) {
        throw new Error(`Init script failed (exit ${init.code}): ${init.output}`)
      }
    }

    if (startCommand) {
      const devEnv = await getProjectEnvVars(projectId, 'development', { includeServer: false })
      await ensurePm2Process(sandbox, workDir, processName, startCommand, devEnv)
    }

    await ProjectService.mergeProjectMetadata(projectId, {
      workingDirectory: workDir,
      processName,
      startCommand,
      provisioning: { processName, startCommand },
    })

    fulfillment = await ProjectService.mergePurchaseFulfillment(purchaseId, {
      devServerStartedAt: new Date().toISOString(),
    })
  }

  // ── Step 7: Finalize ──
  if (!fulfillment.finalizedAt) {
    log.info({ purchaseId, projectId }, 'step 7: finalizing')
    const sandbox = await getProvider().resume(sandboxId)
    const apiKey = await getApiKey(projectId)
    const devEnv = await getProjectEnvVars(projectId, 'development', { includeServer: false })

    await ensureOpencodeConfigRepo(
      sandbox,
      config.opencode.configRepoUrl,
      config.opencode.configDir,
    )
    await startOpencodeServer(sandbox, workDir, buildOpencodeEnv(devEnv, apiKey))

    await ProjectService.mergeProjectMetadata(projectId, {
      provisioningStep: null,
      provisioning: {
        finalizedAt: new Date().toISOString(),
        lastError: null,
      },
    })

    await ProjectService.updateProjectStatus(projectId, 'ready')
    await ProjectService.updatePurchaseStatus(purchaseId, 'fulfilled')
    await ProjectService.mergePurchaseFulfillment(purchaseId, {
      finalizedAt: new Date().toISOString(),
      lastError: null,
    })

    log.info({ purchaseId, projectId }, 'fulfillment completed')
  }
}

async function getApiKey(projectId: string): Promise<string> {
  const rows = await ProjectService.getEnvVarsByProjectId(projectId, 'development')
  const row = rows.find((it) => it.key === 'SURGENT_API_KEY' && it.value)
  if (!row?.value) throw new Error('SURGENT_API_KEY not found for project')
  return row.value
}

export async function triggerMarketplaceFulfillment(
  trx: Kysely<Database>,
  args: {
    listingId: string
    buyerId: string
    sourceProjectId: string
    checkoutSessionId: string
  },
): Promise<void> {
  const snapshot = await ProjectService.getSnapshotByListingId(args.listingId)

  const purchase = await ProjectService.createPurchase({
    buyerId: args.buyerId,
    listingId: args.listingId,
    sourceProjectId: args.sourceProjectId,
    checkoutSessionId: args.checkoutSessionId,
    snapshotId: snapshot?.id || null,
  })

  // createPurchase returns null on duplicate (idempotency via checkoutSessionId)
  if (!purchase) return

  await enqueueFulfillmentJob({ purchaseId: purchase.id })
}
