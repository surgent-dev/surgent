import Cloudflare from 'cloudflare'
import { config } from '@/lib/config'
import { createLogger } from '@/lib/logger'
import { AssetManifest, WorkerBinding, WranglerConfig } from './types'
import { getMimeType } from './utils/index'

const log = createLogger('deployer')

type AssetFile = { path: string; content: Buffer; hash: string }

const ASSET_UPLOAD_CONCURRENCY = 3
const MAX_ASSET_UPLOAD_ATTEMPTS = 5
const RETRIABLE_ASSET_UPLOAD_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504])

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Main deployment orchestrator using Cloudflare SDK
 * Handles both simple deployments and deployments with static assets
 */
export class WorkerDeployer {
  private client: Cloudflare
  private accountId: string

  constructor() {
    this.client = new Cloudflare({ apiToken: config.cloudflare.apiToken })
    this.accountId = config.cloudflare.accountId!
  }

  /**
   * Deploy a Worker with static assets to dispatch namespace
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
    compatibilityFlags?: string[],
    observability?: WranglerConfig['observability'],
  ): Promise<void> {
    log.info({ scriptName, dispatchNamespace }, 'starting asset deployment')

    if (!dispatchNamespace) {
      throw new Error('Dispatch namespace is required for Workers for Platforms')
    }

    // Prepare asset files with hashes
    const assetFilesByHash = new Map<string, AssetFile>()
    for (const [path, info] of Object.entries(assetsManifest)) {
      const content = fileContents.get(path)
      if (!content) {
        throw new Error(`Asset content missing for ${path}`)
      }
      if (!assetFilesByHash.has(info.hash)) {
        assetFilesByHash.set(info.hash, { path, content, hash: info.hash })
      }
    }

    // 1. Start asset upload session
    log.debug('starting asset upload session')
    const uploadSession =
      await this.client.workersForPlatforms.dispatch.namespaces.scripts.assetUpload.create(
        dispatchNamespace,
        scriptName,
        {
          account_id: this.accountId,
          manifest: assetsManifest,
        },
      )

    const { buckets, jwt: uploadJwt } = uploadSession
    if (!uploadJwt) {
      throw new Error('Failed to get upload JWT from asset session')
    }

    // 2. Upload assets in buckets
    let completionJwt = uploadJwt
    if (buckets && buckets.length > 0) {
      log.debug({ buckets: buckets.length }, 'uploading asset buckets')
      completionJwt = await this.uploadAssetBuckets(buckets, assetFilesByHash, uploadJwt)
    } else {
      log.debug('all assets already cached')
    }

    // 3. Deploy script with assets
    log.debug('deploying worker script')
    const scriptFilename = 'index.js'

    await this.client.workersForPlatforms.dispatch.namespaces.scripts.update(
      dispatchNamespace,
      scriptName,
      {
        account_id: this.accountId,
        metadata: {
          main_module: scriptFilename,
          compatibility_date: compatibilityDate,
          compatibility_flags: compatibilityFlags,
          bindings: this.buildBindings(bindings, vars, assetsConfig),
          observability,
          assets: {
            jwt: completionJwt,
            config: assetsConfig
              ? {
                  not_found_handling: assetsConfig.not_found_handling || 'single-page-application',
                  run_worker_first: assetsConfig.run_worker_first,
                }
              : undefined,
          },
        },
        files: [
          new File([workerContent], scriptFilename, { type: 'application/javascript+module' }),
        ],
      },
    )

    log.info({ scriptName }, 'deployment completed')
  }

  /**
   * Deploy a Worker without assets (simple script)
   */
  async deploySimple(
    scriptName: string,
    workerContent: string,
    compatibilityDate: string,
    bindings?: WorkerBinding[],
    vars?: Record<string, string>,
    dispatchNamespace?: string,
    compatibilityFlags?: string[],
    observability?: WranglerConfig['observability'],
  ): Promise<void> {
    log.info({ scriptName, dispatchNamespace }, 'starting simple deployment')

    if (!dispatchNamespace) {
      throw new Error('Dispatch namespace is required for Workers for Platforms')
    }

    const scriptFilename = 'index.js'

    await this.client.workersForPlatforms.dispatch.namespaces.scripts.update(
      dispatchNamespace,
      scriptName,
      {
        account_id: this.accountId,
        metadata: {
          main_module: scriptFilename,
          compatibility_date: compatibilityDate,
          compatibility_flags: compatibilityFlags,
          bindings: this.buildBindings(bindings, vars),
          observability,
        },
        files: [
          new File([workerContent], scriptFilename, { type: 'application/javascript+module' }),
        ],
      },
    )

    log.info({ scriptName }, 'simple deployment completed')
  }

  /**
   * Delete a Worker from dispatch namespace
   */
  async deleteWorker(scriptName: string, dispatchNamespace?: string): Promise<void> {
    if (!dispatchNamespace) {
      throw new Error('Dispatch namespace is required')
    }

    log.info({ scriptName }, 'deleting worker')

    try {
      await this.client.workersForPlatforms.dispatch.namespaces.scripts.delete(
        dispatchNamespace,
        scriptName,
        {
          account_id: this.accountId,
          force: true,
        },
      )
      log.info({ scriptName }, 'worker deleted')
    } catch (err: any) {
      // 404 means already deleted - that's fine
      if (err?.status === 404) {
        log.debug({ scriptName }, 'worker not found (already deleted)')
        return
      }
      throw err
    }
  }

  /**
   * Upload asset buckets and return completion JWT
   */
  private async uploadAssetBuckets(
    buckets: string[][],
    assetFilesByHash: Map<string, AssetFile>,
    uploadJwt: string,
  ): Promise<string> {
    let completionJwt: string | undefined
    let nextBucketIndex = 0
    const workerCount = Math.min(ASSET_UPLOAD_CONCURRENCY, buckets.length)

    const uploadNextBucket = async () => {
      while (nextBucketIndex < buckets.length) {
        const bucketIndex = nextBucketIndex++
        const jwt = await this.uploadAssetBucket(
          buckets[bucketIndex]!,
          bucketIndex,
          buckets.length,
          assetFilesByHash,
          uploadJwt,
        )
        if (jwt) completionJwt = jwt
      }
    }

    await Promise.all(Array.from({ length: workerCount }, () => uploadNextBucket()))

    if (!completionJwt) {
      throw new Error('Failed to complete asset upload')
    }

    return completionJwt
  }

  private async uploadAssetBucket(
    bucket: string[],
    bucketIndex: number,
    bucketCount: number,
    assetFilesByHash: Map<string, AssetFile>,
    uploadJwt: string,
  ): Promise<string | undefined> {
    for (let attempt = 0; attempt < MAX_ASSET_UPLOAD_ATTEMPTS; attempt++) {
      const formData = new FormData()

      for (const hash of bucket) {
        const file = assetFilesByHash.get(hash)
        if (!file) {
          throw new Error(`Asset with hash ${hash} not found`)
        }
        const blob = new Blob([file.content.toString('base64')], { type: getMimeType(file.path) })
        formData.append(hash, blob, hash)
      }

      log.debug(
        { bucket: `${bucketIndex + 1}/${bucketCount}`, attempt: attempt + 1 },
        'uploading bucket',
      )

      try {
        const response = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/workers/assets/upload?base64=true`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${uploadJwt}` },
            body: formData,
          },
        )

        if (response.ok) {
          if (response.status !== 201) return undefined
          const data: any = await response.json()
          return data?.result?.jwt
        }

        const error = await response.text()
        if (
          attempt === MAX_ASSET_UPLOAD_ATTEMPTS - 1 ||
          !RETRIABLE_ASSET_UPLOAD_STATUS_CODES.has(response.status)
        ) {
          throw new Error(`Failed to upload assets: ${response.status} - ${error}`)
        }
      } catch (error) {
        if (attempt === MAX_ASSET_UPLOAD_ATTEMPTS - 1) throw error
      }

      await sleep(Math.min(1_000 * 2 ** attempt, 8_000))
    }

    throw new Error(`Failed to upload asset bucket ${bucketIndex + 1}/${bucketCount}`)
  }

  /**
   * Build bindings array for script metadata
   */
  private buildBindings(
    bindings?: WorkerBinding[],
    vars?: Record<string, string>,
    assetsConfig?: WranglerConfig['assets'],
  ): any[] {
    const result: any[] = []
    const hasAssetsBinding = bindings?.some((binding) => binding.type === 'assets') || false

    // Add ASSETS binding if we have assets
    if (assetsConfig && !hasAssetsBinding) {
      result.push({
        type: 'assets',
        name: assetsConfig.binding || 'ASSETS',
      })
    }

    // Add plain_text bindings for env vars
    if (vars) {
      for (const [name, text] of Object.entries(vars)) {
        result.push({ type: 'plain_text', name, text })
      }
    }

    // Add custom bindings
    if (bindings) {
      for (const binding of bindings) {
        result.push(binding)
      }
    }

    return result
  }
}
