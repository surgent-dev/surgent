import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import { AssetManifest, WorkerBinding, WranglerConfig } from './types'

const logger = console

interface DeploymentResult {
  success: boolean
  error?: string
  output?: string
  versionId?: string
}

/**
 * Main deployment orchestrator using Wrangler CLI
 * Handles both simple deployments and deployments with static assets
 */
export class WorkerDeployer {
  private readonly tempDir: string

  constructor() {
    this.tempDir = path.join(os.tmpdir(), 'surgent-deployer')
  }

  /**
   * Deploy a Worker with static assets using Wrangler CLI
   */
  async deployWithAssets(
    scriptName: string,
    workerContent: string,
    compatibilityDate: string,
    assetsManifest: AssetManifest,
    fileContents: Map<string, Buffer>,
    bindings?: WorkerBinding[],
    vars?: Record<string, string>,
    dispatchNamespace?: string,
    assetsConfig?: WranglerConfig['assets'],
    additionalModules?: Map<string, string>,
    compatibilityFlags?: string[],
  ): Promise<string | undefined> {
    logger.info('🚀 Starting deployment process...')
    logger.info(`📦 Worker: ${scriptName}`)
    if (dispatchNamespace) {
      logger.info(`🎯 Dispatch Namespace: ${dispatchNamespace}`)
    }

    // Create temporary deployment directory
    const deployDir = await this.createDeployDir(scriptName)

    try {
      // Create wrangler.toml
      const assetsDir = path.join(deployDir, 'assets')
      await fs.mkdir(assetsDir, { recursive: true })

      const workerScriptPath = path.join(deployDir, 'index.js')
      await fs.writeFile(workerScriptPath, workerContent)

      // Copy assets to deployment directory
      await this.copyAssets(assetsDir, fileContents)

      // Generate wrangler.toml
      const wranglerConfig = this.generateWranglerConfig(
        scriptName,
        workerScriptPath,
        compatibilityDate,
        assetsDir,
        assetsConfig,
      )
      const wranglerPath = path.join(deployDir, 'wrangler.toml')
      await fs.writeFile(wranglerPath, wranglerConfig)

      // Deploy with Wrangler
      const result = await this.runWranglerDeploy(scriptName, dispatchNamespace, deployDir)

      logger.info('✅ Deployment completed successfully')
      return result.versionId
    } finally {
      // Cleanup temporary directory
      await this.cleanupDeployDir(deployDir)
    }
  }

  /**
   * Deploy a Worker without static assets using Wrangler CLI
   */
  async deploySimple(
    scriptName: string,
    workerContent: string,
    compatibilityDate: string,
    bindings?: WorkerBinding[],
    vars?: Record<string, string>,
    dispatchNamespace?: string,
    additionalModules?: Map<string, string>,
    compatibilityFlags?: string[],
  ): Promise<string | undefined> {
    logger.info('🚀 Starting simple deployment (no assets)...')
    logger.info(`📦 Worker: ${scriptName}`)
    if (dispatchNamespace) {
      logger.info(`🎯 Dispatch Namespace: ${dispatchNamespace}`)
    }

    const deployDir = await this.createDeployDir(scriptName)

    try {
      const workerScriptPath = path.join(deployDir, 'index.js')
      await fs.writeFile(workerScriptPath, workerContent)

      // Generate simple wrangler.toml without assets
      const wranglerConfig = this.generateWranglerConfig(
        scriptName,
        workerScriptPath,
        compatibilityDate,
        undefined,
        undefined,
      )
      const wranglerPath = path.join(deployDir, 'wrangler.toml')
      await fs.writeFile(wranglerPath, wranglerConfig)

      const result = await this.runWranglerDeploy(scriptName, dispatchNamespace, deployDir)

      logger.info('✅ Simple deployment completed successfully')
      return result.versionId
    } finally {
      await this.cleanupDeployDir(deployDir)
    }
  }

  /**
   * Create a unique deployment directory for each deployment
   */
  private async createDeployDir(scriptName: string): Promise<string> {
    const uniqueId = Date.now() + '-' + Math.random().toString(36).substring(7)
    const deployDir = path.join(this.tempDir, `${scriptName}-${uniqueId}`)
    await fs.mkdir(deployDir, { recursive: true })
    return deployDir
  }

  /**
   * Copy assets from fileContents map to the assets directory
   */
  private async copyAssets(assetsDir: string, fileContents: Map<string, Buffer>): Promise<void> {
    const entries = Array.from(fileContents.entries())
    for (const [filePath, content] of entries) {
      // Remove leading slash if present
      const cleanPath = filePath.startsWith('/') ? filePath.substring(1) : filePath
      const targetPath = path.join(assetsDir, cleanPath)
      const targetDir = path.dirname(targetPath)

      await fs.mkdir(targetDir, { recursive: true })
      await fs.writeFile(targetPath, content)
    }
  }

  /**
   * Generate wrangler.toml configuration
   */
  private generateWranglerConfig(
    scriptName: string,
    workerScriptPath: string,
    compatibilityDate: string,
    assetsDir?: string,
    assetsConfig?: WranglerConfig['assets'],
  ): string {
    let config = `name = "${scriptName}"
main = "${workerScriptPath}"
compatibility_date = "${compatibilityDate}"
`

    if (assetsDir) {
      config += `
[assets]
directory = "${assetsDir}"
binding = "${assetsConfig?.binding || 'ASSETS'}"
not_found_handling = "${assetsConfig?.not_found_handling || 'single-page-application'}"
`
    }

    return config
  }

  /**
   * Execute wrangler deploy command using Bun.spawn
   */
  private async runWranglerDeploy(
    scriptName: string,
    dispatchNamespace: string | undefined,
    cwd: string,
  ): Promise<DeploymentResult> {
    const args = ['npx', 'wrangler', 'deploy', '--name', scriptName]

    if (dispatchNamespace) {
      args.push('--dispatch-namespace', dispatchNamespace)
    }

    logger.info(`Running: ${args.join(' ')}`)

    const proc = Bun.spawn(args, {
      cwd,
      stdout: 'pipe',
      stderr: 'pipe',
      env: process.env,
    })

    const stdout = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()
    const exitCode = await proc.exited

    logger.info('Wrangler stdout:', stdout)
    if (stderr) logger.info('Wrangler stderr:', stderr)

    if (exitCode !== 0) {
      throw new Error(`Wrangler deploy failed (exit code ${exitCode}): ${stderr}`)
    }

    // Parse versionId from stdout
    // Expected format: "Current Version ID: <uuid>"
    const versionIdMatch = stdout.match(/Current Version ID:\s*([a-f0-9-]{36})/i)
    const versionId = versionIdMatch ? versionIdMatch[1] : undefined

    return { success: true, output: stdout, versionId }
  }

  /**
   * Delete a Worker using Wrangler CLI
   */
  async deleteWorker(scriptName: string, dispatchNamespace?: string): Promise<void> {
    const args = ['npx', 'wrangler', 'delete', scriptName]

    if (dispatchNamespace) {
      args.push('--dispatch-namespace', dispatchNamespace)
    }

    logger.info(`Deleting worker: ${scriptName}`)
    logger.info(`Running: ${args.join(' ')}`)

    const proc = Bun.spawn(args, {
      stdout: 'pipe',
      stderr: 'pipe',
      env: process.env,
    })

    const stdout = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()
    const exitCode = await proc.exited

    logger.info('Wrangler stdout:', stdout)
    if (stderr) logger.info('Wrangler stderr:', stderr)

    if (exitCode !== 0 && exitCode !== 1) {
      // Exit code 1 means the worker doesn't exist, which is fine
      throw new Error(`Wrangler delete failed (exit code ${exitCode}): ${stderr}`)
    }

    logger.info(`✅ Worker deleted: ${scriptName}`)
  }

  /**
   * Cleanup temporary deployment directory
   */
  private async cleanupDeployDir(deployDir: string): Promise<void> {
    try {
      await fs.rm(deployDir, { recursive: true, force: true })
    } catch (err) {
      logger.warn(`Failed to cleanup ${deployDir}:`, err)
    }
  }
}
