import type { Context } from 'hono'
import { sql } from 'kysely'
import { getAllowanceWindow, sameAllowanceWindowStart } from '@repo/db'
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
import { openaiChatgptHelper } from './provider/openai-chatgpt'
import { oaCompatHelper } from './provider/openai-compatible'
import {
  parseProviderCredentials,
  refreshChatgptCredentials,
  serializeProviderCredentials,
  shouldRefreshChatgptCredentials,
  type ProviderCredentials,
} from './provider/credentials'
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
  id: string
  provider: string
  credentials: string
  auth: ProviderCredentials
}

type UsageBillingMode = 'surgent' | 'byok' | 'anonymous'
type UsageBillingTier = 'free' | 'pro' | null
type UsageBillingInterval = 'month' | 'year' | null
type UsageBillingContext = {
  mode: UsageBillingMode
  tier: UsageBillingTier
  interval: UsageBillingInterval
}

type UsageSettlement = {
  costMicros: number
  uncoveredMicros: number
}

type AuthInfo = {
  apiKeyId: string
  projectId: string
  organizationId: string
  userId: string
  provider: ProviderInfo | null
  isDisabled: boolean
  billingTier: string | null
  billingInterval: string | null
}

function centsToMicroCents(amount: number) {
  return Math.round(amount * 1_000_000)
}

const SURGENT_MARKUP_MULTIPLIER = 1.3

function isAllowanceEligible(tier: string, status: string) {
  if (tier === 'free') return true
  return status === 'active' || status === 'trialing'
}

function getEffectiveIncludedUsage(
  row: {
    tier: string
    interval: string | null
    currentPeriodStart: Date | null
    currentPeriodEnd: Date | null
    includedUsageMicros: string | number | null
    includedUsagePeriodStart: Date | null
  },
  now = new Date(),
) {
  const window = getAllowanceWindow(
    {
      tier: row.tier,
      interval: row.interval,
      currentPeriodStart: row.currentPeriodStart,
      currentPeriodEnd: row.currentPeriodEnd,
    },
    now,
  )

  if (!sameAllowanceWindowStart(row.includedUsagePeriodStart, window.start)) {
    return 0
  }

  return Number(row.includedUsageMicros ?? 0)
}

function getMonthlySpendUsage(
  row: {
    monthlySpendUsageMicros: string | number | null
    monthlySpendUsagePeriodStart: Date | null
  },
  periodStart: Date,
) {
  if (!sameAllowanceWindowStart(row.monthlySpendUsagePeriodStart, periodStart)) {
    return 0
  }

  return Number(row.monthlySpendUsageMicros ?? 0)
}

function getIncludedBalance(
  row: {
    tier: string
    interval: string | null
    status: string
    monthlyAllowanceMicros: string | number | null
    currentPeriodStart: Date | null
    currentPeriodEnd: Date | null
    includedUsageMicros: string | number | null
    includedUsagePeriodStart: Date | null
  },
  now = new Date(),
) {
  if (!isAllowanceEligible(row.tier, row.status)) return 0
  const allowance = Number(row.monthlyAllowanceMicros ?? 0)
  if (allowance <= 0) return 0
  return Math.max(allowance - getEffectiveIncludedUsage(row, now), 0)
}

function getUsageDebits(costMicro: number, included: number, prepaid: number) {
  const includedDebit = Math.min(included, costMicro)
  const prepaidDebit = Math.min(prepaid, Math.max(costMicro - includedDebit, 0))
  return {
    includedDebit,
    prepaidDebit,
    uncoveredMicros: Math.max(costMicro - includedDebit - prepaidDebit, 0),
  }
}

function resolveBillingContext(authInfo: AuthInfo | undefined): UsageBillingContext {
  if (!authInfo) {
    return {
      mode: 'anonymous',
      tier: null,
      interval: null,
    }
  }

  const billing = {
    tier:
      authInfo.billingTier === 'free' || authInfo.billingTier === 'pro'
        ? authInfo.billingTier
        : null,
    interval:
      authInfo.billingInterval === 'month' || authInfo.billingInterval === 'year'
        ? authInfo.billingInterval
        : null,
  } satisfies Pick<UsageBillingContext, 'tier' | 'interval'>
  if (authInfo.provider?.credentials) {
    return {
      mode: 'byok',
      ...billing,
    }
  }

  return {
    mode: 'surgent',
    ...billing,
  }
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
    const billing = resolveBillingContext(authInfo)
    logger.metric({
      billing_mode: billing.mode,
      billing_tier: billing.tier ?? undefined,
      billing_interval: billing.interval ?? undefined,
    })
    await ensureBillingAccess(authInfo)

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
      await updateProviderKey(authInfo, providerInfo)
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

    if (resStatus >= 400) {
      const contentType = res.headers.get('content-type') ?? ''
      const raw = await res.text()
      const body = (() => {
        if (raw && contentType.includes('application/json')) return raw
        if (raw)
          return JSON.stringify({
            type: 'error',
            error: { type: 'UpstreamError', message: raw },
          })
        return JSON.stringify({
          type: 'error',
          error: {
            type: 'UpstreamError',
            message: res.statusText || 'Upstream error',
          },
        })
      })()
      if (!resHeaders.get('content-type')) resHeaders.set('content-type', 'application/json')
      dataDumper?.provideResponse(body)
      dataDumper?.flush()
      return new Response(body, {
        status: resStatus,
        statusText: res.statusText,
        headers: resHeaders,
      })
    }

    if (!isStream) {
      const responseConverter = createResponseConverter(providerInfo.format, opts.format)
      const json: { usage?: unknown } = providerInfo.parseNonStreamResponse
        ? await providerInfo.parseNonStreamResponse(res)
        : await res.json()
      const body = JSON.stringify(responseConverter(json))
      if (providerInfo.parseNonStreamResponse) {
        resHeaders.set('content-type', 'application/json; charset=utf-8')
      }
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
    const binaryDecoder = providerInfo.createBinaryStreamDecoder?.()
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
                  controller.enqueue(encoder.encode(part + '\n\n'))
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
    const providerAuth = authInfo?.provider?.auth
    const helper = (() => {
      if (providerAuth?.type === 'chatgpt' && providerConfig.format === 'openai') {
        return openaiChatgptHelper({
          reqModel,
          providerModel,
          auth: providerAuth,
        })
      }
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
          .onRef('p.organizationId', '=', 'pr.organizationId')
          .on('p.provider', '=', byokProvider)
          .on('p.deletedAt', 'is', null),
      )
      .leftJoin('model as m', (join) =>
        join
          .onRef('m.projectId', '=', 'k.projectId')
          .on('m.model', '=', modelInfo.id)
          .on('m.deletedAt', 'is', null),
      )
      .leftJoin('billing_subscription as bs', 'bs.organizationId', 'pr.organizationId')
      .select(({ ref }) => [
        ref('k.id').as('apiKeyId'),
        ref('k.projectId').as('projectId'),
        ref('pr.organizationId').as('organizationId'),
        ref('k.userId').as('userId'),
        ref('k.enabled').as('enabled'),
        ref('k.expiresAt').as('expiresAt'),
        ref('p.id').as('providerId'),
        ref('p.provider').as('providerName'),
        ref('p.credentials').as('providerCredentials'),
        ref('m.id').as('disabledModelId'),
        ref('bs.tier').as('billingTier'),
        ref('bs.interval').as('billingInterval'),
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
            id: row.providerId!,
            provider: row.providerName ?? byokProvider,
            credentials: row.providerCredentials,
            auth: (() => {
              try {
                return parseProviderCredentials(row.providerCredentials)
              } catch (error) {
                const message =
                  error instanceof Error ? error.message : 'Invalid provider credentials.'
                throw new AuthError(message)
              }
            })(),
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
      billingTier: row.billingTier ?? 'free',
      billingInterval: row.billingInterval,
    }
  }

  function validateModelSettings(authInfo: AuthInfo | undefined) {
    if (!authInfo) return
    if (authInfo.isDisabled) throw new ModelError('Model is disabled')
  }

  async function updateProviderKey(
    authInfo: AuthInfo | undefined,
    providerInfo: ProviderSelection,
  ) {
    if (!authInfo?.provider?.credentials) return
    const auth = authInfo.provider.auth
    if (auth.type === 'api') {
      providerInfo.apiKey = auth.apiKey
      return
    }
    if (!shouldRefreshChatgptCredentials(auth)) return

    let next
    try {
      next = await refreshChatgptCredentials(auth)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ChatGPT authentication failed.'
      throw new AuthError(message)
    }
    const previousCredentials = authInfo.provider.credentials
    const nextCredentials = serializeProviderCredentials(next)
    const result = await db
      .updateTable('provider')
      .set({
        credentials: nextCredentials,
        updatedAt: new Date(),
      })
      .where('id', '=', authInfo.provider.id)
      .where('credentials', '=', previousCredentials)
      .executeTakeFirst()

    if (result && result.numUpdatedRows > 0n) {
      auth.accessToken = next.accessToken
      auth.refreshToken = next.refreshToken
      auth.accountId = next.accountId
      auth.expiresAt = next.expiresAt
      authInfo.provider.credentials = nextCredentials
      return
    }

    const latest = await db
      .selectFrom('provider')
      .select('credentials')
      .where('id', '=', authInfo.provider.id)
      .where('deletedAt', 'is', null)
      .executeTakeFirst()
    if (!latest?.credentials) {
      throw new AuthError('ChatGPT authentication state was lost.')
    }

    let resolved
    try {
      resolved = parseProviderCredentials(latest.credentials)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid provider credentials.'
      throw new AuthError(message)
    }
    if (resolved.type !== 'chatgpt') {
      throw new AuthError('ChatGPT authentication state is invalid.')
    }

    auth.accessToken = resolved.accessToken
    auth.refreshToken = resolved.refreshToken
    auth.accountId = resolved.accountId
    auth.expiresAt = resolved.expiresAt
    authInfo.provider.credentials = latest.credentials
  }

  async function ensureBillingAccess(authInfo: AuthInfo | undefined) {
    if (!authInfo || authInfo.provider?.credentials) return

    const now = new Date()
    const state = await db
      .selectFrom('billing_account as account')
      .innerJoin(
        'billing_subscription as subscription',
        'subscription.organizationId',
        'account.organizationId',
      )
      .select([
        'account.organizationId',
        'account.prepaidBalanceMicros',
        'account.monthlySpendLimitMicros',
        'account.monthlySpendUsageMicros',
        'account.monthlySpendUsagePeriodStart',
        'subscription.tier',
        'subscription.interval',
        'subscription.status',
        'subscription.monthlyAllowanceMicros',
        'subscription.currentPeriodStart',
        'subscription.currentPeriodEnd',
        'subscription.includedUsageMicros',
        'subscription.includedUsagePeriodStart',
      ])
      .where('account.organizationId', '=', authInfo.organizationId)
      .executeTakeFirst()

    if (!state) throw new CreditsError('Billing state is not ready yet. Please try again.')
    const allowanceWindow = getAllowanceWindow(
      {
        tier: state.tier,
        interval: state.interval,
        currentPeriodStart: state.currentPeriodStart,
        currentPeriodEnd: state.currentPeriodEnd,
      },
      now,
    )
    const included = getIncludedBalance(state, now)
    const prepaid = Number(state.prepaidBalanceMicros ?? 0)
    const monthlySpendLimitMicros = Number(state.monthlySpendLimitMicros ?? 0)
    if (monthlySpendLimitMicros > 0) {
      const spent = getMonthlySpendUsage(state, allowanceWindow.start)
      if (spent >= monthlySpendLimitMicros) {
        throw new MonthlyLimitError('You have reached your monthly spending limit.')
      }
    }

    if (included + prepaid > 0) return

    throw new CreditsError('You have run out of usage balance. Upgrade or add more balance.')
  }

  async function trackUsage(
    authInfo: AuthInfo | undefined,
    modelInfo: ModelInfo,
    providerInfo: ProviderSelection,
    usageInfo: UsageInfo,
  ) {
    const billing = resolveBillingContext(authInfo)
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
    const baseCostInCent =
      inputCost +
      outputCost +
      (reasoningCost ?? 0) +
      (cacheReadCost ?? 0) +
      (cacheWrite5mCost ?? 0) +
      (cacheWrite1hCost ?? 0)
    const totalCostInCent =
      billing.mode === 'surgent' ? baseCostInCent * SURGENT_MARKUP_MULTIPLIER : baseCostInCent

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
      'cost.base_total': Math.round(baseCostInCent),
      'cost.total': Math.round(totalCostInCent),
    })

    if (!authInfo) return

    const costMicro = authInfo.provider?.credentials ? 0 : centsToMicroCents(totalCostInCent)
    const costBig = BigInt(costMicro)
    let uncoveredMicros = 0

    await db.transaction().execute(async (tx) => {
      const usageId = crypto.randomUUID()
      const now = new Date()
      let includedDebit = 0
      let prepaidDebit = 0

      if (costMicro > 0) {
        const state = await tx
          .selectFrom('billing_account as account')
          .innerJoin(
            'billing_subscription as subscription',
            'subscription.organizationId',
            'account.organizationId',
          )
          .select([
            'account.prepaidBalanceMicros',
            'account.monthlySpendUsageMicros',
            'account.monthlySpendUsagePeriodStart',
            'subscription.tier',
            'subscription.interval',
            'subscription.status',
            'subscription.monthlyAllowanceMicros',
            'subscription.currentPeriodStart',
            'subscription.currentPeriodEnd',
            'subscription.includedUsageMicros',
            'subscription.includedUsagePeriodStart',
          ])
          .where('account.organizationId', '=', authInfo.organizationId)
          .forUpdate()
          .executeTakeFirst()

        if (!state) {
          throw new CreditsError('Billing state is not ready yet. Please try again.')
        }

        const included = getIncludedBalance(state, now)
        const allowanceWindow = getAllowanceWindow(
          {
            tier: state.tier,
            interval: state.interval,
            currentPeriodStart: state.currentPeriodStart,
            currentPeriodEnd: state.currentPeriodEnd,
          },
          now,
        )
        const debits = getUsageDebits(
          costMicro,
          included,
          Math.max(Number(state.prepaidBalanceMicros ?? 0), 0),
        )
        includedDebit = debits.includedDebit
        prepaidDebit = debits.prepaidDebit
        uncoveredMicros = debits.uncoveredMicros

        if (includedDebit > 0) {
          const includedUsageMicros = sameAllowanceWindowStart(
            state.includedUsagePeriodStart,
            allowanceWindow.start,
          )
            ? Number(state.includedUsageMicros ?? 0) + includedDebit
            : includedDebit

          await tx
            .updateTable('billing_subscription')
            .set({
              includedUsageMicros: String(includedUsageMicros),
              includedUsagePeriodStart: allowanceWindow.start,
              updatedAt: now,
            })
            .where('organizationId', '=', authInfo.organizationId)
            .execute()
        }

        const coveredMicros = includedDebit + prepaidDebit
        if (coveredMicros > 0) {
          const monthlySpendUsageMicros = sameAllowanceWindowStart(
            state.monthlySpendUsagePeriodStart,
            allowanceWindow.start,
          )
            ? Number(state.monthlySpendUsageMicros ?? 0) + coveredMicros
            : coveredMicros

          await tx
            .updateTable('billing_account')
            .set({
              monthlySpendUsageMicros: String(monthlySpendUsageMicros),
              monthlySpendUsagePeriodStart: allowanceWindow.start,
              updatedAt: now,
            })
            .where('organizationId', '=', authInfo.organizationId)
            .execute()
        }
      }

      await tx
        .insertInto('usage')
        .values({
          id: usageId,
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
          enrichment: {
            billing,
          },
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

      if (includedDebit > 0) {
        logger.metric({
          billing_settlement_bucket: 'included',
          billing_settlement_included_micros: includedDebit,
        })
      }

      if (prepaidDebit > 0) {
        await tx
          .updateTable('billing_account')
          .set({
            prepaidBalanceMicros: sql`GREATEST(0, "prepaidBalanceMicros" - ${String(prepaidDebit)})`,
            updatedAt: now,
          })
          .where('organizationId', '=', authInfo.organizationId)
          .execute()
      }
    })

    if (uncoveredMicros > 0) {
      logger.log(
        {
          organizationId: authInfo.organizationId,
          projectId: authInfo.projectId,
          costMicros: costMicro,
          uncoveredMicros,
        },
        'usage settled after response with insufficient balance',
      )
      logger.metric({
        billing_settlement: 'uncovered',
        billing_cost_micros: costMicro,
        billing_uncovered_micros: uncoveredMicros,
      })
    }

    return {
      costMicros: Number(costBig),
      uncoveredMicros,
    } satisfies UsageSettlement
  }
}
