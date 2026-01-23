-- Create status and interval enums (must be before transaction_type)
CREATE TYPE checkout_status AS ENUM ('open', 'complete', 'expired');
CREATE TYPE checkout_mode AS ENUM ('payment', 'subscription', 'setup');
CREATE TYPE subscription_status AS ENUM ('active', 'past_due', 'canceled', 'unpaid', 'trialing', 'incomplete', 'incomplete_expired');
CREATE TYPE payout_status AS ENUM ('paid', 'pending', 'in_transit', 'canceled', 'failed');
CREATE TYPE recurring_interval AS ENUM ('day', 'week', 'month', 'year');

-- Create transaction_type enum
CREATE TYPE transaction_type AS ENUM ('payment', 'processor_fee', 'refund', 'dispute', 'balance', 'payout');

-- Payment status enum (mirrors Stripe PaymentIntent states)
-- NOTE: Stripe has no 'failed' status. On failure, it returns to 'requires_payment_method'.
CREATE TYPE payment_status AS ENUM (
  'requires_payment_method',
  'requires_confirmation',
  'requires_action',
  'processing',
  'requires_capture',
  'canceled',
  'succeeded'
);

-- Dispute status enum
CREATE TYPE dispute_status AS ENUM (
  'warning_needs_response',
  'warning_under_review',
  'warning_closed',
  'needs_response',
  'under_review',
  'won',
  'lost'
);

-- Refund status enum
CREATE TYPE refund_status AS ENUM (
  'pending',
  'requires_action',
  'succeeded',
  'failed',
  'canceled'
);

CREATE TABLE IF NOT EXISTS organization (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  "createdBy" TEXT,
  "apiKey" TEXT UNIQUE,
  "apiKeyPrefix" VARCHAR(8) UNIQUE,
  "platformFeePercent" INTEGER,
  "platformFeeFixed" INTEGER,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project (
  id UUID PRIMARY KEY,
  "organizationId" UUID REFERENCES organization(id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  "externalId" UUID,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS api_key (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  "apiKey" TEXT UNIQUE,
  "apiKeyPrefix" VARCHAR(8) UNIQUE,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS connect_account (
  id UUID PRIMARY KEY,
  "organizationId" UUID REFERENCES organization(id),
  country VARCHAR(2) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  "isPayoutsEnabled" BOOLEAN NOT NULL,
  processor TEXT NOT NULL DEFAULT 'stripe',
  "processorAccountId" TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  "detailsSubmitted" BOOLEAN NOT NULL DEFAULT FALSE,
  "chargesEnabled" BOOLEAN NOT NULL DEFAULT FALSE,
  "businessType" TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product (
  id UUID PRIMARY KEY,
  "productGroupId" UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  "projectId" UUID REFERENCES project(id),
  slug TEXT NOT NULL,
  version INTEGER,
  "isArchived" BOOLEAN DEFAULT FALSE,
  "isDefault" BOOLEAN,
  processor TEXT NOT NULL DEFAULT 'stripe',
  "processorProductId" TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_price (
  id UUID PRIMARY KEY,
  "productId" UUID REFERENCES product(id),
  name TEXT,
  description TEXT,
  "priceAmount" INTEGER NOT NULL,
  "priceCurrency" VARCHAR(3) NOT NULL,
  "recurringInterval" recurring_interval,
  "isDefault" BOOLEAN,
  processor TEXT NOT NULL DEFAULT 'stripe',
  "processorPriceId" TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- customer table (payment_method FK added after payment_method table is created)
CREATE TABLE IF NOT EXISTS customer (
  id UUID PRIMARY KEY,
  "projectId" UUID REFERENCES project(id),
  email VARCHAR(320) NOT NULL,
  name TEXT,
  processor TEXT NOT NULL DEFAULT 'stripe',
  "processorCustomerId" TEXT,
  CONSTRAINT customer_project_id_email_key UNIQUE ("projectId", email),
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS checkout_session (
  id UUID PRIMARY KEY,
  processor TEXT NOT NULL DEFAULT 'stripe',
  "processorCheckoutId" TEXT NOT NULL,
  "organizationId" UUID NOT NULL REFERENCES organization(id),
  "projectId" UUID NOT NULL REFERENCES project(id),
  "productId" UUID NOT NULL REFERENCES product(id),
  "priceId" UUID NOT NULL REFERENCES product_price(id),
  status checkout_status NOT NULL DEFAULT 'open',
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "customerId" UUID REFERENCES customer(id),
  "customerEmail" VARCHAR(320),
  "processorCustomerId" TEXT,
  "processorPaymentId" TEXT,
  "processorSubscriptionId" TEXT,
  "successUrl" TEXT,
  "cancelUrl" TEXT,
  mode checkout_mode,
  "completedAt" TIMESTAMPTZ,
  CONSTRAINT checkout_session_processor_checkout_id_key UNIQUE (processor, "processorCheckoutId")
);

-- Payment method table (reusable cards, bank accounts)
CREATE TABLE IF NOT EXISTS payment_method (
  id UUID PRIMARY KEY,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deletedAt" TIMESTAMPTZ,
  processor TEXT NOT NULL DEFAULT 'stripe',
  "processorId" TEXT NOT NULL,
  type TEXT NOT NULL,
  "methodMetadata" JSONB NOT NULL DEFAULT '{}',
  "customerId" UUID NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
  CONSTRAINT payment_method_processor_customer_key UNIQUE (processor, "processorId", "customerId")
);

-- subscription table (payment_method_id included)
CREATE TABLE IF NOT EXISTS subscription (
  id UUID PRIMARY KEY,
  "projectId" UUID REFERENCES project(id),
  "productId" UUID REFERENCES product(id),
  "productPriceId" UUID REFERENCES product_price(id),
  "customerId" UUID REFERENCES customer(id),
  "createdAt" TIMESTAMPTZ NOT NULL,
  "deletedAt" TIMESTAMPTZ,
  "currentPeriodStart" TIMESTAMPTZ,
  "currentPeriodEnd" TIMESTAMPTZ,
  "canceledAt" TIMESTAMPTZ,
  "endedAt" TIMESTAMPTZ,
  status subscription_status NOT NULL,
  processor TEXT NOT NULL DEFAULT 'stripe',
  "processorSubscriptionId" TEXT,
  "processorCustomerId" TEXT,
  "cancelAtPeriodEnd" BOOLEAN DEFAULT FALSE,
  "paymentMethodBrand" VARCHAR(20),
  "paymentMethodLast4" VARCHAR(4),
  "paymentMethodId" UUID REFERENCES payment_method(id) ON DELETE SET NULL,
  CONSTRAINT subscription_processor_subscription_id_key UNIQUE (processor, "processorSubscriptionId")
);

-- Payment table (tracks Stripe PaymentIntent lifecycle for SCA/3DS flows)
CREATE TABLE IF NOT EXISTS payment (
  id UUID PRIMARY KEY,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deletedAt" TIMESTAMPTZ,
  processor TEXT NOT NULL DEFAULT 'stripe',
  "processorId" TEXT NOT NULL,
  status payment_status NOT NULL,
  amount BIGINT NOT NULL,
  currency VARCHAR(3) NOT NULL,
  method TEXT NOT NULL,
  "methodMetadata" JSONB NOT NULL DEFAULT '{}',
  "customerId" UUID REFERENCES customer(id),
  "customerEmail" VARCHAR(320),
  "organizationId" UUID NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  "projectId" UUID REFERENCES project(id),
  "checkoutSessionId" UUID REFERENCES checkout_session(id) ON DELETE SET NULL,
  "paymentMethodId" UUID REFERENCES payment_method(id) ON DELETE SET NULL,
  "declineReason" TEXT,
  "declineMessage" TEXT,
  "riskLevel" TEXT,
  "riskScore" SMALLINT,
  "processorMetadata" JSONB NOT NULL DEFAULT '{}',
  "authorizedAt" TIMESTAMPTZ,
  "capturedAt" TIMESTAMPTZ,
  "canceledAt" TIMESTAMPTZ,
  CONSTRAINT payment_processor_id_key UNIQUE (processor, "processorId")
);

-- refund table (expanded with status, processor, payment_id, etc.)
CREATE TABLE IF NOT EXISTS refund (
  id UUID PRIMARY KEY,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "deletedAt" TIMESTAMPTZ,
  amount BIGINT NOT NULL,
  currency VARCHAR(3) NOT NULL,
  reason TEXT,
  status refund_status NOT NULL DEFAULT 'succeeded',
  processor TEXT NOT NULL DEFAULT 'stripe',
  "processorId" TEXT,
  "paymentId" UUID REFERENCES payment(id),
  "organizationId" UUID REFERENCES organization(id),
  "customerId" UUID REFERENCES customer(id)
);

CREATE TABLE IF NOT EXISTS payout (
  id UUID PRIMARY KEY,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "accountId" UUID REFERENCES connect_account(id),
  amount BIGINT NOT NULL,
  currency VARCHAR(3) NOT NULL,
  status payout_status NOT NULL,
  processor TEXT NOT NULL DEFAULT 'stripe',
  "processorPayoutId" TEXT,
  "paidAt" TIMESTAMPTZ
);

-- transaction table (payment_id included)
CREATE TABLE IF NOT EXISTS transaction (
  id UUID PRIMARY KEY,
  "createdAt" TIMESTAMPTZ NOT NULL,
  type transaction_type NOT NULL,
  amount BIGINT NOT NULL,
  currency VARCHAR(3) NOT NULL,
  "taxAmount" BIGINT DEFAULT 0,
  "accountId" UUID REFERENCES connect_account(id),
  "accountAmount" BIGINT,
  "accountCurrency" VARCHAR(3),
  "presentmentAmount" BIGINT,
  "presentmentCurrency" VARCHAR(3),
  "presentmentTaxAmount" BIGINT,
  "taxFilingAmount" BIGINT,
  "taxFilingCurrency" VARCHAR(3),
  "taxCountry" VARCHAR(2),
  "taxState" VARCHAR(2),
  processor TEXT NOT NULL,
  "chargeId" TEXT,
  "transferId" TEXT,
  "refundId" UUID REFERENCES refund(id),
  "payoutId" UUID REFERENCES payout(id),
  "paymentTransactionId" UUID REFERENCES transaction(id),
  "incurredByTransactionId" UUID REFERENCES transaction(id),
  "payoutTransactionId" UUID REFERENCES transaction(id),
  "projectId" UUID REFERENCES project(id),
  "customerId" UUID REFERENCES customer(id),
  "productId" UUID REFERENCES product(id),
  "productPriceId" UUID REFERENCES product_price(id),
  "subscriptionId" UUID REFERENCES subscription(id),
  "checkoutSessionId" UUID REFERENCES checkout_session(id),
  "processorInvoiceId" TEXT,
  "paymentMethodBrand" VARCHAR(20),
  "paymentMethodLast4" VARCHAR(4),
  metadata JSONB DEFAULT '{}',
  "succeededAt" TIMESTAMPTZ,
  "refundedAt" TIMESTAMPTZ,
  "paymentId" UUID REFERENCES payment(id)
);

CREATE TABLE IF NOT EXISTS transfer (
  id UUID PRIMARY KEY,
  processor TEXT NOT NULL,
  "processorTransferId" TEXT NOT NULL,
  amount BIGINT NOT NULL,
  currency VARCHAR(3) NOT NULL,
  "destinationAccountId" UUID NOT NULL REFERENCES connect_account(id),
  "sourceTransactionId" UUID REFERENCES transaction(id),
  "reversalId" TEXT,
  "reversedAt" TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT transfer_processor_transfer_id_key UNIQUE (processor, "processorTransferId")
);

CREATE TABLE IF NOT EXISTS held_balance (
  id UUID PRIMARY KEY,
  "organizationId" UUID NOT NULL REFERENCES organization(id),
  "connectedAccountId" UUID REFERENCES connect_account(id),
  "sourceTransactionId" UUID REFERENCES transaction(id),
  amount BIGINT NOT NULL,
  currency VARCHAR(3) NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- processed_webhook_event table (expanded with api_version, data, task_name, etc.)
CREATE TABLE IF NOT EXISTS processed_webhook_event (
  processor TEXT NOT NULL DEFAULT 'stripe',
  "processorEventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "processedAt" TIMESTAMPTZ DEFAULT NOW(),
  "apiVersion" TEXT,
  data JSONB,
  "taskName" TEXT,
  "handledAt" TIMESTAMPTZ,
  "requestId" TEXT,
  PRIMARY KEY (processor, "processorEventId")
);

-- Dispute table (chargebacks)
CREATE TABLE IF NOT EXISTS dispute (
  id UUID PRIMARY KEY,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deletedAt" TIMESTAMPTZ,
  status dispute_status NOT NULL,
  amount BIGINT NOT NULL,
  currency VARCHAR(3) NOT NULL,
  processor TEXT NOT NULL DEFAULT 'stripe',
  "processorId" TEXT,
  reason TEXT,
  "reasonMessage" TEXT,
  "paymentId" UUID NOT NULL REFERENCES payment(id),
  "organizationId" UUID NOT NULL REFERENCES organization(id),
  "customerId" UUID REFERENCES customer(id),
  "evidenceDueBy" TIMESTAMPTZ,
  "evidenceSubmittedAt" TIMESTAMPTZ,
  "resolvedAt" TIMESTAMPTZ,
  CONSTRAINT dispute_processor_id_key UNIQUE (processor, "processorId")
);

-- Add default_payment_method_id FK to customer (after payment_method table exists)
ALTER TABLE customer
  ADD COLUMN "defaultPaymentMethodId" UUID REFERENCES payment_method(id) ON DELETE SET NULL;

-- Indexes from base migration
CREATE INDEX IF NOT EXISTS idx_product_project_id ON product("projectId");
CREATE INDEX IF NOT EXISTS idx_project_organization_id ON project("organizationId");

CREATE INDEX IF NOT EXISTS idx_checkout_session_processor_checkout_id ON checkout_session("processorCheckoutId");
CREATE INDEX IF NOT EXISTS idx_checkout_session_org_id ON checkout_session("organizationId");

CREATE INDEX IF NOT EXISTS idx_transaction_project_id ON transaction("projectId");
CREATE INDEX IF NOT EXISTS idx_transaction_customer_id ON transaction("customerId");
CREATE INDEX IF NOT EXISTS idx_transaction_charge_id ON transaction("chargeId");

CREATE INDEX IF NOT EXISTS idx_subscription_processor_subscription_id ON subscription("processorSubscriptionId");

CREATE INDEX IF NOT EXISTS idx_processed_webhook_event_type ON processed_webhook_event("eventType");

CREATE UNIQUE INDEX IF NOT EXISTS account_org_processor_key ON connect_account("organizationId", processor);
CREATE UNIQUE INDEX IF NOT EXISTS account_processor_account_id_key ON connect_account(processor, "processorAccountId") WHERE "processorAccountId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_connected_account_org ON connect_account("organizationId");

CREATE INDEX IF NOT EXISTS idx_transfer_destination ON transfer("destinationAccountId");

CREATE UNIQUE INDEX IF NOT EXISTS payout_processor_payout_id_key ON payout(processor, "processorPayoutId") WHERE "processorPayoutId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_connect_payout_account ON payout("accountId");

CREATE INDEX IF NOT EXISTS idx_held_balance_org ON held_balance("organizationId");
CREATE INDEX IF NOT EXISTS idx_held_balance_connected_account ON held_balance("connectedAccountId");

-- Expression index for OAuth callback performance
CREATE INDEX IF NOT EXISTS idx_account_connect_state ON connect_account ((data->>'connect_state')) WHERE data->>'connect_state' IS NOT NULL;

-- Indexes from payment_tables migration
CREATE INDEX IF NOT EXISTS ix_payment_method_customer_id ON payment_method("customerId");

CREATE INDEX IF NOT EXISTS ix_payment_status ON payment(status);
CREATE INDEX IF NOT EXISTS ix_payment_customer_id ON payment("customerId");
CREATE INDEX IF NOT EXISTS ix_payment_organization_id ON payment("organizationId");

CREATE INDEX IF NOT EXISTS ix_dispute_status ON dispute(status);
CREATE INDEX IF NOT EXISTS ix_dispute_payment_id ON dispute("paymentId");
CREATE INDEX IF NOT EXISTS ix_dispute_organization_id ON dispute("organizationId");

CREATE INDEX IF NOT EXISTS ix_refund_status ON refund(status);
CREATE INDEX IF NOT EXISTS ix_refund_payment_id ON refund("paymentId");
CREATE UNIQUE INDEX IF NOT EXISTS ix_refund_processor_id ON refund("processorId") WHERE "processorId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_processed_webhook_event_handled_at ON processed_webhook_event("handledAt");
CREATE INDEX IF NOT EXISTS ix_processed_webhook_event_unprocessed ON processed_webhook_event("processedAt") WHERE "handledAt" IS NULL;

