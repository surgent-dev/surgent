import { WorkerDeployer } from './deployer'
import { WorkerBinding, DeployConfig, DispatchDeployConfig, WranglerConfig } from './types'
import { validateConfig, buildWorkerBindings } from './utils/index'
import { parse as parseJson } from 'jsonc-parser'

/**
 * Pure deployment configuration builder
 * Transforms Wrangler config into deployment-ready configuration
 */
export function buildDeploymentConfig(
  config: WranglerConfig,
  workerContent: string,
  accountId: string,
  assetsManifest?: Record<string, { hash: string; size: number }>,
  compatibilityFlags?: string[],
): DeployConfig {
  const hasAssets = assetsManifest && Object.keys(assetsManifest).length > 0
  const bindings = buildWorkerBindings(config, hasAssets) as WorkerBinding[]

  return {
    accountId,
    scriptName: config.name,
    compatibilityDate: config.compatibility_date,
    compatibilityFlags: compatibilityFlags || config.compatibility_flags,
    workerContent,
    assets: assetsManifest,
    bindings: bindings.length > 0 ? bindings : undefined,
    vars: config.vars,
    observability: config.observability,
  }
}

/**
 * Pure function to parse wrangler configuration from content string
 */
export function parseWranglerConfig(configContent: string): WranglerConfig {
  const config = parseJson(configContent) as WranglerConfig
  validateConfig(config)
  return config
}

/**
 * Deploy a Cloudflare Worker with the provided configuration and assets
 */
export async function deployWorker(
  deployConfig: DeployConfig,
  fileContents?: Map<string, Buffer>,
  assetsConfig?: WranglerConfig['assets'],
  dispatchNamespace?: string,
): Promise<void> {
  const deployer = new WorkerDeployer()

  if (deployConfig.assets && fileContents) {
    await deployer.deployWithAssets(
      deployConfig.scriptName,
      deployConfig.workerContent,
      deployConfig.compatibilityDate,
      deployConfig.assets,
      fileContents,
      deployConfig.bindings,
      deployConfig.vars,
      dispatchNamespace,
      assetsConfig,
      deployConfig.compatibilityFlags,
      deployConfig.observability,
    )
  } else {
    await deployer.deploySimple(
      deployConfig.scriptName,
      deployConfig.workerContent,
      deployConfig.compatibilityDate,
      deployConfig.bindings,
      deployConfig.vars,
      dispatchNamespace,
      deployConfig.compatibilityFlags,
      deployConfig.observability,
    )
  }
}

/**
 * Deploy to Workers for Platforms (Dispatch namespace)
 */
export async function deployToDispatch(
  deployConfig: DispatchDeployConfig,
  fileContents?: Map<string, Buffer>,
  assetsConfig?: WranglerConfig['assets'],
): Promise<void> {
  await deployWorker(deployConfig, fileContents, assetsConfig, deployConfig.dispatchNamespace)
}
