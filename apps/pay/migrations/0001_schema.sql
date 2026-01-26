-- Test schema for surpay
-- This is a simplified schema for running tests

-- Create enums
CREATE TYPE checkout_status AS ENUM ('open', 'complete', 'expired');
CREATE TYPE checkout_mode AS ENUM ('payment', 'subscription', 'setup');
CREATE TYPE subscription_status AS ENUM ('active', 'past_due', 'canceled', 'unpaid', 'trialing', 'incomplete', 'incomplete_expired');
CREATE TYPE payout_status AS ENUM ('paid', 'pending', 'in_transit', 'canceled', 'failed');
CREATE TYPE recurring_interval AS ENUM ('day', 'week', 'month', 'year');
CREATE TYPE transaction_type AS ENUM ('payment', 'processor_fee', 'refund', 'dispute', 'balance', 'payout');
CREATE TYPE payment_status AS ENUM ('requires_payment_method', 'requires_confirmation', 'requires_action', 'processing', 'requires_capture', 'canceled', 'succeeded');
CREATE TYPE dispute_status AS ENUM ('warning_needs_response', 'warning_under_review', 'warning_closed', 'needs_response', 'under_review', 'won', 'lost');
CREATE TYPE refund_status AS ENUM ('pending', 'requires_action', 'succeeded', 'failed', 'canceled');
CREATE TYPE feature_type AS ENUM ('metered', 'boolean');
CREATE TYPE meter_type AS ENUM ('consumable', 'non_consumable');
CREATE TYPE invoice_status AS ENUM ('draft', 'open', 'paid', 'void', 'uncollectible');

-- Base tables (from packages/db migrations)
CREATE TABLE "user" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    image TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE organization (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    logo TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    metadata TEXT,
    "createdBy" TEXT,
    "platformFeePercent" INTEGER,
    "platformFeeFixed" INTEGER
);

CREATE TABLE project (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    "organizationId" UUID NOT NULL REFERENCES organization(id),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    slug TEXT NOT NULL UNIQUE,
    "externalId" UUID
);

CREATE TABLE apikey (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT,
    key TEXT NOT NULL,
    prefix TEXT,
    "userId" UUID NOT NULL REFERENCES "user"(id),
    "organizationId" UUID REFERENCES organization(id),
    "projectId" UUID REFERENCES project(id),
    enabled BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Surpay tables (project-scoped)
CREATE TABLE connect_account (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "projectId" UUID NOT NULL REFERENCES project(id),
    country VARCHAR(2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    "isPayoutsEnabled" BOOLEAN NOT NULL,
    processor TEXT NOT NULL DEFAULT 'stripe',
    "processorAccountId" TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    "detailsSubmitted" BOOLEAN NOT NULL DEFAULT false,
    "chargesEnabled" BOOLEAN NOT NULL DEFAULT false,
    "businessType" TEXT,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE product (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "productGroupId" UUID NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    "projectId" UUID NOT NULL REFERENCES project(id),
    slug TEXT NOT NULL,
    version INTEGER,
    "isArchived" BOOLEAN DEFAULT false,
    "isDefault" BOOLEAN,
    processor TEXT NOT NULL DEFAULT 'stripe',
    "processorProductId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "isAddOn" BOOLEAN DEFAULT false,
    "planGroup" TEXT,
    env TEXT DEFAULT 'live'
);

CREATE TABLE product_price (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "productId" UUID NOT NULL REFERENCES product(id),
    name TEXT,
    description TEXT,
    "priceAmount" INTEGER NOT NULL,
    "priceCurrency" VARCHAR(3) NOT NULL,
    "recurringInterval" recurring_interval,
    "isDefault" BOOLEAN,
    processor TEXT NOT NULL DEFAULT 'stripe',
    "processorPriceId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE customer (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "projectId" UUID NOT NULL REFERENCES project(id),
    email VARCHAR(320) NOT NULL,
    name TEXT,
    processor TEXT NOT NULL DEFAULT 'stripe',
    "processorCustomerId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "defaultPaymentMethodId" UUID
);

CREATE TABLE checkout_session (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    processor TEXT NOT NULL DEFAULT 'stripe',
    "processorCheckoutId" TEXT NOT NULL,
    "projectId" UUID NOT NULL REFERENCES project(id),
    "productId" UUID NOT NULL REFERENCES product(id),
    "priceId" UUID NOT NULL REFERENCES product_price(id),
    status checkout_status NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "customerId" UUID REFERENCES customer(id),
    "customerEmail" VARCHAR(320),
    "processorCustomerId" TEXT,
    "processorPaymentId" TEXT,
    "processorSubscriptionId" TEXT,
    "successUrl" TEXT,
    "cancelUrl" TEXT,
    mode checkout_mode,
    "completedAt" TIMESTAMPTZ
);

CREATE TABLE payment_method (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "deletedAt" TIMESTAMPTZ,
    processor TEXT NOT NULL DEFAULT 'stripe',
    "processorId" TEXT NOT NULL,
    type TEXT NOT NULL,
    "methodMetadata" JSONB NOT NULL DEFAULT '{}',
    "customerId" UUID NOT NULL REFERENCES customer(id) ON DELETE CASCADE
);

-- Add FK for customer.defaultPaymentMethodId after payment_method exists
ALTER TABLE customer ADD CONSTRAINT customer_default_payment_method_fk 
    FOREIGN KEY ("defaultPaymentMethodId") REFERENCES payment_method(id) ON DELETE SET NULL;

CREATE TABLE subscription (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "projectId" UUID NOT NULL REFERENCES project(id),
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
    "cancelAtPeriodEnd" BOOLEAN DEFAULT false,
    "paymentMethodBrand" VARCHAR(20),
    "paymentMethodLast4" VARCHAR(4),
    "paymentMethodId" UUID REFERENCES payment_method(id) ON DELETE SET NULL
);

CREATE TABLE payment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
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
    "projectId" UUID NOT NULL REFERENCES project(id),
    "checkoutSessionId" UUID REFERENCES checkout_session(id) ON DELETE SET NULL,
    "paymentMethodId" UUID REFERENCES payment_method(id) ON DELETE SET NULL,
    "declineReason" TEXT,
    "declineMessage" TEXT,
    "riskLevel" TEXT,
    "riskScore" SMALLINT,
    "processorMetadata" JSONB NOT NULL DEFAULT '{}',
    "authorizedAt" TIMESTAMPTZ,
    "capturedAt" TIMESTAMPTZ,
    "canceledAt" TIMESTAMPTZ
);

CREATE TABLE refund (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "createdAt" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMPTZ,
    amount BIGINT NOT NULL,
    currency VARCHAR(3) NOT NULL,
    reason TEXT,
    status refund_status NOT NULL DEFAULT 'succeeded',
    processor TEXT NOT NULL DEFAULT 'stripe',
    "processorId" TEXT,
    "paymentId" UUID REFERENCES payment(id),
    "projectId" UUID NOT NULL REFERENCES project(id),
    "customerId" UUID REFERENCES customer(id)
);

CREATE TABLE payout (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "createdAt" TIMESTAMPTZ NOT NULL,
    "accountId" UUID REFERENCES connect_account(id),
    amount BIGINT NOT NULL,
    currency VARCHAR(3) NOT NULL,
    status payout_status NOT NULL,
    processor TEXT NOT NULL DEFAULT 'stripe',
    "processorPayoutId" TEXT,
    "paidAt" TIMESTAMPTZ
);

CREATE TABLE transaction (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    "projectId" UUID NOT NULL REFERENCES project(id),
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

CREATE TABLE transfer (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    processor TEXT NOT NULL,
    "processorTransferId" TEXT NOT NULL,
    amount BIGINT NOT NULL,
    currency VARCHAR(3) NOT NULL,
    "destinationAccountId" UUID NOT NULL REFERENCES connect_account(id),
    "sourceTransactionId" UUID REFERENCES transaction(id),
    "reversalId" TEXT,
    "reversedAt" TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE held_balance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "projectId" UUID NOT NULL REFERENCES project(id),
    "connectedAccountId" UUID REFERENCES connect_account(id),
    "sourceTransactionId" UUID REFERENCES transaction(id),
    amount BIGINT NOT NULL,
    currency VARCHAR(3) NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE processed_webhook_event (
    processor TEXT NOT NULL DEFAULT 'stripe',
    "processorEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "processedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "apiVersion" TEXT,
    data JSONB,
    "taskName" TEXT,
    "handledAt" TIMESTAMPTZ,
    "requestId" TEXT,
    PRIMARY KEY (processor, "processorEventId")
);

CREATE TABLE dispute (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "deletedAt" TIMESTAMPTZ,
    status dispute_status NOT NULL,
    amount BIGINT NOT NULL,
    currency VARCHAR(3) NOT NULL,
    processor TEXT NOT NULL DEFAULT 'stripe',
    "processorId" TEXT,
    reason TEXT,
    "reasonMessage" TEXT,
    "paymentId" UUID NOT NULL REFERENCES payment(id),
    "projectId" UUID NOT NULL REFERENCES project(id),
    "customerId" UUID REFERENCES customer(id),
    "evidenceDueBy" TIMESTAMPTZ,
    "evidenceSubmittedAt" TIMESTAMPTZ,
    "resolvedAt" TIMESTAMPTZ
);

CREATE TABLE feature (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "projectId" UUID NOT NULL REFERENCES project(id),
    name TEXT NOT NULL,
    type feature_type NOT NULL,
    "meterType" meter_type,
    "isCreditSystem" BOOLEAN DEFAULT false,
    "creditSchema" JSONB,
    config JSONB DEFAULT '{}',
    display JSONB,
    "eventNames" TEXT[] DEFAULT '{}',
    "isArchived" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE entitlement (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "productId" UUID REFERENCES product(id) ON DELETE CASCADE,
    "featureId" UUID NOT NULL REFERENCES feature(id) ON DELETE CASCADE,
    "allowanceType" TEXT,
    allowance BIGINT,
    "interval" TEXT,
    "intervalCount" INTEGER DEFAULT 1,
    "carryFromPrevious" BOOLEAN DEFAULT false,
    rollover JSONB,
    "usageLimit" BIGINT,
    "isCustom" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE customer_product (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "customerId" UUID NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
    "productId" UUID NOT NULL REFERENCES product(id),
    "subscriptionId" UUID REFERENCES subscription(id),
    status TEXT,
    processor JSONB,
    canceled BOOLEAN DEFAULT false,
    "canceledAt" TIMESTAMPTZ,
    "endedAt" TIMESTAMPTZ,
    "startsAt" TIMESTAMPTZ,
    "trialEndsAt" TIMESTAMPTZ,
    "collectionMethod" TEXT DEFAULT 'charge_automatically',
    quantity INTEGER DEFAULT 1,
    "isCustom" BOOLEAN DEFAULT false,
    options JSONB DEFAULT '[]',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE customer_entitlement (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "customerProductId" UUID NOT NULL REFERENCES customer_product(id) ON DELETE CASCADE,
    "entitlementId" UUID NOT NULL REFERENCES entitlement(id) ON DELETE CASCADE,
    "customerId" UUID NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
    "featureId" UUID NOT NULL REFERENCES feature(id) ON DELETE CASCADE,
    unlimited BOOLEAN DEFAULT false,
    balance BIGINT DEFAULT 0,
    "usageAllowed" BOOLEAN DEFAULT false,
    "nextResetAt" TIMESTAMPTZ,
    "additionalBalance" BIGINT DEFAULT 0,
    "expiresAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE invoice (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "customerId" UUID NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
    "subscriptionId" UUID REFERENCES subscription(id),
    "productIds" TEXT[] DEFAULT '{}',
    "stripeId" TEXT,
    status invoice_status DEFAULT 'draft',
    "hostedInvoiceUrl" TEXT,
    total BIGINT DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'usd',
    discounts JSONB DEFAULT '[]',
    items JSONB DEFAULT '[]',
    "periodStart" TIMESTAMPTZ,
    "periodEnd" TIMESTAMPTZ,
    "dueDate" TIMESTAMPTZ,
    "paidAt" TIMESTAMPTZ,
    "voidedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_product_project_id ON product("projectId");
CREATE INDEX idx_project_organization_id ON project("organizationId");
CREATE INDEX idx_checkout_session_processor_checkout_id ON checkout_session("processorCheckoutId");
CREATE INDEX idx_checkout_session_project_id ON checkout_session("projectId");
CREATE INDEX idx_transaction_project_id ON transaction("projectId");
CREATE INDEX idx_transaction_customer_id ON transaction("customerId");
CREATE INDEX idx_transaction_charge_id ON transaction("chargeId");
CREATE INDEX idx_subscription_processor_subscription_id ON subscription("processorSubscriptionId");
CREATE INDEX idx_subscription_project_id ON subscription("projectId");
CREATE INDEX idx_processed_webhook_event_type ON processed_webhook_event("eventType");
CREATE INDEX idx_connect_account_project ON connect_account("projectId");
CREATE INDEX idx_transfer_destination ON transfer("destinationAccountId");
CREATE INDEX idx_connect_payout_account ON payout("accountId");
CREATE INDEX idx_held_balance_project ON held_balance("projectId");
CREATE INDEX idx_held_balance_connected_account ON held_balance("connectedAccountId");
CREATE INDEX ix_payment_method_customer_id ON payment_method("customerId");
CREATE INDEX ix_payment_status ON payment(status);
CREATE INDEX ix_payment_customer_id ON payment("customerId");
CREATE INDEX ix_payment_project_id ON payment("projectId");
CREATE INDEX ix_dispute_status ON dispute(status);
CREATE INDEX ix_dispute_payment_id ON dispute("paymentId");
CREATE INDEX ix_dispute_project_id ON dispute("projectId");
CREATE INDEX ix_refund_status ON refund(status);
CREATE INDEX ix_refund_payment_id ON refund("paymentId");
CREATE INDEX ix_refund_project_id ON refund("projectId");
CREATE INDEX ix_processed_webhook_event_handled_at ON processed_webhook_event("handledAt");
CREATE INDEX idx_feature_project_id ON feature("projectId");
CREATE INDEX idx_entitlement_product_id ON entitlement("productId");
CREATE INDEX idx_entitlement_feature_id ON entitlement("featureId");
CREATE INDEX idx_customer_product_customer_id ON customer_product("customerId");
CREATE INDEX idx_customer_product_product_id ON customer_product("productId");
CREATE INDEX idx_customer_entitlement_customer_product_id ON customer_entitlement("customerProductId");
CREATE INDEX idx_customer_entitlement_customer_id ON customer_entitlement("customerId");
CREATE INDEX idx_customer_entitlement_feature_id ON customer_entitlement("featureId");
CREATE INDEX idx_invoice_customer_id ON invoice("customerId");
CREATE INDEX idx_invoice_subscription_id ON invoice("subscriptionId");
CREATE INDEX idx_invoice_status ON invoice(status);

-- Unique constraints
ALTER TABLE customer ADD CONSTRAINT customer_project_id_email_key UNIQUE ("projectId", email);
ALTER TABLE checkout_session ADD CONSTRAINT checkout_session_processor_checkout_id_key UNIQUE (processor, "processorCheckoutId");
ALTER TABLE payment_method ADD CONSTRAINT payment_method_processor_customer_key UNIQUE (processor, "processorId", "customerId");
ALTER TABLE subscription ADD CONSTRAINT subscription_processor_subscription_id_key UNIQUE (processor, "processorSubscriptionId");
ALTER TABLE payment ADD CONSTRAINT payment_processor_id_key UNIQUE (processor, "processorId");
ALTER TABLE transfer ADD CONSTRAINT transfer_processor_transfer_id_key UNIQUE (processor, "processorTransferId");
ALTER TABLE dispute ADD CONSTRAINT dispute_processor_id_key UNIQUE (processor, "processorId");
ALTER TABLE connect_account ADD CONSTRAINT account_project_processor_key UNIQUE ("projectId", processor);
ALTER TABLE feature ADD CONSTRAINT feature_project_id_name_key UNIQUE ("projectId", name);
ALTER TABLE entitlement ADD CONSTRAINT entitlement_product_id_feature_id_key UNIQUE ("productId", "featureId");
ALTER TABLE customer_entitlement ADD CONSTRAINT customer_entitlement_customer_id_feature_id_key UNIQUE ("customerId", "featureId");

-- Partial unique indexes
CREATE UNIQUE INDEX ix_connect_account_processor_account_id ON connect_account (processor, "processorAccountId") WHERE "processorAccountId" IS NOT NULL;
CREATE UNIQUE INDEX ix_payout_processor_payout_id ON payout (processor, "processorPayoutId") WHERE "processorPayoutId" IS NOT NULL;
CREATE UNIQUE INDEX ix_refund_processor_id ON refund("processorId") WHERE "processorId" IS NOT NULL;

-- Expression indexes
CREATE INDEX idx_account_connect_state ON connect_account ((data->>'connect_state')) WHERE data->>'connect_state' IS NOT NULL;
CREATE INDEX ix_processed_webhook_event_unprocessed ON processed_webhook_event("processedAt") WHERE "handledAt" IS NULL;
