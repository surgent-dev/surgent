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
  created_by TEXT,
  api_key TEXT UNIQUE,
  api_key_prefix VARCHAR(8) UNIQUE,
  platform_fee_percent INTEGER,
  platform_fee_fixed INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organization(id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  external_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS api_key (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  api_key TEXT UNIQUE,
  api_key_prefix VARCHAR(8) UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS account (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organization(id),
  country VARCHAR(2) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  is_payouts_enabled BOOLEAN NOT NULL,
  processor TEXT NOT NULL DEFAULT 'stripe',
  processor_account_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  details_submitted BOOLEAN NOT NULL DEFAULT FALSE,
  charges_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  business_type TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product (
  id UUID PRIMARY KEY,
  product_group_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  project_id UUID REFERENCES project(id),
  slug TEXT NOT NULL,
  version INTEGER,
  is_archived BOOLEAN DEFAULT FALSE,
  is_default BOOLEAN,
  processor TEXT NOT NULL DEFAULT 'stripe',
  processor_product_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_price (
  id UUID PRIMARY KEY,
  product_id UUID REFERENCES product(id),
  name TEXT,
  description TEXT,
  price_amount INTEGER NOT NULL,
  price_currency VARCHAR(3) NOT NULL,
  recurring_interval recurring_interval,
  is_default BOOLEAN,
  processor TEXT NOT NULL DEFAULT 'stripe',
  processor_price_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- customer table (payment_method FK added after payment_method table is created)
CREATE TABLE IF NOT EXISTS customer (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES project(id),
  email VARCHAR(320) NOT NULL,
  name TEXT,
  processor TEXT NOT NULL DEFAULT 'stripe',
  processor_customer_id TEXT,
  CONSTRAINT customer_project_id_email_key UNIQUE (project_id, email),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS checkout_session (
  id UUID PRIMARY KEY,
  processor TEXT NOT NULL DEFAULT 'stripe',
  processor_checkout_id TEXT NOT NULL,
  organization_id UUID NOT NULL REFERENCES organization(id),
  project_id UUID NOT NULL REFERENCES project(id),
  product_id UUID NOT NULL REFERENCES product(id),
  price_id UUID NOT NULL REFERENCES product_price(id),
  status checkout_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  customer_id UUID REFERENCES customer(id),
  customer_email VARCHAR(320),
  processor_customer_id TEXT,
  processor_payment_id TEXT,
  processor_subscription_id TEXT,
  success_url TEXT,
  cancel_url TEXT,
  mode checkout_mode,
  completed_at TIMESTAMPTZ,
  CONSTRAINT checkout_session_processor_checkout_id_key UNIQUE (processor, processor_checkout_id)
);

-- Payment method table (reusable cards, bank accounts)
CREATE TABLE IF NOT EXISTS payment_method (
  id UUID PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  processor TEXT NOT NULL DEFAULT 'stripe',
  processor_id TEXT NOT NULL,
  type TEXT NOT NULL,
  method_metadata JSONB NOT NULL DEFAULT '{}',
  customer_id UUID NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
  CONSTRAINT payment_method_processor_customer_key UNIQUE (processor, processor_id, customer_id)
);

-- subscription table (payment_method_id included)
CREATE TABLE IF NOT EXISTS subscription (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES project(id),
  product_id UUID REFERENCES product(id),
  product_price_id UUID REFERENCES product_price(id),
  customer_id UUID REFERENCES customer(id),
  created_at TIMESTAMPTZ NOT NULL,
  deleted_at TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  status subscription_status NOT NULL,
  processor TEXT NOT NULL DEFAULT 'stripe',
  processor_subscription_id TEXT,
  processor_customer_id TEXT,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  payment_method_brand VARCHAR(20),
  payment_method_last4 VARCHAR(4),
  payment_method_id UUID REFERENCES payment_method(id) ON DELETE SET NULL,
  CONSTRAINT subscription_processor_subscription_id_key UNIQUE (processor, processor_subscription_id)
);

-- Payment table (tracks Stripe PaymentIntent lifecycle for SCA/3DS flows)
CREATE TABLE IF NOT EXISTS payment (
  id UUID PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  processor TEXT NOT NULL DEFAULT 'stripe',
  processor_id TEXT NOT NULL,
  status payment_status NOT NULL,
  amount BIGINT NOT NULL,
  currency VARCHAR(3) NOT NULL,
  method TEXT NOT NULL,
  method_metadata JSONB NOT NULL DEFAULT '{}',
  customer_id UUID REFERENCES customer(id),
  customer_email VARCHAR(320),
  organization_id UUID NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  project_id UUID REFERENCES project(id),
  checkout_session_id UUID REFERENCES checkout_session(id) ON DELETE SET NULL,
  payment_method_id UUID REFERENCES payment_method(id) ON DELETE SET NULL,
  decline_reason TEXT,
  decline_message TEXT,
  risk_level TEXT,
  risk_score SMALLINT,
  processor_metadata JSONB NOT NULL DEFAULT '{}',
  authorized_at TIMESTAMPTZ,
  captured_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  CONSTRAINT payment_processor_id_key UNIQUE (processor, processor_id)
);

-- refund table (expanded with status, processor, payment_id, etc.)
CREATE TABLE IF NOT EXISTS refund (
  id UUID PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL,
  deleted_at TIMESTAMPTZ,
  amount BIGINT NOT NULL,
  currency VARCHAR(3) NOT NULL,
  reason TEXT,
  status refund_status NOT NULL DEFAULT 'succeeded',
  processor TEXT NOT NULL DEFAULT 'stripe',
  processor_id TEXT,
  payment_id UUID REFERENCES payment(id),
  organization_id UUID REFERENCES organization(id),
  customer_id UUID REFERENCES customer(id)
);

CREATE TABLE IF NOT EXISTS payout (
  id UUID PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL,
  account_id UUID REFERENCES account(id),
  amount BIGINT NOT NULL,
  currency VARCHAR(3) NOT NULL,
  status payout_status NOT NULL,
  processor TEXT NOT NULL DEFAULT 'stripe',
  processor_payout_id TEXT,
  paid_at TIMESTAMPTZ
);

-- transaction table (payment_id included)
CREATE TABLE IF NOT EXISTS transaction (
  id UUID PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL,
  type transaction_type NOT NULL,
  amount BIGINT NOT NULL,
  currency VARCHAR(3) NOT NULL,
  tax_amount BIGINT DEFAULT 0,
  account_id UUID REFERENCES account(id),
  account_amount BIGINT,
  account_currency VARCHAR(3),
  presentment_amount BIGINT,
  presentment_currency VARCHAR(3),
  presentment_tax_amount BIGINT,
  tax_filing_amount BIGINT,
  tax_filing_currency VARCHAR(3),
  tax_country VARCHAR(2),
  tax_state VARCHAR(2),
  processor TEXT NOT NULL,
  charge_id TEXT,
  transfer_id TEXT,
  refund_id UUID REFERENCES refund(id),
  payout_id UUID REFERENCES payout(id),
  payment_transaction_id UUID REFERENCES transaction(id),
  incurred_by_transaction_id UUID REFERENCES transaction(id),
  payout_transaction_id UUID REFERENCES transaction(id),
  project_id UUID REFERENCES project(id),
  customer_id UUID REFERENCES customer(id),
  product_id UUID REFERENCES product(id),
  product_price_id UUID REFERENCES product_price(id),
  subscription_id UUID REFERENCES subscription(id),
  checkout_session_id UUID REFERENCES checkout_session(id),
  processor_invoice_id TEXT,
  payment_method_brand VARCHAR(20),
  payment_method_last4 VARCHAR(4),
  metadata JSONB DEFAULT '{}',
  succeeded_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  payment_id UUID REFERENCES payment(id)
);

CREATE TABLE IF NOT EXISTS transfer (
  id UUID PRIMARY KEY,
  processor TEXT NOT NULL,
  processor_transfer_id TEXT NOT NULL,
  amount BIGINT NOT NULL,
  currency VARCHAR(3) NOT NULL,
  destination_account_id UUID NOT NULL REFERENCES account(id),
  source_transaction_id UUID REFERENCES transaction(id),
  reversal_id TEXT,
  reversed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT transfer_processor_transfer_id_key UNIQUE (processor, processor_transfer_id)
);

CREATE TABLE IF NOT EXISTS held_balance (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organization(id),
  connected_account_id UUID REFERENCES account(id),
  source_transaction_id UUID REFERENCES transaction(id),
  amount BIGINT NOT NULL,
  currency VARCHAR(3) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- processed_webhook_event table (expanded with api_version, data, task_name, etc.)
CREATE TABLE IF NOT EXISTS processed_webhook_event (
  processor TEXT NOT NULL DEFAULT 'stripe',
  processor_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  api_version TEXT,
  data JSONB,
  task_name TEXT,
  handled_at TIMESTAMPTZ,
  request_id TEXT,
  PRIMARY KEY (processor, processor_event_id)
);

-- Dispute table (chargebacks)
CREATE TABLE IF NOT EXISTS dispute (
  id UUID PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  status dispute_status NOT NULL,
  amount BIGINT NOT NULL,
  currency VARCHAR(3) NOT NULL,
  processor TEXT NOT NULL DEFAULT 'stripe',
  processor_id TEXT,
  reason TEXT,
  reason_message TEXT,
  payment_id UUID NOT NULL REFERENCES payment(id),
  organization_id UUID NOT NULL REFERENCES organization(id),
  customer_id UUID REFERENCES customer(id),
  evidence_due_by TIMESTAMPTZ,
  evidence_submitted_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  CONSTRAINT dispute_processor_id_key UNIQUE (processor, processor_id)
);

-- Add default_payment_method_id FK to customer (after payment_method table exists)
ALTER TABLE customer
  ADD COLUMN default_payment_method_id UUID REFERENCES payment_method(id) ON DELETE SET NULL;

-- Indexes from base migration
CREATE INDEX IF NOT EXISTS idx_product_project_id ON product(project_id);
CREATE INDEX IF NOT EXISTS idx_project_organization_id ON project(organization_id);

CREATE INDEX IF NOT EXISTS idx_checkout_session_processor_checkout_id ON checkout_session(processor_checkout_id);
CREATE INDEX IF NOT EXISTS idx_checkout_session_org_id ON checkout_session(organization_id);

CREATE INDEX IF NOT EXISTS idx_transaction_project_id ON transaction(project_id);
CREATE INDEX IF NOT EXISTS idx_transaction_customer_id ON transaction(customer_id);
CREATE INDEX IF NOT EXISTS idx_transaction_charge_id ON transaction(charge_id);

CREATE INDEX IF NOT EXISTS idx_subscription_processor_subscription_id ON subscription(processor_subscription_id);

CREATE INDEX IF NOT EXISTS idx_processed_webhook_event_type ON processed_webhook_event(event_type);

CREATE UNIQUE INDEX IF NOT EXISTS account_org_processor_key ON account(organization_id, processor);
CREATE UNIQUE INDEX IF NOT EXISTS account_processor_account_id_key ON account(processor, processor_account_id) WHERE processor_account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_connected_account_org ON account(organization_id);

CREATE INDEX IF NOT EXISTS idx_transfer_destination ON transfer(destination_account_id);

CREATE UNIQUE INDEX IF NOT EXISTS payout_processor_payout_id_key ON payout(processor, processor_payout_id) WHERE processor_payout_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_connect_payout_account ON payout(account_id);

CREATE INDEX IF NOT EXISTS idx_held_balance_org ON held_balance(organization_id);
CREATE INDEX IF NOT EXISTS idx_held_balance_connected_account ON held_balance(connected_account_id);

-- Expression index for OAuth callback performance
CREATE INDEX IF NOT EXISTS idx_account_connect_state ON account ((data->>'connect_state')) WHERE data->>'connect_state' IS NOT NULL;

-- Indexes from payment_tables migration
CREATE INDEX IF NOT EXISTS ix_payment_method_customer_id ON payment_method(customer_id);

CREATE INDEX IF NOT EXISTS ix_payment_status ON payment(status);
CREATE INDEX IF NOT EXISTS ix_payment_customer_id ON payment(customer_id);
CREATE INDEX IF NOT EXISTS ix_payment_organization_id ON payment(organization_id);

CREATE INDEX IF NOT EXISTS ix_dispute_status ON dispute(status);
CREATE INDEX IF NOT EXISTS ix_dispute_payment_id ON dispute(payment_id);
CREATE INDEX IF NOT EXISTS ix_dispute_organization_id ON dispute(organization_id);

CREATE INDEX IF NOT EXISTS ix_refund_status ON refund(status);
CREATE INDEX IF NOT EXISTS ix_refund_payment_id ON refund(payment_id);
CREATE UNIQUE INDEX IF NOT EXISTS ix_refund_processor_id ON refund(processor_id) WHERE processor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_processed_webhook_event_handled_at ON processed_webhook_event(handled_at);
CREATE INDEX IF NOT EXISTS ix_processed_webhook_event_unprocessed ON processed_webhook_event(processed_at) WHERE handled_at IS NULL;

-- pgmq extension and queues
CREATE EXTENSION IF NOT EXISTS pgmq;

SELECT pgmq.create('webhooks');
SELECT pgmq.create('webhooks_dlq');
