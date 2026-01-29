--
-- PostgreSQL database dump
--


-- Dumped from database version 18.1 (Debian 18.1-1.pgdg13+2)
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: checkout_mode; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.checkout_mode AS ENUM (
    'payment',
    'subscription',
    'setup'
);


--
-- Name: checkout_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.checkout_status AS ENUM (
    'open',
    'complete',
    'expired'
);


--
-- Name: dispute_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.dispute_status AS ENUM (
    'warning_needs_response',
    'warning_under_review',
    'warning_closed',
    'needs_response',
    'under_review',
    'won',
    'lost'
);


--
-- Name: invoice_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.invoice_status AS ENUM (
    'draft',
    'open',
    'paid',
    'void',
    'uncollectible'
);


--
-- Name: payment_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payment_status AS ENUM (
    'requires_payment_method',
    'requires_confirmation',
    'requires_action',
    'processing',
    'requires_capture',
    'canceled',
    'succeeded'
);


--
-- Name: payout_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payout_status AS ENUM (
    'paid',
    'pending',
    'in_transit',
    'canceled',
    'failed'
);


--
-- Name: recurring_interval; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.recurring_interval AS ENUM (
    'day',
    'week',
    'month',
    'year'
);


--
-- Name: refund_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.refund_status AS ENUM (
    'pending',
    'requires_action',
    'succeeded',
    'failed',
    'canceled'
);


--
-- Name: subscription_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.subscription_status AS ENUM (
    'active',
    'past_due',
    'canceled',
    'unpaid',
    'trialing',
    'incomplete',
    'incomplete_expired'
);


--
-- Name: transaction_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.transaction_type AS ENUM (
    'payment',
    'processor_fee',
    'refund',
    'dispute',
    'balance',
    'payout'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: account; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "userId" uuid NOT NULL,
    "accountId" text NOT NULL,
    "providerId" text NOT NULL,
    "accessToken" text,
    "refreshToken" text,
    "accessTokenExpiresAt" timestamp with time zone,
    "refreshTokenExpiresAt" timestamp with time zone,
    scope text,
    "idToken" text,
    password text,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


--
-- Name: apikey; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.apikey (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text,
    start text,
    prefix text,
    key text NOT NULL,
    "userId" uuid NOT NULL,
    "organizationId" uuid,
    "projectId" uuid,
    "refillInterval" integer,
    "refillAmount" integer,
    "lastRefillAt" timestamp with time zone,
    enabled boolean DEFAULT true NOT NULL,
    "rateLimitEnabled" boolean DEFAULT false NOT NULL,
    "rateLimitTimeWindow" integer,
    "rateLimitMax" integer,
    "requestCount" integer DEFAULT 0 NOT NULL,
    remaining integer,
    "lastRequest" timestamp with time zone,
    "expiresAt" timestamp with time zone,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    permissions text,
    metadata jsonb
);


--
-- Name: chats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chats (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "projectId" uuid NOT NULL,
    "agentSessionId" text,
    title text,
    metadata jsonb,
    stats jsonb,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: checkout_session; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.checkout_session (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    processor text DEFAULT 'stripe'::text NOT NULL,
    "processorCheckoutId" text NOT NULL,
    "projectId" uuid NOT NULL,
    "productId" uuid NOT NULL,
    "priceId" uuid NOT NULL,
    status public.checkout_status DEFAULT 'open'::public.checkout_status NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "customerId" uuid,
    "customerEmail" character varying(320),
    "processorCustomerId" text,
    "processorPaymentId" text,
    "processorSubscriptionId" text,
    "successUrl" text,
    "cancelUrl" text,
    mode public.checkout_mode,
    "completedAt" timestamp with time zone
);


--
-- Name: connect_account; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.connect_account (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "projectId" uuid,
    country character varying(2) NOT NULL,
    currency character varying(3) NOT NULL,
    "isPayoutsEnabled" boolean NOT NULL,
    processor text DEFAULT 'stripe'::text NOT NULL,
    "processorAccountId" text,
    status text DEFAULT 'pending'::text NOT NULL,
    "detailsSubmitted" boolean DEFAULT false NOT NULL,
    "chargesEnabled" boolean DEFAULT false NOT NULL,
    "businessType" text,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: customer; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "projectId" uuid NOT NULL,
    "externalId" text NOT NULL,
    email character varying(320),
    name text,
    processor text DEFAULT 'stripe'::text NOT NULL,
    "processorCustomerId" text,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
    "defaultPaymentMethodId" uuid
);


--
-- Name: customer_product; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_product (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "customerId" uuid NOT NULL,
    "productId" uuid NOT NULL,
    "subscriptionId" uuid,
    status text,
    processor jsonb,
    canceled boolean DEFAULT false,
    "canceledAt" timestamp with time zone,
    "endedAt" timestamp with time zone,
    "startsAt" timestamp with time zone,
    "trialEndsAt" timestamp with time zone,
    "collectionMethod" text DEFAULT 'charge_automatically'::text,
    quantity integer DEFAULT 1,
    "isCustom" boolean DEFAULT false,
    options jsonb DEFAULT '[]'::jsonb,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: deployment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.deployment (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "projectId" uuid NOT NULL,
    "scriptName" text NOT NULL,
    status text NOT NULL,
    error text,
    "startedAt" timestamp with time zone,
    "finishedAt" timestamp with time zone,
    "cloudflareDeploymentId" text,
    "cloudflareVersionId" text,
    "rollbackOf" uuid,
    hostname text,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: dispute; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dispute (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "deletedAt" timestamp with time zone,
    status public.dispute_status NOT NULL,
    amount bigint NOT NULL,
    currency character varying(3) NOT NULL,
    processor text DEFAULT 'stripe'::text NOT NULL,
    "processorId" text,
    reason text,
    "reasonMessage" text,
    "paymentId" uuid NOT NULL,
    "projectId" uuid NOT NULL,
    "customerId" uuid,
    "evidenceDueBy" timestamp with time zone,
    "evidenceSubmittedAt" timestamp with time zone,
    "resolvedAt" timestamp with time zone
);


--
-- Name: env_var; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.env_var (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "projectId" uuid NOT NULL,
    environment text NOT NULL,
    key text NOT NULL,
    value text,
    "integrationId" uuid,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: github_installations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.github_installations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "userId" uuid NOT NULL,
    "installationId" bigint NOT NULL,
    "accountLogin" text NOT NULL,
    "accountType" text NOT NULL,
    "userAccessToken" text,
    "userAccessTokenExpiresAt" timestamp with time zone,
    "userRefreshToken" text,
    "userRefreshTokenExpiresAt" timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: github_oauth_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.github_oauth_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "userId" uuid NOT NULL,
    "accessToken" text,
    "accessTokenExpiresAt" timestamp with time zone,
    "refreshToken" text,
    "refreshTokenExpiresAt" timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: integration; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.integration (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "projectId" uuid NOT NULL,
    provider text NOT NULL,
    config jsonb,
    status text DEFAULT 'connected'::text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: invitation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invitation (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    "inviterId" uuid NOT NULL,
    "organizationId" uuid NOT NULL,
    "teamId" uuid,
    role text NOT NULL,
    status text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "expiresAt" timestamp with time zone NOT NULL
);


--
-- Name: invoice; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoice (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "customerId" uuid NOT NULL,
    "subscriptionId" uuid,
    "productIds" text[] DEFAULT '{}'::text[],
    "stripeId" text NOT NULL,
    status public.invoice_status DEFAULT 'draft'::public.invoice_status,
    "hostedInvoiceUrl" text,
    total bigint DEFAULT 0,
    currency character varying(3) DEFAULT 'usd'::character varying,
    discounts jsonb DEFAULT '[]'::jsonb,
    items jsonb DEFAULT '[]'::jsonb,
    "periodStart" timestamp with time zone,
    "periodEnd" timestamp with time zone,
    "dueDate" timestamp with time zone,
    "paidAt" timestamp with time zone,
    "voidedAt" timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ip; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ip (
    ip text NOT NULL,
    usage integer,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
    "deletedAt" timestamp with time zone
);


--
-- Name: ip_rate_limit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ip_rate_limit (
    ip text NOT NULL,
    "interval" text NOT NULL,
    count integer NOT NULL
);


--
-- Name: kysely_migration; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kysely_migration (
    name character varying(255) NOT NULL,
    "timestamp" character varying(255) NOT NULL
);


--
-- Name: kysely_migration_lock; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kysely_migration_lock (
    id character varying(255) NOT NULL,
    is_locked integer DEFAULT 0 NOT NULL
);


--
-- Name: member; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.member (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "userId" uuid NOT NULL,
    "organizationId" uuid NOT NULL,
    role text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: model; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.model (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "projectId" uuid NOT NULL,
    model text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
    "deletedAt" timestamp with time zone
);


--
-- Name: organization; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    logo text,
    metadata jsonb,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
    "createdBy" text,
    "platformFeePercent" integer,
    "platformFeeFixed" integer
);


--
-- Name: organizationRole; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."organizationRole" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "organizationId" uuid NOT NULL,
    role text NOT NULL,
    permission text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: payment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "deletedAt" timestamp with time zone,
    processor text DEFAULT 'stripe'::text NOT NULL,
    "processorId" text NOT NULL,
    status public.payment_status NOT NULL,
    amount bigint NOT NULL,
    currency character varying(3) NOT NULL,
    method text NOT NULL,
    "methodMetadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "customerId" uuid,
    "customerEmail" character varying(320),
    "projectId" uuid NOT NULL,
    "checkoutSessionId" uuid,
    "paymentMethodId" uuid,
    "declineReason" text,
    "declineMessage" text,
    "riskLevel" text,
    "riskScore" smallint,
    "processorMetadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "authorizedAt" timestamp with time zone,
    "capturedAt" timestamp with time zone,
    "canceledAt" timestamp with time zone
);


--
-- Name: payment_method; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_method (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "deletedAt" timestamp with time zone,
    processor text DEFAULT 'stripe'::text NOT NULL,
    "processorId" text NOT NULL,
    type text NOT NULL,
    "methodMetadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "customerId" uuid NOT NULL
);


--
-- Name: payout; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payout (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "accountId" uuid,
    amount bigint NOT NULL,
    currency character varying(3) NOT NULL,
    status public.payout_status NOT NULL,
    processor text DEFAULT 'stripe'::text NOT NULL,
    "processorPayoutId" text,
    "paidAt" timestamp with time zone
);


--
-- Name: processed_webhook_event; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.processed_webhook_event (
    processor text DEFAULT 'stripe'::text NOT NULL,
    "processorEventId" text NOT NULL,
    "eventType" text NOT NULL,
    "processedAt" timestamp with time zone DEFAULT now() NOT NULL,
    "apiVersion" text,
    data jsonb,
    "taskName" text,
    "handledAt" timestamp with time zone,
    "requestId" text
);


--
-- Name: product; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "productGroup" text NOT NULL,
    name text NOT NULL,
    description text,
    "projectId" uuid NOT NULL,
    slug text NOT NULL,
    version integer,
    "isArchived" boolean DEFAULT false,
    "isDefault" boolean,
    processor text DEFAULT 'stripe'::text NOT NULL,
    "processorProductId" text,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
    "isAddOn" boolean DEFAULT false,
    "planGroup" text,
    env text DEFAULT 'live'::text
);


--
-- Name: product_price; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_price (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "productId" uuid NOT NULL,
    name text,
    description text,
    "priceAmount" integer NOT NULL,
    "priceCurrency" character varying(3) NOT NULL,
    "recurringInterval" public.recurring_interval,
    "isDefault" boolean,
    processor text DEFAULT 'stripe'::text NOT NULL,
    "processorPriceId" text,
    slug text,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: project; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "userId" uuid NOT NULL,
    "organizationId" uuid NOT NULL,
    name text NOT NULL,
    github jsonb,
    settings jsonb,
    deployment jsonb,
    sandbox jsonb,
    metadata jsonb,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
    "deletedAt" timestamp with time zone,
    slug text NOT NULL
);


--
-- Name: provider; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.provider (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "projectId" uuid NOT NULL,
    provider text NOT NULL,
    credentials text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
    "deletedAt" timestamp with time zone
);


--
-- Name: refund; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.refund (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "deletedAt" timestamp with time zone,
    amount bigint NOT NULL,
    currency character varying(3) NOT NULL,
    reason text,
    status public.refund_status DEFAULT 'succeeded'::public.refund_status NOT NULL,
    processor text DEFAULT 'stripe'::text NOT NULL,
    "processorId" text,
    "paymentId" uuid,
    "projectId" uuid NOT NULL,
    "customerId" uuid
);


--
-- Name: sandbox; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sandbox (
    id text NOT NULL,
    "projectId" uuid NOT NULL,
    provider text NOT NULL,
    status text NOT NULL,
    host text,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: session; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "userId" uuid NOT NULL,
    token text NOT NULL,
    "expiresAt" timestamp with time zone NOT NULL,
    "ipAddress" text,
    "userAgent" text,
    "activeOrganizationId" uuid,
    "activeTeamId" uuid,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


--
-- Name: subscription; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "projectId" uuid NOT NULL,
    "productId" uuid,
    "productPriceId" uuid,
    "customerId" uuid,
    "createdAt" timestamp with time zone NOT NULL,
    "deletedAt" timestamp with time zone,
    "currentPeriodStart" timestamp with time zone,
    "currentPeriodEnd" timestamp with time zone,
    "canceledAt" timestamp with time zone,
    "endedAt" timestamp with time zone,
    status public.subscription_status NOT NULL,
    processor text DEFAULT 'stripe'::text NOT NULL,
    "processorSubscriptionId" text,
    "processorCustomerId" text,
    "cancelAtPeriodEnd" boolean DEFAULT false,
    "paymentMethodBrand" character varying(20),
    "paymentMethodLast4" character varying(4),
    "paymentMethodId" uuid
);


--
-- Name: team; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "organizationId" uuid NOT NULL,
    name text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone
);


--
-- Name: teamMember; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."teamMember" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "teamId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: transaction; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transaction (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    type public.transaction_type NOT NULL,
    amount bigint NOT NULL,
    currency character varying(3) NOT NULL,
    "taxAmount" bigint DEFAULT 0,
    "accountId" uuid,
    "accountAmount" bigint,
    "accountCurrency" character varying(3),
    "presentmentAmount" bigint,
    "presentmentCurrency" character varying(3),
    "presentmentTaxAmount" bigint,
    "taxFilingAmount" bigint,
    "taxFilingCurrency" character varying(3),
    "taxCountry" character varying(2),
    "taxState" character varying(2),
    processor text NOT NULL,
    "chargeId" text,
    "transferId" text,
    "refundId" uuid,
    "payoutId" uuid,
    "paymentTransactionId" uuid,
    "incurredByTransactionId" uuid,
    "payoutTransactionId" uuid,
    "projectId" uuid NOT NULL,
    "customerId" uuid,
    "productId" uuid,
    "productPriceId" uuid,
    "subscriptionId" uuid,
    "checkoutSessionId" uuid,
    "processorInvoiceId" text,
    "paymentMethodBrand" character varying(20),
    "paymentMethodLast4" character varying(4),
    metadata jsonb DEFAULT '{}'::jsonb,
    "succeededAt" timestamp with time zone,
    "refundedAt" timestamp with time zone,
    "paymentId" uuid
);


--
-- Name: transfer; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transfer (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    processor text NOT NULL,
    "processorTransferId" text NOT NULL,
    amount bigint NOT NULL,
    currency character varying(3) NOT NULL,
    "destinationAccountId" uuid NOT NULL,
    "sourceTransactionId" uuid,
    "reversalId" text,
    "reversedAt" timestamp with time zone,
    status text DEFAULT 'pending'::text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: usage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usage (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "projectId" uuid NOT NULL,
    model text NOT NULL,
    provider text NOT NULL,
    "inputTokens" integer NOT NULL,
    "outputTokens" integer NOT NULL,
    "reasoningTokens" integer,
    "cacheReadTokens" integer,
    "cacheWrite5mTokens" integer,
    "cacheWrite1hTokens" integer,
    cost bigint NOT NULL,
    "keyId" uuid,
    enrichment jsonb,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
    "deletedAt" timestamp with time zone
);


--
-- Name: user; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."user" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    "emailVerified" boolean NOT NULL,
    image text,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


--
-- Name: verification; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.verification (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    identifier text NOT NULL,
    value text NOT NULL,
    "expiresAt" timestamp with time zone NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


--
-- Name: worker; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.worker (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "projectId" uuid NOT NULL,
    "accountId" text NOT NULL,
    "scriptName" text NOT NULL,
    "dispatchNamespace" text,
    hostname text,
    status text,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: account account_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT account_pkey PRIMARY KEY (id);


--
-- Name: connect_account account_project_processor_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connect_account
    ADD CONSTRAINT account_project_processor_key UNIQUE ("projectId", processor);


--
-- Name: apikey apikey_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apikey
    ADD CONSTRAINT apikey_pkey PRIMARY KEY (id);


--
-- Name: chats chats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chats
    ADD CONSTRAINT chats_pkey PRIMARY KEY (id);


--
-- Name: checkout_session checkout_session_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkout_session
    ADD CONSTRAINT checkout_session_pkey PRIMARY KEY (id);


--
-- Name: checkout_session checkout_session_processor_checkout_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkout_session
    ADD CONSTRAINT checkout_session_processor_checkout_id_key UNIQUE (processor, "processorCheckoutId");


--
-- Name: connect_account connect_account_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connect_account
    ADD CONSTRAINT connect_account_pkey PRIMARY KEY (id);


--
-- Name: customer customer_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer
    ADD CONSTRAINT customer_pkey PRIMARY KEY (id);


--
-- Name: customer_product customer_product_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_product
    ADD CONSTRAINT customer_product_pkey PRIMARY KEY (id);


--
-- Name: customer customer_project_id_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer
    ADD CONSTRAINT customer_project_id_email_key UNIQUE ("projectId", email);


--
-- Name: customer customer_project_id_external_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer
    ADD CONSTRAINT customer_project_id_external_id_key UNIQUE ("projectId", "externalId");


--
-- Name: deployment deployment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deployment
    ADD CONSTRAINT deployment_pkey PRIMARY KEY (id);


--
-- Name: dispute dispute_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispute
    ADD CONSTRAINT dispute_pkey PRIMARY KEY (id);


--
-- Name: dispute dispute_processor_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispute
    ADD CONSTRAINT dispute_processor_id_key UNIQUE (processor, "processorId");


--
-- Name: env_var env_var_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.env_var
    ADD CONSTRAINT env_var_pkey PRIMARY KEY (id);


--
-- Name: github_installations github_installations_installationId_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.github_installations
    ADD CONSTRAINT "github_installations_installationId_key" UNIQUE ("installationId");


--
-- Name: github_installations github_installations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.github_installations
    ADD CONSTRAINT github_installations_pkey PRIMARY KEY (id);


--
-- Name: github_oauth_tokens github_oauth_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.github_oauth_tokens
    ADD CONSTRAINT github_oauth_tokens_pkey PRIMARY KEY (id);


--
-- Name: github_oauth_tokens github_oauth_tokens_userId_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.github_oauth_tokens
    ADD CONSTRAINT "github_oauth_tokens_userId_key" UNIQUE ("userId");


--
-- Name: integration integration_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration
    ADD CONSTRAINT integration_pkey PRIMARY KEY (id);


--
-- Name: invitation invitation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitation
    ADD CONSTRAINT invitation_pkey PRIMARY KEY (id);


--
-- Name: invoice invoice_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice
    ADD CONSTRAINT invoice_pkey PRIMARY KEY (id);


--
-- Name: invoice invoice_stripeId_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice
    ADD CONSTRAINT "invoice_stripeId_key" UNIQUE ("stripeId");


--
-- Name: ip ip_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ip
    ADD CONSTRAINT ip_pkey PRIMARY KEY (ip);


--
-- Name: ip_rate_limit ip_rate_limit_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ip_rate_limit
    ADD CONSTRAINT ip_rate_limit_pk PRIMARY KEY (ip, "interval");


--
-- Name: kysely_migration_lock kysely_migration_lock_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kysely_migration_lock
    ADD CONSTRAINT kysely_migration_lock_pkey PRIMARY KEY (id);


--
-- Name: kysely_migration kysely_migration_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kysely_migration
    ADD CONSTRAINT kysely_migration_pkey PRIMARY KEY (name);


--
-- Name: member member_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member
    ADD CONSTRAINT member_pkey PRIMARY KEY (id);


--
-- Name: model model_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model
    ADD CONSTRAINT model_pkey PRIMARY KEY (id);


--
-- Name: organizationRole organizationRole_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."organizationRole"
    ADD CONSTRAINT "organizationRole_pkey" PRIMARY KEY (id);


--
-- Name: organization organization_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization
    ADD CONSTRAINT organization_pkey PRIMARY KEY (id);


--
-- Name: payment_method payment_method_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_method
    ADD CONSTRAINT payment_method_pkey PRIMARY KEY (id);


--
-- Name: payment_method payment_method_processor_customer_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_method
    ADD CONSTRAINT payment_method_processor_customer_key UNIQUE (processor, "processorId", "customerId");


--
-- Name: payment payment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment
    ADD CONSTRAINT payment_pkey PRIMARY KEY (id);


--
-- Name: payment payment_processor_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment
    ADD CONSTRAINT payment_processor_id_key UNIQUE (processor, "processorId");


--
-- Name: payout payout_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payout
    ADD CONSTRAINT payout_pkey PRIMARY KEY (id);


--
-- Name: processed_webhook_event processed_webhook_event_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.processed_webhook_event
    ADD CONSTRAINT processed_webhook_event_pk PRIMARY KEY (processor, "processorEventId");


--
-- Name: product product_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product
    ADD CONSTRAINT product_pkey PRIMARY KEY (id);


--
-- Name: product_price product_price_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_price
    ADD CONSTRAINT product_price_pkey PRIMARY KEY (id);


--
-- Name: product product_project_id_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product
    ADD CONSTRAINT product_project_id_slug_key UNIQUE ("projectId", slug);


--
-- Name: project project_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project
    ADD CONSTRAINT project_pkey PRIMARY KEY (id);


--
-- Name: project project_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project
    ADD CONSTRAINT project_slug_key UNIQUE (slug);


--
-- Name: provider provider_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider
    ADD CONSTRAINT provider_pkey PRIMARY KEY (id);


--
-- Name: refund refund_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refund
    ADD CONSTRAINT refund_pkey PRIMARY KEY (id);


--
-- Name: sandbox sandbox_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sandbox
    ADD CONSTRAINT sandbox_pkey PRIMARY KEY (id);


--
-- Name: session session_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT session_pkey PRIMARY KEY (id);


--
-- Name: subscription subscription_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription
    ADD CONSTRAINT subscription_pkey PRIMARY KEY (id);


--
-- Name: subscription subscription_processor_subscription_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription
    ADD CONSTRAINT subscription_processor_subscription_id_key UNIQUE (processor, "processorSubscriptionId");


--
-- Name: teamMember teamMember_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."teamMember"
    ADD CONSTRAINT "teamMember_pkey" PRIMARY KEY (id);


--
-- Name: team team_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team
    ADD CONSTRAINT team_pkey PRIMARY KEY (id);


--
-- Name: transaction transaction_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transaction
    ADD CONSTRAINT transaction_pkey PRIMARY KEY (id);


--
-- Name: transfer transfer_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transfer
    ADD CONSTRAINT transfer_pkey PRIMARY KEY (id);


--
-- Name: transfer transfer_processor_transfer_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transfer
    ADD CONSTRAINT transfer_processor_transfer_id_key UNIQUE (processor, "processorTransferId");


--
-- Name: usage usage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usage
    ADD CONSTRAINT usage_pkey PRIMARY KEY (id);


--
-- Name: user user_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_pkey PRIMARY KEY (id);


--
-- Name: verification verification_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification
    ADD CONSTRAINT verification_pkey PRIMARY KEY (id);


--
-- Name: worker worker_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.worker
    ADD CONSTRAINT worker_pkey PRIMARY KEY (id);


--
-- Name: apikey_key_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX apikey_key_idx ON public.apikey USING btree (key);


--
-- Name: apikey_projectId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "apikey_projectId_idx" ON public.apikey USING btree ("projectId");


--
-- Name: chats_projectId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "chats_projectId_idx" ON public.chats USING btree ("projectId");


--
-- Name: deployment_projectId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "deployment_projectId_idx" ON public.deployment USING btree ("projectId");


--
-- Name: env_var_projectId_env_key_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "env_var_projectId_env_key_idx" ON public.env_var USING btree ("projectId", environment, key);


--
-- Name: github_installations_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "github_installations_userId_idx" ON public.github_installations USING btree ("userId");


--
-- Name: idx_account_connect_state; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_account_connect_state ON public.connect_account USING btree (((data ->> 'connect_state'::text))) WHERE ((data ->> 'connect_state'::text) IS NOT NULL);


--
-- Name: idx_checkout_session_processor_checkout_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_checkout_session_processor_checkout_id ON public.checkout_session USING btree ("processorCheckoutId");


--
-- Name: idx_checkout_session_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_checkout_session_project_id ON public.checkout_session USING btree ("projectId");


--
-- Name: idx_connect_account_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_connect_account_project ON public.connect_account USING btree ("projectId");


--
-- Name: idx_connect_payout_account; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_connect_payout_account ON public.payout USING btree ("accountId");


--
-- Name: idx_customer_product_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_product_customer_id ON public.customer_product USING btree ("customerId");


--
-- Name: idx_customer_product_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_product_product_id ON public.customer_product USING btree ("productId");


--
-- Name: idx_invoice_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoice_customer_id ON public.invoice USING btree ("customerId");


--
-- Name: idx_invoice_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoice_status ON public.invoice USING btree (status);


--
-- Name: idx_invoice_subscription_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoice_subscription_id ON public.invoice USING btree ("subscriptionId");


--
-- Name: idx_processed_webhook_event_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_processed_webhook_event_type ON public.processed_webhook_event USING btree ("eventType");


--
-- Name: idx_product_group; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_group ON public.product USING btree ("productGroup");


--
-- Name: idx_product_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_project_id ON public.product USING btree ("projectId");


--
-- Name: idx_project_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_organization_id ON public.project USING btree ("organizationId");


--
-- Name: idx_subscription_processor_subscription_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscription_processor_subscription_id ON public.subscription USING btree ("processorSubscriptionId");


--
-- Name: idx_subscription_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscription_project_id ON public.subscription USING btree ("projectId");


--
-- Name: idx_transaction_charge_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transaction_charge_id ON public.transaction USING btree ("chargeId");


--
-- Name: idx_transaction_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transaction_customer_id ON public.transaction USING btree ("customerId");


--
-- Name: idx_transaction_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transaction_project_id ON public.transaction USING btree ("projectId");


--
-- Name: idx_transfer_destination; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transfer_destination ON public.transfer USING btree ("destinationAccountId");


--
-- Name: integration_projectId_provider_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "integration_projectId_provider_idx" ON public.integration USING btree ("projectId", provider);


--
-- Name: ix_connect_account_processor_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_connect_account_processor_account_id ON public.connect_account USING btree (processor, "processorAccountId") WHERE ("processorAccountId" IS NOT NULL);


--
-- Name: ix_dispute_payment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_dispute_payment_id ON public.dispute USING btree ("paymentId");


--
-- Name: ix_dispute_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_dispute_project_id ON public.dispute USING btree ("projectId");


--
-- Name: ix_dispute_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_dispute_status ON public.dispute USING btree (status);


--
-- Name: ix_payment_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_payment_customer_id ON public.payment USING btree ("customerId");


--
-- Name: ix_payment_method_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_payment_method_customer_id ON public.payment_method USING btree ("customerId");


--
-- Name: ix_payment_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_payment_project_id ON public.payment USING btree ("projectId");


--
-- Name: ix_payment_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_payment_status ON public.payment USING btree (status);


--
-- Name: ix_payout_processor_payout_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_payout_processor_payout_id ON public.payout USING btree (processor, "processorPayoutId") WHERE ("processorPayoutId" IS NOT NULL);


--
-- Name: ix_processed_webhook_event_handled_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_processed_webhook_event_handled_at ON public.processed_webhook_event USING btree ("handledAt");


--
-- Name: ix_processed_webhook_event_unprocessed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_processed_webhook_event_unprocessed ON public.processed_webhook_event USING btree ("processedAt") WHERE ("handledAt" IS NULL);


--
-- Name: ix_product_price_product_id_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_product_price_product_id_slug ON public.product_price USING btree ("productId", slug) WHERE (slug IS NOT NULL);


--
-- Name: ix_refund_payment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_refund_payment_id ON public.refund USING btree ("paymentId");


--
-- Name: ix_refund_processor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_refund_processor_id ON public.refund USING btree ("processorId") WHERE ("processorId" IS NOT NULL);


--
-- Name: ix_refund_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_refund_project_id ON public.refund USING btree ("projectId");


--
-- Name: ix_refund_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_refund_status ON public.refund USING btree (status);


--
-- Name: ix_transaction_charge_id_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_transaction_charge_id_unique ON public.transaction USING btree ("chargeId") WHERE (("chargeId" IS NOT NULL) AND (type = 'payment'::public.transaction_type));


--
-- Name: ix_transaction_processor_invoice_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_transaction_processor_invoice_id ON public.transaction USING btree ("processorInvoiceId") WHERE (("processorInvoiceId" IS NOT NULL) AND (type = 'payment'::public.transaction_type));


--
-- Name: member_user_org_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX member_user_org_uq ON public.member USING btree ("userId", "organizationId");


--
-- Name: model_project_model_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX model_project_model_uq ON public.model USING btree ("projectId", model);


--
-- Name: organizationRole_organizationId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "organizationRole_organizationId_idx" ON public."organizationRole" USING btree ("organizationId");


--
-- Name: organization_slug_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX organization_slug_uq ON public.organization USING btree (slug);


--
-- Name: project_organizationId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "project_organizationId_idx" ON public.project USING btree ("organizationId");


--
-- Name: project_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "project_userId_idx" ON public.project USING btree ("userId");


--
-- Name: provider_project_provider_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX provider_project_provider_uq ON public.provider USING btree ("projectId", provider);


--
-- Name: sandbox_projectId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "sandbox_projectId_idx" ON public.sandbox USING btree ("projectId");


--
-- Name: teamMember_teamId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "teamMember_teamId_idx" ON public."teamMember" USING btree ("teamId");


--
-- Name: team_organizationId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "team_organizationId_idx" ON public.team USING btree ("organizationId");


--
-- Name: usage_project_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX usage_project_created_idx ON public.usage USING btree ("projectId", "createdAt");


--
-- Name: worker_projectId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "worker_projectId_idx" ON public.worker USING btree ("projectId");


--
-- Name: worker_scriptName_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "worker_scriptName_unique" ON public.worker USING btree ("scriptName");


--
-- Name: account account_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."user"(id);


--
-- Name: apikey apikey_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apikey
    ADD CONSTRAINT "apikey_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public.organization(id);


--
-- Name: apikey apikey_projectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apikey
    ADD CONSTRAINT "apikey_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES public.project(id);


--
-- Name: apikey apikey_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apikey
    ADD CONSTRAINT "apikey_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."user"(id);


--
-- Name: chats chats_projectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chats
    ADD CONSTRAINT "chats_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES public.project(id);


--
-- Name: checkout_session checkout_session_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkout_session
    ADD CONSTRAINT "checkout_session_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public.customer(id);


--
-- Name: checkout_session checkout_session_priceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkout_session
    ADD CONSTRAINT "checkout_session_priceId_fkey" FOREIGN KEY ("priceId") REFERENCES public.product_price(id);


--
-- Name: checkout_session checkout_session_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkout_session
    ADD CONSTRAINT "checkout_session_productId_fkey" FOREIGN KEY ("productId") REFERENCES public.product(id);


--
-- Name: checkout_session checkout_session_projectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkout_session
    ADD CONSTRAINT "checkout_session_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES public.project(id);


--
-- Name: connect_account connect_account_projectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connect_account
    ADD CONSTRAINT "connect_account_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES public.project(id);


--
-- Name: customer customer_defaultPaymentMethodId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer
    ADD CONSTRAINT "customer_defaultPaymentMethodId_fkey" FOREIGN KEY ("defaultPaymentMethodId") REFERENCES public.payment_method(id) ON DELETE SET NULL;


--
-- Name: customer_product customer_product_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_product
    ADD CONSTRAINT "customer_product_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public.customer(id) ON DELETE CASCADE;


--
-- Name: customer_product customer_product_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_product
    ADD CONSTRAINT "customer_product_productId_fkey" FOREIGN KEY ("productId") REFERENCES public.product(id);


--
-- Name: customer_product customer_product_subscriptionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_product
    ADD CONSTRAINT "customer_product_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES public.subscription(id);


--
-- Name: customer customer_projectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer
    ADD CONSTRAINT "customer_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES public.project(id);


--
-- Name: deployment deployment_projectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deployment
    ADD CONSTRAINT "deployment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES public.project(id) ON DELETE CASCADE;


--
-- Name: deployment deployment_rollbackOf_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deployment
    ADD CONSTRAINT "deployment_rollbackOf_fkey" FOREIGN KEY ("rollbackOf") REFERENCES public.deployment(id);


--
-- Name: dispute dispute_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispute
    ADD CONSTRAINT "dispute_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public.customer(id);


--
-- Name: dispute dispute_paymentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispute
    ADD CONSTRAINT "dispute_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES public.payment(id);


--
-- Name: dispute dispute_projectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispute
    ADD CONSTRAINT "dispute_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES public.project(id);


--
-- Name: env_var env_var_integrationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.env_var
    ADD CONSTRAINT "env_var_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES public.integration(id) ON DELETE SET NULL;


--
-- Name: env_var env_var_projectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.env_var
    ADD CONSTRAINT "env_var_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES public.project(id) ON DELETE CASCADE;


--
-- Name: github_installations github_installations_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.github_installations
    ADD CONSTRAINT "github_installations_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."user"(id);


--
-- Name: github_oauth_tokens github_oauth_tokens_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.github_oauth_tokens
    ADD CONSTRAINT "github_oauth_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."user"(id);


--
-- Name: integration integration_projectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration
    ADD CONSTRAINT "integration_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES public.project(id) ON DELETE CASCADE;


--
-- Name: invitation invitation_inviterId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitation
    ADD CONSTRAINT "invitation_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES public."user"(id);


--
-- Name: invitation invitation_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitation
    ADD CONSTRAINT "invitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public.organization(id);


--
-- Name: invitation invitation_teamId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitation
    ADD CONSTRAINT "invitation_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES public.team(id);


--
-- Name: invoice invoice_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice
    ADD CONSTRAINT "invoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public.customer(id) ON DELETE CASCADE;


--
-- Name: invoice invoice_subscriptionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice
    ADD CONSTRAINT "invoice_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES public.subscription(id);


--
-- Name: member member_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member
    ADD CONSTRAINT "member_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public.organization(id);


--
-- Name: member member_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member
    ADD CONSTRAINT "member_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."user"(id);


--
-- Name: model model_projectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model
    ADD CONSTRAINT "model_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES public.project(id);


--
-- Name: organizationRole organizationRole_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."organizationRole"
    ADD CONSTRAINT "organizationRole_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public.organization(id);


--
-- Name: payment payment_checkoutSessionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment
    ADD CONSTRAINT "payment_checkoutSessionId_fkey" FOREIGN KEY ("checkoutSessionId") REFERENCES public.checkout_session(id) ON DELETE SET NULL;


--
-- Name: payment payment_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment
    ADD CONSTRAINT "payment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public.customer(id);


--
-- Name: payment_method payment_method_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_method
    ADD CONSTRAINT "payment_method_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public.customer(id) ON DELETE CASCADE;


--
-- Name: payment payment_paymentMethodId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment
    ADD CONSTRAINT "payment_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES public.payment_method(id) ON DELETE SET NULL;


--
-- Name: payment payment_projectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment
    ADD CONSTRAINT "payment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES public.project(id);


--
-- Name: payout payout_accountId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payout
    ADD CONSTRAINT "payout_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES public.connect_account(id);


--
-- Name: product_price product_price_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_price
    ADD CONSTRAINT "product_price_productId_fkey" FOREIGN KEY ("productId") REFERENCES public.product(id);


--
-- Name: product product_projectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product
    ADD CONSTRAINT "product_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES public.project(id);


--
-- Name: project project_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project
    ADD CONSTRAINT "project_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public.organization(id);


--
-- Name: project project_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project
    ADD CONSTRAINT "project_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."user"(id);


--
-- Name: provider provider_projectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider
    ADD CONSTRAINT "provider_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES public.project(id);


--
-- Name: refund refund_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refund
    ADD CONSTRAINT "refund_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public.customer(id);


--
-- Name: refund refund_paymentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refund
    ADD CONSTRAINT "refund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES public.payment(id);


--
-- Name: refund refund_projectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refund
    ADD CONSTRAINT "refund_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES public.project(id);


--
-- Name: sandbox sandbox_projectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sandbox
    ADD CONSTRAINT "sandbox_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES public.project(id) ON DELETE CASCADE;


--
-- Name: session session_activeOrganizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT "session_activeOrganizationId_fkey" FOREIGN KEY ("activeOrganizationId") REFERENCES public.organization(id);


--
-- Name: session session_activeTeamId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT "session_activeTeamId_fkey" FOREIGN KEY ("activeTeamId") REFERENCES public.team(id);


--
-- Name: session session_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."user"(id);


--
-- Name: subscription subscription_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription
    ADD CONSTRAINT "subscription_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public.customer(id);


--
-- Name: subscription subscription_paymentMethodId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription
    ADD CONSTRAINT "subscription_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES public.payment_method(id) ON DELETE SET NULL;


--
-- Name: subscription subscription_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription
    ADD CONSTRAINT "subscription_productId_fkey" FOREIGN KEY ("productId") REFERENCES public.product(id);


--
-- Name: subscription subscription_productPriceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription
    ADD CONSTRAINT "subscription_productPriceId_fkey" FOREIGN KEY ("productPriceId") REFERENCES public.product_price(id);


--
-- Name: subscription subscription_projectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription
    ADD CONSTRAINT "subscription_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES public.project(id);


--
-- Name: teamMember teamMember_teamId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."teamMember"
    ADD CONSTRAINT "teamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES public.team(id);


--
-- Name: teamMember teamMember_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."teamMember"
    ADD CONSTRAINT "teamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."user"(id);


--
-- Name: team team_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team
    ADD CONSTRAINT "team_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public.organization(id);


--
-- Name: transaction transaction_accountId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transaction
    ADD CONSTRAINT "transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES public.connect_account(id);


--
-- Name: transaction transaction_checkoutSessionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transaction
    ADD CONSTRAINT "transaction_checkoutSessionId_fkey" FOREIGN KEY ("checkoutSessionId") REFERENCES public.checkout_session(id);


--
-- Name: transaction transaction_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transaction
    ADD CONSTRAINT "transaction_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public.customer(id);


--
-- Name: transaction transaction_incurredByTransactionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transaction
    ADD CONSTRAINT "transaction_incurredByTransactionId_fkey" FOREIGN KEY ("incurredByTransactionId") REFERENCES public.transaction(id);


--
-- Name: transaction transaction_paymentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transaction
    ADD CONSTRAINT "transaction_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES public.payment(id);


--
-- Name: transaction transaction_paymentTransactionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transaction
    ADD CONSTRAINT "transaction_paymentTransactionId_fkey" FOREIGN KEY ("paymentTransactionId") REFERENCES public.transaction(id);


--
-- Name: transaction transaction_payoutId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transaction
    ADD CONSTRAINT "transaction_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES public.payout(id);


--
-- Name: transaction transaction_payoutTransactionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transaction
    ADD CONSTRAINT "transaction_payoutTransactionId_fkey" FOREIGN KEY ("payoutTransactionId") REFERENCES public.transaction(id);


--
-- Name: transaction transaction_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transaction
    ADD CONSTRAINT "transaction_productId_fkey" FOREIGN KEY ("productId") REFERENCES public.product(id);


--
-- Name: transaction transaction_productPriceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transaction
    ADD CONSTRAINT "transaction_productPriceId_fkey" FOREIGN KEY ("productPriceId") REFERENCES public.product_price(id);


--
-- Name: transaction transaction_projectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transaction
    ADD CONSTRAINT "transaction_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES public.project(id);


--
-- Name: transaction transaction_refundId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transaction
    ADD CONSTRAINT "transaction_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES public.refund(id);


--
-- Name: transaction transaction_subscriptionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transaction
    ADD CONSTRAINT "transaction_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES public.subscription(id);


--
-- Name: transfer transfer_destinationAccountId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transfer
    ADD CONSTRAINT "transfer_destinationAccountId_fkey" FOREIGN KEY ("destinationAccountId") REFERENCES public.connect_account(id);


--
-- Name: transfer transfer_sourceTransactionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transfer
    ADD CONSTRAINT "transfer_sourceTransactionId_fkey" FOREIGN KEY ("sourceTransactionId") REFERENCES public.transaction(id);


--
-- Name: usage usage_keyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usage
    ADD CONSTRAINT "usage_keyId_fkey" FOREIGN KEY ("keyId") REFERENCES public.apikey(id);


--
-- Name: usage usage_projectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usage
    ADD CONSTRAINT "usage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES public.project(id);


--
-- Name: worker worker_projectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.worker
    ADD CONSTRAINT "worker_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES public.project(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--


