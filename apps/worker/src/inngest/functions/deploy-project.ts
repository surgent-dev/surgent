import { inngest } from '../client'
import { deployProject } from '@/controllers/projects'
import * as ProjectService from '@/services/projects'
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
    onFailure: async ({ event }) => {
      const { projectId, deploymentId } = event.data.event.data as DeployProjectEvent['data']
      const errorMessage = event.data.error?.message || 'Deployment failed after retries'

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

    return { projectId, deploymentId }
  },
)
