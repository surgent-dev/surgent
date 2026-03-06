import { inngest } from '../client'
import { deployProject } from '@/controllers/projects'
import * as ProjectService from '@/services/projects'
import { captureScreenshot } from '@/apis/browser-rendering'
import { storage } from '@/lib/storage'
import { config } from '@/lib/config'
import { createLogger } from '@/lib/logger'

const log = createLogger('inngest')

// ---------------------------------------------------------------------------
// Event type
// ---------------------------------------------------------------------------

type DeployProjectEvent = {
  name: 'project/deploy.requested'
  data: {
    projectId: string
    deployName?: string
    deploymentId: string
  }
}

// ---------------------------------------------------------------------------
// Inngest function
// ---------------------------------------------------------------------------

export const deployProjectFn = inngest.createFunction(
  {
    id: 'deploy-project',
    retries: 1,
    cancelOn: [{ event: 'project/deploy.cancelled', match: 'data.deploymentId' }],
    onFailure: async ({ event }) => {
      const { projectId, deploymentId } = event.data.event.data as DeployProjectEvent['data']
      const errorMessage = event.data.error?.message || 'Deployment failed after retries'

      // Don't overwrite 'cancelled' status — it was set by the user
      const current = await ProjectService.getDeployment(deploymentId)
      if (current?.status === 'cancelled') return

      // deployProject already marks deployment as failed internally,
      // but if it crashes completely this is the safety net
      await ProjectService.updateDeployment(deploymentId, {
        status: 'deploy_failed',
        error: errorMessage,
        finishedAt: new Date(),
      }).catch(() => {})

      log.error({ projectId, deploymentId, errorMessage }, 'deployment failed (onFailure)')
    },
  },
  { event: 'project/deploy.requested' },
  async ({ event, step }) => {
    const { projectId, deployName, deploymentId } = event.data as DeployProjectEvent['data']

    await step.run('deploy', async () => {
      await deployProject({ projectId, deployName, deploymentId })
    })

    // Capture screenshot of the deployed site (best-effort, non-blocking)
    await step.run('capture-screenshot', async () => {
      const deployment = await ProjectService.getDeployment(deploymentId)
      if (!deployment || deployment.status !== 'deployed' || !deployment.scriptName) return

      const siteUrl = `https://${deployment.scriptName}.${config.cloudflare.deployDomain}`

      try {
        const buffer = await captureScreenshot({ url: siteUrl })
        const key = storage.generateKey(projectId, `deploy-${deploymentId.slice(0, 8)}.jpg`)
        await storage.upload(key, buffer, 'image/jpeg')
        const url = storage.getPublicUrl(key) || (await storage.getSignedUrl(key))
        await ProjectService.updateDeployment(deploymentId, { screenshotUrl: url })
        log.info({ projectId, deploymentId }, 'screenshot captured')
      } catch (err) {
        log.warn({ projectId, deploymentId, error: (err as Error).message }, 'screenshot failed')
        // Don't throw — screenshot failure shouldn't fail the deployment
      }
    })

    return { projectId, deploymentId }
  },
)
