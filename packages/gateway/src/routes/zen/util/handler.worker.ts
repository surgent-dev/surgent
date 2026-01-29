import type { Context } from 'hono'
import { sql } from 'kysely'
import type { AppContext } from '../../../types'
import { getDb } from '../../../db'
import { loadZenData, ZenData } from './zenData'
import { createLogger } from './logger'
import { verifyApiKey } from '../../../auth'
import {
  AuthError,
  CreditsError,
  MonthlyLimitError,
  SubscriptionError,
  UserLimitError,
  ModelError,
  RateLimitError,
} from './error'
import {
  createBodyConverter,
  createStreamPartConverter,
  createResponseConverter,
} from './provider/provider'
import type { UsageInfo } from './provider/provider'
import { anthropicHelper } from './provider/anthropic'
import { googleHelper } from './provider/google'
import { openaiHelper } from './provider/openai'
import { oaCompatHelper } from './provider/openai-compatible'
import { createRateLimiter } from './rateLimiter'
import { createDataDumper } from './dataDumper'
import { createTrialLimiter } from './trialLimiter'
import { createStickyTracker } from './stickyProviderTracker'

type ZenConfig = ReturnType<typeof loadZenData>

type RetryOptions = {
  excludeProviders: string[]
  retryCount: number
}

type ProviderInfo = {
  credentials?: string | null
}

type AuthInfo = {
  apiKeyId: string
  projectId: string
  organizationId: string
  userId: string
  provider: ProviderInfo | null
  isDisabled: boolean
}

function centsToMicroCents(amount: number) {
  return Math.round(amount * 1_000_000)
}

export async function handleZenRequest(
  c: Context<AppContext>,
  opts: {
    format: ZenData.Format
    parseApiKey: (headers: Headers) => string | undefined
    parseModel: (url: string, body: any) => string
    parseIsStream: (url: string, body: any) => boolean
  },
) {
  type ModelInfo = Awaited<ReturnType<typeof validateModel>>
  type ProviderSelection = Awaited<ReturnType<typeof selectProvider>>

  const MAX_RETRIES = 3
  const logger = createLogger(c.env.STAGE)
  const db = getDb(c.env)

  try {
    const url = c.req.url
    const body = await c.req.json()
    const model = opts.parseModel(url, body)
    const isStream = opts.parseIsStream(url, body)
    const ip = c.req.header('x-real-ip') ?? ''
    const sessionId = c.req.header('x-opencode-session') ?? ''
    const requestId = c.req.header('x-opencode-request') ?? ''
    const projectId = c.req.header('x-opencode-project') ?? ''
    const ocClient = c.req.header('x-opencode-client') ?? ''
    logger.metric({
      is_stream: isStream,
      session: sessionId,
      request: requestId,
      client: ocClient,
    })

    const zenData = loadZenData(c.env)
    const modelInfo = validateModel(zenData, model)
    const dataDumper = createDataDumper(c.env, c.executionCtx, sessionId, requestId, projectId)
    const trialLimiter = createTrialLimiter(db, modelInfo.trial, ip, ocClient)
    const isTrial = await trialLimiter?.isTrial()
    const rateLimiter = createRateLimiter(db, modelInfo.rateLimit, ip, c.env.STAGE)
    await rateLimiter?.check()
    const stickyTracker = createStickyTracker(modelInfo.stickyProvider, sessionId, c.env.GATEWAY_KV)
    const stickyProvider = (await stickyTracker?.get()) ?? undefined
    const authInfo = await authenticate(modelInfo)
    const retriableRequest = async (
      retry: RetryOptions = { excludeProviders: [], retryCount: 0 },
    ) => {
      const providerInfo = selectProvider(
        model,
        zenData,
        authInfo,
        modelInfo,
        sessionId,
        isTrial ?? false,
        retry,
        stickyProvider,
      )
      validateModelSettings(authInfo)
      updateProviderKey(authInfo, providerInfo)
      logger.metric({ provider: providerInfo.id })

      const startTimestamp = Date.now()
      const reqUrl = providerInfo.modifyUrl(providerInfo.api, isStream)
      const reqBody = JSON.stringify(
        providerInfo.modifyBody({
          ...createBodyConverter(opts.format, providerInfo.format)(body),
          model: providerInfo.model,
        }),
      )
      logger.debug('REQUEST URL: ' + reqUrl)
      logger.debug('REQUEST: ' + reqBody.substring(0, 300) + '...')
      const res = await fetch(reqUrl, {
        method: 'POST',
        headers: (() => {
          const headers = new Headers(c.req.raw.headers)
          providerInfo.modifyHeaders(headers, body, providerInfo.apiKey)
          Object.entries(providerInfo.headerMappings ?? {}).forEach(([k, v]) => {
            const value = headers.get(v)
            if (value) headers.set(k, value)
          })
          headers.delete('host')
          headers.delete('content-length')
          headers.delete('x-opencode-request')
          headers.delete('x-opencode-session')
          headers.delete('x-opencode-project')
          headers.delete('x-opencode-client')
          return headers
        })(),
        body: reqBody,
      })

      if (
        res.status != 200 &&
        res.status !== 404 &&
        modelInfo.stickyProvider !== 'strict' &&
        modelInfo.fallbackProvider &&
        providerInfo.id !== modelInfo.fallbackProvider
      ) {
        return retriableRequest({
          excludeProviders: [...retry.excludeProviders, providerInfo.id],
          retryCount: retry.retryCount + 1,
        })
      }

      return { providerInfo, reqBody, res, startTimestamp }
    }

    const { providerInfo, reqBody, res, startTimestamp } = await retriableRequest()

    dataDumper?.provideModel(providerInfo.storeModel)
    dataDumper?.provideRequest(reqBody)
    await stickyTracker?.set(providerInfo.id)

    const resStatus = res.status === 404 ? 400 : res.status

    const resHeaders = new Headers()
    const keepHeaders = ['content-type', 'cache-control']
    res.headers.forEach((v, k) => {
      if (keepHeaders.includes(k.toLowerCase())) {
        resHeaders.set(k, v)
      }
    })
    logger.debug('STATUS: ' + res.status + ' ' + res.statusText)

    if (!isStream) {
      const responseConverter = createResponseConverter(providerInfo.format, opts.format)
      const json: { usage?: unknown } = await res.json()
      const body = JSON.stringify(responseConverter(json))
      logger.metric({ response_length: body.length })
      logger.debug('RESPONSE: ' + body)
      dataDumper?.provideResponse(body)
      dataDumper?.flush()
      const tokensInfo = providerInfo.normalizeUsage(json.usage)
      await trialLimiter?.track(tokensInfo)
      await rateLimiter?.track()
      await trackUsage(authInfo, modelInfo, providerInfo, tokensInfo)
      return new Response(body, {
        status: resStatus,
        statusText: res.statusText,
        headers: resHeaders,
      })
    }

    const streamConverter = createStreamPartConverter(providerInfo.format, opts.format)
    const usageParser = providerInfo.createUsageParser()
    const binaryDecoder = providerInfo.createBinaryStreamDecoder()
    const stream = new ReadableStream({
      start(controller) {
        const reader = res.body?.getReader()
        const decoder = new TextDecoder()
        const encoder = new TextEncoder()

        let buffer = ''
        let responseLength = 0

        function pump(): Promise<void> {
          return (
            reader?.read().then(async ({ done, value: rawValue }) => {
              if (done) {
                logger.metric({
                  response_length: responseLength,
                  'timestamp.last_byte': Date.now(),
                })
                dataDumper?.flush()
                await rateLimiter?.track()
                const usage = usageParser.retrieve()
                if (usage) {
                  const tokensInfo = providerInfo.normalizeUsage(usage)
                  await trialLimiter?.track(tokensInfo)
                  await trackUsage(authInfo, modelInfo, providerInfo, tokensInfo)
                }
                controller.close()
                return
              }

              if (responseLength === 0) {
                const now = Date.now()
                logger.metric({
                  time_to_first_byte: now - startTimestamp,
                  'timestamp.first_byte': now,
                })
              }

              const value = binaryDecoder ? binaryDecoder(rawValue) : rawValue
              if (!value) return

              const chunk = decoder.decode(value, { stream: true })
              responseLength += value.length
              buffer += chunk
              dataDumper?.provideStream(chunk)

              const parts = buffer.split(providerInfo.streamSeparator)
              buffer = parts.pop() ?? ''

              for (let part of parts) {
                logger.debug('PART: ' + part)

                part = part.trim()
                usageParser.parse(part)

                if (providerInfo.format !== opts.format) {
                  part = streamConverter(part)
                  controller.enqueue(encoder.encode(part + '\\n\\n'))
                }
              }

              if (providerInfo.format === opts.format) {
                controller.enqueue(value)
              }

              return pump()
            }) || Promise.resolve()
          )
        }

        return pump()
      },
    })

    return new Response(stream, {
      status: resStatus,
      statusText: res.statusText,
      headers: resHeaders,
    })
  } catch (error: any) {
    logger.metric({
      'error.type': error.constructor.name,
      'error.message': error.message,
    })

    if (
      error instanceof AuthError ||
      error instanceof CreditsError ||
      error instanceof MonthlyLimitError ||
      error instanceof UserLimitError ||
      error instanceof ModelError
    ) {
      return new Response(
        JSON.stringify({
          type: 'error',
          error: { type: error.constructor.name, message: error.message },
        }),
        { status: 401 },
      )
    }

    if (error instanceof RateLimitError || error instanceof SubscriptionError) {
      const headers = new Headers()
      if (error instanceof SubscriptionError && error.retryAfter) {
        headers.set('retry-after', String(error.retryAfter))
      }
      return new Response(
        JSON.stringify({
          type: 'error',
          error: { type: error.constructor.name, message: error.message },
        }),
        { status: 429, headers },
      )
    }

    return new Response(
      JSON.stringify({
        type: 'error',
        error: {
          type: 'error',
          message: error.message,
        },
      }),
      { status: 500 },
    )
  }

  function validateModel(zenData: ZenConfig, reqModel: string) {
    if (!(reqModel in zenData.models)) throw new ModelError(`Model ${reqModel} not supported`)

    const modelId = reqModel as keyof typeof zenData.models
    const modelData = Array.isArray(zenData.models[modelId])
      ? zenData.models[modelId].find((item) => opts.format === item.formatFilter)
      : zenData.models[modelId]

    if (!modelData)
      throw new ModelError(`Model ${reqModel} not supported for format ${opts.format}`)

    logger.metric({ model: modelId })

    return { id: modelId, ...modelData }
  }

  function selectProvider(
    reqModel: string,
    zenData: ZenConfig,
    authInfo: AuthInfo | undefined,
    modelInfo: ModelInfo,
    sessionId: string,
    isTrial: boolean,
    retry: RetryOptions,
    stickyProvider: string | undefined,
  ) {
    const modelProvider = (() => {
      if (authInfo?.provider?.credentials) {
        return modelInfo.providers.find((provider) => provider.id === modelInfo.byokProvider)
      }

      if (isTrial) {
        return modelInfo.providers.find((provider) => provider.id === modelInfo.trial!.provider)
      }

      if (stickyProvider) {
        const provider = modelInfo.providers.find((provider) => provider.id === stickyProvider)
        if (provider) return provider
      }

      if (retry.retryCount === MAX_RETRIES) {
        return modelInfo.providers.find((provider) => provider.id === modelInfo.fallbackProvider)
      }

      const providers = modelInfo.providers
        .filter((provider) => !provider.disabled)
        .filter((provider) => !retry.excludeProviders.includes(provider.id))
        .flatMap((provider) => Array<typeof provider>(provider.weight ?? 1).fill(provider))

      let h = 0
      const length = sessionId.length
      for (let i = length - 4; i < length; i++) {
        h = (h * 31 + sessionId.charCodeAt(i)) | 0
      }
      const index = (h >>> 0) % providers.length
      return providers[index || 0]
    })()

    if (!modelProvider) throw new ModelError('No provider available')

    const providerConfig = zenData.providers[modelProvider.id]
    if (!providerConfig) throw new ModelError(`Provider ${modelProvider.id} not supported`)

    const providerModel = modelProvider.model
    const helper = (() => {
      if (providerConfig.format === 'anthropic') return anthropicHelper({ reqModel, providerModel })
      if (providerConfig.format === 'google') return googleHelper({ reqModel, providerModel })
      if (providerConfig.format === 'openai') return openaiHelper({ reqModel, providerModel })
      return oaCompatHelper({ reqModel, providerModel })
    })()

    return { ...modelProvider, ...providerConfig, ...helper }
  }

  async function authenticate(modelInfo: ModelInfo): Promise<AuthInfo | undefined> {
    const key = opts.parseApiKey(c.req.raw.headers)
    logger.debug(`AUTH: key present=${!!key}, key prefix=${key?.slice(0, 10)}...`)
    if (!key || key === 'public') {
      if (modelInfo.allowAnonymous) return
      throw new AuthError('Missing API key.')
    }

    const verify = await verifyApiKey(c.env, key)
    logger.debug(`AUTH: verify result=${JSON.stringify(verify)}`)
    if (!verify.valid || !verify.key) throw new AuthError('Invalid API key.')

    const byokProvider = modelInfo.byokProvider ?? ''
    const row = await db
      .selectFrom('apikey as k')
      .innerJoin('project as pr', 'pr.id', 'k.projectId')
      .leftJoin('provider as p', (join) =>
        join
          .onRef('p.projectId', '=', 'k.projectId')
          .on('p.provider', '=', byokProvider)
          .on('p.deletedAt', 'is', null),
      )
      .leftJoin('model as m', (join) =>
        join
          .onRef('m.projectId', '=', 'k.projectId')
          .on('m.model', '=', modelInfo.id)
          .on('m.deletedAt', 'is', null),
      )
      .select(({ ref }) => [
        ref('k.id').as('apiKeyId'),
        ref('k.projectId').as('projectId'),
        ref('pr.organizationId').as('organizationId'),
        ref('k.userId').as('userId'),
        ref('k.enabled').as('enabled'),
        ref('k.expiresAt').as('expiresAt'),
        ref('p.credentials').as('providerCredentials'),
        ref('m.id').as('disabledModelId'),
      ])
      .where('k.id', '=', verify.key.id)
      .executeTakeFirst()

    if (!row || !row.enabled || !row.projectId || !row.organizationId)
      throw new AuthError('Invalid API key.')
    if (row.expiresAt && row.expiresAt <= new Date()) throw new AuthError('API key expired.')

    const provider =
      row.providerCredentials === null
        ? null
        : {
            credentials: row.providerCredentials,
          }

    logger.metric({
      api_key: row.apiKeyId,
      project: row.projectId,
    })

    return {
      apiKeyId: row.apiKeyId,
      projectId: row.projectId,
      organizationId: row.organizationId,
      userId: row.userId,
      provider,
      isDisabled: !!row.disabledModelId,
    }
  }

  function validateModelSettings(authInfo: AuthInfo | undefined) {
    if (!authInfo) return
    if (authInfo.isDisabled) throw new ModelError('Model is disabled')
  }

  function updateProviderKey(authInfo: AuthInfo | undefined, providerInfo: ProviderSelection) {
    if (!authInfo?.provider?.credentials) return
    providerInfo.apiKey = authInfo.provider.credentials
  }

  async function trackUsage(
    authInfo: AuthInfo | undefined,
    modelInfo: ModelInfo,
    providerInfo: ProviderSelection,
    usageInfo: UsageInfo,
  ) {
    const {
      inputTokens,
      outputTokens,
      reasoningTokens,
      cacheReadTokens,
      cacheWrite5mTokens,
      cacheWrite1hTokens,
    } = usageInfo
    const calcCost = (rate: number | undefined, tokens: number | undefined) => {
      if (!rate || !tokens) return undefined
      return rate * tokens * 100
    }

    const modelCost =
      modelInfo.cost200K &&
      inputTokens + (cacheReadTokens ?? 0) + (cacheWrite5mTokens ?? 0) + (cacheWrite1hTokens ?? 0) >
        200_000
        ? modelInfo.cost200K
        : modelInfo.cost

    const inputCost = modelCost.input * inputTokens * 100
    const outputCost = modelCost.output * outputTokens * 100
    const reasoningCost = calcCost(modelCost.output, reasoningTokens)
    const cacheReadCost = calcCost(modelCost.cacheRead, cacheReadTokens)
    const cacheWrite5mCost = calcCost(modelCost.cacheWrite5m, cacheWrite5mTokens)
    const cacheWrite1hCost = calcCost(modelCost.cacheWrite1h, cacheWrite1hTokens)
    const totalCostInCent =
      inputCost +
      outputCost +
      (reasoningCost ?? 0) +
      (cacheReadCost ?? 0) +
      (cacheWrite5mCost ?? 0) +
      (cacheWrite1hCost ?? 0)

    logger.metric({
      'tokens.input': inputTokens,
      'tokens.output': outputTokens,
      'tokens.reasoning': reasoningTokens,
      'tokens.cache_read': cacheReadTokens,
      'tokens.cache_write_5m': cacheWrite5mTokens,
      'tokens.cache_write_1h': cacheWrite1hTokens,
      'cost.input': Math.round(inputCost),
      'cost.output': Math.round(outputCost),
      'cost.reasoning': reasoningCost ? Math.round(reasoningCost) : undefined,
      'cost.cache_read': cacheReadCost ? Math.round(cacheReadCost) : undefined,
      'cost.cache_write_5m': cacheWrite5mCost ? Math.round(cacheWrite5mCost) : undefined,
      'cost.cache_write_1h': cacheWrite1hCost ? Math.round(cacheWrite1hCost) : undefined,
      'cost.total': Math.round(totalCostInCent),
    })

    if (!authInfo) return

    const costMicro = authInfo.provider?.credentials ? 0 : centsToMicroCents(totalCostInCent)
    const costBig = BigInt(costMicro)

    await db.transaction().execute(async (tx) => {
      await tx
        .insertInto('usage')
        .values({
          id: crypto.randomUUID(),
          projectId: authInfo.projectId,
          model: modelInfo.id,
          provider: providerInfo.id,
          inputTokens,
          outputTokens,
          reasoningTokens,
          cacheReadTokens,
          cacheWrite5mTokens,
          cacheWrite1hTokens,
          cost: String(costBig),
          keyId: authInfo.apiKeyId,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        })
        .execute()

      await tx
        .updateTable('apikey')
        .set({ lastRequest: sql`now()` })
        .where('id', '=', authInfo.apiKeyId)
        .execute()
    })
    return costBig
  }
}
