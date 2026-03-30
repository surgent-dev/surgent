import {
  createProjectOnTeam,
  createDeployKey,
  setDeploymentEnvVars,
  generateAuthKeys,
} from '@/apis/convex'
import { withDeployment } from '@/lib/convex-env'
import { config } from '@/lib/config'
import * as ProjectService from '@/services/projects'
import type { EnvDestination } from '@repo/db'
import type { IntegrationProvisioner } from './provisioner'
import { registerProvisioner } from './provisioner'
import type { ProvisionContext, ProvisionResult } from './types'

const convexProvisioner: IntegrationProvisioner = {
  provider: 'convex',
  canAutoProvision: true,

  async provision(ctx: ProvisionContext): Promise<ProvisionResult> {
    // Check if buyer's project already has a Convex integration (idempotency)
    const existing = await ProjectService.getIntegrationByProvider(ctx.projectId, 'convex')
    if (existing) {
      const rows = await ProjectService.getEnvVarsByProjectId(ctx.projectId, 'development')
      const envVars: Record<string, { value: string; destination: EnvDestination }> = {}
      for (const row of rows) {
        if (row.integrationId === existing.id && row.value) {
          envVars[row.key] = { value: row.value, destination: row.destination || 'client' }
        }
      }
      return { integrationId: existing.id as string, envVars }
    }

    const surgentApiKey = (
      await ProjectService.getEnvVarsByProjectId(ctx.projectId, 'development')
    ).find((v) => v.key === 'SURGENT_API_KEY')?.value

    if (!surgentApiKey) throw new Error('SURGENT_API_KEY not found for buyer project')

    const sandbox = await ProjectService.getSandboxByProjectId(ctx.projectId)
    const siteUrl = sandbox?.host ?? 'http://localhost:5173'

    const [project, authKeys] = await Promise.all([
      createProjectOnTeam({ name: `mp-${ctx.projectId.slice(0, 8)}`, deploymentType: 'dev' }),
      generateAuthKeys(),
    ])

    const deployKey = await createDeployKey(project.deploymentName)

    const allEnvVars: Record<string, { value: string; destination: EnvDestination }> = {
      CONVEX_DEPLOYMENT: { value: `dev:${project.deploymentName}`, destination: 'client' },
      CONVEX_URL: { value: project.deploymentUrl, destination: 'client' },
      CONVEX_DEPLOY_KEY: { value: deployKey, destination: 'client' },
      VITE_CONVEX_URL: { value: project.deploymentUrl, destination: 'client' },
      SITE_URL: { value: siteUrl, destination: 'both' },
      JWT_PRIVATE_KEY: { value: authKeys.privateKey, destination: 'server' },
      JWKS: { value: authKeys.jwks, destination: 'server' },
      SURGENT_API_KEY: { value: surgentApiKey, destination: 'server' },
      ...(config.surgent.baseUrl && {
        SURPAY_BASE_URL: {
          value: `${config.surgent.baseUrl}/api/pay`,
          destination: 'server' as EnvDestination,
        },
      }),
    }

    // Push server vars to Convex deployment
    const serverVars: Record<string, string> = {}
    for (const [key, { value, destination }] of Object.entries(allEnvVars)) {
      if (destination === 'server' || destination === 'both') {
        serverVars[key] = value
      }
    }
    await setDeploymentEnvVars(project.deploymentUrl, deployKey, serverVars)

    // Create integration record
    const integration = await ProjectService.createIntegration({
      projectId: ctx.projectId,
      provider: 'convex',
      config: withDeployment({ convexProjectId: project.projectId }, 'development', {
        name: project.deploymentName,
        url: project.deploymentUrl,
      }) as Record<string, unknown>,
      status: 'connected',
    })

    // Save env vars to DB
    const dbVars: Record<string, { value: string; destination: EnvDestination }> = {}
    for (const [key, { value, destination }] of Object.entries(allEnvVars)) {
      dbVars[key] = { value, destination }
    }
    await ProjectService.upsertEnvVars(ctx.projectId, 'development', dbVars, integration.id)

    return { integrationId: integration.id as string, envVars: allEnvVars }
  },
}

// Auto-register on import
registerProvisioner(convexProvisioner)

export { convexProvisioner }
