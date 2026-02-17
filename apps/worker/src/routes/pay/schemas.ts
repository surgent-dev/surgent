import { z } from 'zod'

const uuid = z.string().uuid()

export const projectPathSchema = z.object({ projectId: uuid })
export const checkoutPathSchema = z.object({ id: uuid })
export const accountPathSchema = z.object({ id: uuid })
export const productPathSchema = z.object({ id: uuid })

export const checkoutProcessorPathSchema = z.object({
  sessionId: z.string().trim().min(1),
})

export const customerPathSchema = z.object({
  id: z.string().trim().min(1),
})

export const webhookProcessorPathSchema = z.object({
  processor: z.string().trim().min(1).max(50),
  env: z.enum(['test', 'live']),
})

export const projectQuerySchema = z.object({
  projectId: uuid.optional(),
})

export const projectListQuerySchema = z.object({
  projectId: uuid.optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})

export const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
})

export const accountListQuerySchema = z.object({
  projectId: uuid.optional(),
  processor: z.string().trim().optional(),
})

export const connectBodySchema = z.object({
  projectId: uuid.optional(),
  companyName: z.string().trim().min(1).max(120).optional(),
  title: z.string().trim().min(1).max(120).optional(),
  email: z.string().email().optional(),
  country: z.string().trim().min(2).max(2).optional(),
  businessType: z.string().trim().min(1).max(120).optional(),
})

export const connectWhopQuerySchema = z.object({
  projectId: uuid.optional(),
  accountId: uuid.optional(),
})

export const checkoutBodySchema = z
  .object({
    projectId: uuid,
    accountId: uuid.optional(),
    priceId: uuid.optional(),
    title: z.string().trim().min(1).max(120).optional(),
    amount: z.number().int().positive().optional(),
    currency: z.string().trim().length(3).default('usd'),
    planType: z.enum(['one_time', 'renewal']).default('one_time'),
    billingPeriod: z.number().int().positive().optional(),
    applicationFeeAmount: z.number().int().nonnegative().optional(),
    redirectUrl: z.string().url().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    productId: z.string().optional(),
    customerId: z.string().trim().min(1).optional(),
    idempotencyKey: z.string().trim().min(1).max(255).optional(),
  })
  .refine(
    (v) => {
      if (v.priceId) return !(v.title || v.amount)
      return Boolean(v.title && v.amount)
    },
    { message: 'Provide either priceId or (title + amount), not both' },
  )

export const createProductBodySchema = z.object({
  productGroup: z.string().trim().min(1).max(200),
  name: z.string().trim().min(1).max(200),
  slug: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  isDefault: z.boolean().optional(),
})

export const updateProductBodySchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  slug: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  isDefault: z.boolean().optional(),
  isArchived: z.boolean().optional(),
})

export const createPriceBodySchema = z.object({
  productGroup: z.string().trim().min(1).max(200),
  price: z.number().int().positive(),
  priceCurrency: z.string().trim().length(3),
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).optional(),
  recurringInterval: z.enum(['week', 'month', 'year']).optional(),
  isDefault: z.boolean().optional(),
  slug: z.string().trim().min(1).max(200).optional(),
})

export const checkBodySchema = z.object({
  customerId: z.string().trim().min(1),
  productId: z.string().trim().min(1),
})

export const accountQuerySchema = z
  .object({
    projectId: uuid.optional(),
    accountId: uuid.optional(),
    account_id: uuid.optional(),
  })
  .refine((v) => Boolean(v.projectId || v.accountId || v.account_id), {
    message: 'projectId or accountId is required',
  })

export const payoutsLinkQuerySchema = z
  .object({
    projectId: uuid.optional(),
    accountId: uuid.optional(),
    account_id: uuid.optional(),
    returnUrl: z.string().url().optional(),
    refreshUrl: z.string().url().optional(),
    redirectBaseUrl: z.string().url().optional(),
  })
  .refine((v) => Boolean(v.projectId || v.accountId || v.account_id), {
    message: 'projectId or accountId is required',
  })

export const subscriptionPathSchema = z.object({ id: z.string().uuid() })

export const userAccountsQuerySchema = z.object({
  processor: z.string().trim().optional(),
})
