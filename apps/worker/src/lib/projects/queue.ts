import type { Job } from 'pg-boss'
import { captureScreenshot, ScreenshotError } from '@/apis/browser-rendering'
import { runProjectCreationJob, type CreateProjectJobData } from '@/controllers/project-create'
import { deployProject } from '@/controllers/projects'
import { getBoss } from '@/lib/boss'
import { config } from '@/lib/config'
import { createLogger } from '@/lib/logger'
import { storage } from '@/lib/storage'
import * as ProjectService from '@/services/projects'
const log = createLogger('project-queue')

const CREATE_QUEUE = 'project.create'
const CREATE_DLQ = 'project.create.dead'
const DEPLOY_QUEUE = 'project.deploy'
const DEPLOY_DLQ = 'project.deploy.dead'
const SCREENSHOT_QUEUE = 'project.deploy.screenshot'

let registered = false

export interface DeployProjectJobData {
  projectId: string
  deployName?: string
  deploymentId: string
}

interface ScreenshotJobData {
  projectId: string
  deploymentId: string
}

async function captureDeploymentScreenshot(data: ScreenshotJobData): Promise<void> {
  const deployment = await ProjectService.getDeployment(data.deploymentId)
  if (!deployment || deployment.status !== 'deployed' || !deployment.scriptName) return

  const siteUrl = `https://${deployment.scriptName}.${config.cloudflare.deployDomain}`
  const buffer = await captureScreenshot({ url: siteUrl })
  const key = storage.generateKey(data.projectId, `deploy-${data.deploymentId.slice(0, 8)}.jpg`)

  await storage.upload(key, buffer, 'image/jpeg')
  const url = storage.getPublicUrl(key) || (await storage.getSignedUrl(key))
  await ProjectService.updateDeployment(data.deploymentId, { screenshotUrl: url })
  log.info(
    { projectId: data.projectId, deploymentId: data.deploymentId },
    'project deploy screenshot captured',
  )
}

export async function registerProjectWorkers(): Promise<void> {
  if (registered) return

  const boss = getBoss()

  await boss.createQueue(CREATE_DLQ, {
    retentionSeconds: 2_592_000,
  })

  await boss.createQueue(CREATE_QUEUE, {
    policy: 'key_strict_fifo',
    retryLimit: 1,
    retryBackoff: true,
    expireInSeconds: 1_800,
    retentionSeconds: 604_800,
    deadLetter: CREATE_DLQ,
  })

  await boss.createQueue(DEPLOY_DLQ, {
    retentionSeconds: 2_592_000,
  })

  await boss.createQueue(DEPLOY_QUEUE, {
    policy: 'key_strict_fifo',
    retryLimit: 1,
    retryBackoff: true,
    expireInSeconds: 1_800,
    retentionSeconds: 604_800,
    deadLetter: DEPLOY_DLQ,
  })

  await boss.createQueue(SCREENSHOT_QUEUE, {
    retryLimit: 3,
    retryBackoff: true,
    expireInSeconds: 300,
    retentionSeconds: 604_800,
  })

  await boss.work<CreateProjectJobData>(
    CREATE_QUEUE,
    { pollingIntervalSeconds: 2 },
    async (jobs: Job<CreateProjectJobData>[]) => {
      for (const job of jobs) {
        log.info({ jobId: job.id, projectId: job.data.projectId }, 'project create claimed')
        try {
          await runProjectCreationJob(job.data)
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Project creation failed'
          await ProjectService.mergeProjectMetadata(job.data.projectId, {
            provisioning: { lastError: message },
          }).catch(() => {})
          throw err
        }
      }
    },
  )

  await boss.work<CreateProjectJobData>(
    CREATE_DLQ,
    { pollingIntervalSeconds: 30 },
    async (jobs: Job<CreateProjectJobData>[]) => {
      for (const job of jobs) {
        const project = await ProjectService.getProjectById(job.data.projectId)
        const error =
          project?.metadata?.provisioning?.lastError || 'Project creation failed after retries'
        await ProjectService.updateProjectStatus(job.data.projectId, 'failed', error)
        log.error(
          { jobId: job.id, projectId: job.data.projectId },
          'project create failed permanently',
        )
      }
    },
  )

  await boss.work<DeployProjectJobData>(
    DEPLOY_QUEUE,
    { pollingIntervalSeconds: 2 },
    async (jobs: Job<DeployProjectJobData>[]) => {
      for (const job of jobs) {
        const { projectId, deployName, deploymentId } = job.data
        log.info({ jobId: job.id, projectId, deploymentId }, 'project deploy claimed')
        await deployProject({ projectId, deployName, deploymentId })
        await enqueueDeploymentScreenshotJob({ projectId, deploymentId }).catch((err) => {
          log.warn(
            { projectId, deploymentId, err },
            'failed to enqueue screenshot job after deploy',
          )
        })
      }
    },
  )

  await boss.work<DeployProjectJobData>(
    DEPLOY_DLQ,
    { pollingIntervalSeconds: 30 },
    async (jobs: Job<DeployProjectJobData>[]) => {
      for (const job of jobs) {
        const current = await ProjectService.getDeployment(job.data.deploymentId)
        if (current?.status === 'cancelled' || current?.status === 'deployed') continue

        await ProjectService.updateDeployment(job.data.deploymentId, {
          status: current?.status === 'build_failed' ? 'build_failed' : 'deploy_failed',
          error: current?.error || 'Deployment failed after retries',
          finishedAt: new Date(),
        })
        log.error(
          { jobId: job.id, projectId: job.data.projectId, deploymentId: job.data.deploymentId },
          'project deploy failed permanently',
        )
      }
    },
  )

  await boss.work<ScreenshotJobData>(
    SCREENSHOT_QUEUE,
    { pollingIntervalSeconds: 2 },
    async (jobs: Job<ScreenshotJobData>[]) => {
      for (const job of jobs) {
        try {
          await captureDeploymentScreenshot(job.data)
        } catch (err) {
          if (err instanceof ScreenshotError && err.permanent) {
            log.warn(
              {
                jobId: job.id,
                projectId: job.data.projectId,
                deploymentId: job.data.deploymentId,
                status: err.status,
              },
              'project deploy screenshot skipped',
            )
            continue
          }
          log.warn(
            {
              jobId: job.id,
              projectId: job.data.projectId,
              deploymentId: job.data.deploymentId,
              err,
            },
            'project deploy screenshot failed',
          )
          throw err
        }
      }
    },
  )

  registered = true
  log.info(
    { queues: [CREATE_QUEUE, CREATE_DLQ, DEPLOY_QUEUE, DEPLOY_DLQ, SCREENSHOT_QUEUE] },
    'project workers registered',
  )
}

export async function enqueueProjectCreateJob(data: CreateProjectJobData): Promise<string | null> {
  return getBoss().send(CREATE_QUEUE, data, {
    id: data.projectId,
    singletonKey: data.projectId,
  })
}

export async function enqueueProjectDeployJob(data: DeployProjectJobData): Promise<string | null> {
  return getBoss().send(DEPLOY_QUEUE, data, {
    id: data.deploymentId,
    singletonKey: data.projectId,
  })
}

export async function enqueueDeploymentScreenshotJob(
  data: ScreenshotJobData,
): Promise<string | null> {
  return getBoss().send(SCREENSHOT_QUEUE, data, {
    singletonKey: data.deploymentId,
  })
}

export async function cancelProjectDeployJob(deploymentId: string): Promise<void> {
  await getBoss().cancel(DEPLOY_QUEUE, deploymentId)
}
