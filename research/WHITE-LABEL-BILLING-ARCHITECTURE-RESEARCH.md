# White-Label Billing Architecture Research

_Research date: March 30, 2026_

---

## Executive Summary

White-label billing is a multi-layered problem involving **three parties** (Platform, Reseller, End Client) and **two billing relationships** (Platform->Reseller and Reseller->Client). The dominant architecture pattern uses **Stripe Connect** with the platform as the payment facilitator, but the specific implementation varies significantly based on how much control resellers need. The most successful platforms (GoHighLevel, Vendasta, SiteSwan, Duda) each use different billing models, and their approaches reveal critical architectural decisions that determine revenue mechanics, feature gating, and scalability.

**Key findings:**

- GoHighLevel's wallet-based rebilling system is the most sophisticated white-label billing model in the agency space, but is complex and creates friction
- Stripe Connect Custom accounts provide full white-label payment control but require the platform to handle all compliance
- The entitlements layer (feature gating) is architecturally separate from billing and should be treated as its own system
- Usage-based billing requires a 5-stage pipeline: Event Ingestion -> Metering -> Entitlements -> Rating -> Invoicing
- Revenue share models typically start at 30-40% for the technology provider, shifting to 40-60% at market leadership
- The biggest reseller pain point is billing complexity and unpredictable costs from usage-based models

---

## 1. BILLING ARCHITECTURE PATTERNS

### 1.1 The Three-Party Revenue Flow

Every white-label billing system manages money flow between three parties:

```
End Client --pays--> Reseller --pays--> Platform
     |                    |                  |
  Uses product      Sets prices,        Builds product,
  under reseller    manages clients,    sets wholesale cost,
  brand             keeps margin        handles infrastructure
```

**Two distinct billing relationships exist:**

1. **Platform -> Reseller**: Wholesale pricing (subscription + usage + per-seat fees)
2. **Reseller -> Client**: Retail pricing (set entirely by reseller with markup)

### 1.2 Four Dominant Billing Models

| Model                      | How It Works                                                                               | Who Uses It                   | Pros                                                           | Cons                                                         |
| -------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------ |
| **Flat License Fee**       | Reseller pays fixed monthly to platform. Charges clients whatever they want.               | SiteSwan, Duda, Brizy         | Simple, predictable costs for reseller. 100% margin control.   | Platform revenue doesn't scale with reseller success.        |
| **Wholesale + Markup**     | Platform charges wholesale per-product. Reseller marks up to clients.                      | Vendasta                      | Clear unit economics. Reseller picks products a la carte.      | Complex billing when many products. Per-client costs add up. |
| **Wallet-Based Rebilling** | Platform charges agency wallet for usage. Agency wallet charges client wallet with markup. | GoHighLevel                   | Automated usage pass-through. Built-in profit on every action. | Complex, confusing for clients. Wallet management overhead.  |
| **Revenue Share**          | Reseller collects from clients, remits % to platform.                                      | Payment processors, some SaaS | Aligned incentives. Low upfront cost for reseller.             | Requires auditing. Complex multi-reseller billing.           |

### 1.3 Hybrid Models (Most Common in Practice)

Most successful platforms combine models:

- **Base subscription** (flat license) + **Usage rebilling** (wallet/metered) + **Marketplace markup** (wholesale products)
- GoHighLevel: $497/mo flat subscription + wallet-based usage rebilling + per-product reselling
- Vendasta: $99-$1,579/mo subscription + per-product wholesale + monthly minimum commitment

---

## 2. STRIPE CONNECT ARCHITECTURE (TECHNICAL DEEP-DIVE)

### 2.1 Three Account Types

| Type         | Control Level                                      | White-Label?              | Platform Liability                                                       | Best For                                     |
| ------------ | -------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------ | -------------------------------------------- |
| **Standard** | Low - user has full Stripe dashboard               | No                        | None - Stripe handles everything                                         | Simple referral/affiliate models             |
| **Express**  | Medium - streamlined onboarding, limited dashboard | Partial                   | Medium - platform handles some compliance                                | Marketplaces needing quick seller onboarding |
| **Custom**   | Full - completely invisible to user                | Yes - fully white-labeled | High - platform responsible for all compliance, fraud, negative balances | White-label SaaS platforms                   |

**For white-label SaaS, Custom accounts are the correct choice** because the end user (reseller's client) never sees Stripe branding or interacts with Stripe directly.

### 2.2 Three Charge Types

#### Direct Charges

```
Client ---payment---> Connected Account (Reseller's Stripe)
                           |
                      Application Fee ---> Platform Account
```

- Payment created on connected account's Stripe
- Connected account's balance increases with every charge
- Platform collects application fee automatically
- Connected account pays Stripe processing fees
- **Best for: SaaS platforms** (like Shopify model)
- **Example**: $10 charge, $0.59 Stripe fee, $1.23 application fee = $8.18 to connected account, $1.23 to platform

#### Destination Charges

```
Client ---payment---> Platform Account
                           |
                      Transfer ---> Connected Account (minus platform fee)
```

- Payment created on platform's Stripe
- Platform balance increases, then transfers portion to connected account
- Platform pays Stripe fees
- **Best for: Marketplaces** (like Airbnb/Lyft model)

#### Separate Charges and Transfers

```
Client ---payment---> Platform Account
                           |
                      Transfer 1 ---> Connected Account A
                      Transfer 2 ---> Connected Account B
```

- Charge on platform, separate transfers to multiple connected accounts
- Enables multi-vendor splits from single transaction
- Transfer amounts can exceed charge amounts
- **Best for: Multi-vendor marketplaces** (delivery + restaurant)

### 2.3 Platform Fee Collection with Stripe Connect Billing

Stripe now supports charging SaaS subscription fees to connected accounts using Accounts v2 API:

**Architecture**: Connected accounts need dual configuration:

- `customer` configuration: allows account to pay platform subscription fees
- `merchant` configuration: enables the account to accept payments from their own customers

**Payment Method**: Connected accounts can pay subscriptions directly from their Stripe balance (avoiding processing fees) or via card on file.

**Subscription Creation Flow**:

1. Create connected account with customer + merchant configurations
2. Attach Stripe balance as payment method via SetupIntent
3. Create subscription with `customer_account` parameter pointing to connected account
4. Platform collects recurring SaaS fees automatically from connected account's Stripe balance

**Fee Responsibility Configuration**:

- `fees_collector`: `application` (platform pays) or `stripe` (connected account pays)
- `losses_collector`: `application` (platform liable) or `stripe` (connected account liable)

### 2.4 Stripe Connect Pricing

- Standard accounts: No additional Connect fees
- Express/Custom accounts: Monthly per-account fee + payout fees
- Application fees: No additional Stripe fee on top of processing fee
- Platform pricing tool: Automatically sets application fee logic

### 2.5 Stripe Connect Revenue Share Model

Stripe Connect does NOT operate as a true processing margin-share. Instead it uses **fee-on-top monetization**:

- Stripe charges merchants blended processing fee (e.g., 2.9% + $0.30)
- Platform adds application fees and/or platform fees ON TOP of Stripe's rate
- Platform revenue is driven by those added fees, scaled by transaction volume
- **Limitation**: Revenue ceiling exists -- platforms can only add so much fee before merchants push back

**Alternative**: True interchange-based revenue share (e.g., Fiska) where platforms share in the actual processing margin rather than adding fees on top.

---

## 3. GOHIGHLEVEL BILLING ARCHITECTURE (CASE STUDY)

GoHighLevel is the most relevant case study for Surgent as it's the dominant white-label platform in the agency space.

### 3.1 Overall Architecture

```
HighLevel (Platform)
    |
    |-- charges --> Agency Wallet (via HighLevel's Stripe)
    |                    |
    |                    |-- Agency Stripe charges --> Sub-Account Wallet (client)
    |                    |                                |
    |                    |                                |-- Usage deducted from wallet
    |                    |                                |-- Auto-recharge when below threshold
    |                    |
    |                    |-- Usage deducted from agency wallet at HL wholesale price
    |
    |-- NEVER charges sub-account directly
```

**Critical rule**: HighLevel's Stripe NEVER charges a sub-account wallet or card directly. Only the Agency's Stripe handles sub-account charges. This maintains the white-label boundary.

### 3.2 Three Billing Scenarios

**Scenario 1: No Rebilling (agency absorbs costs)**

- Sub-account uses services (SMS, email, AI, phone)
- HighLevel charges agency wallet at wholesale price
- Agency wallet auto-recharges from agency's card
- Client pays nothing for usage (just their subscription)

**Scenario 2: Rebilling WITHOUT Markup ($297 and $497 plans)**

- Sub-account uses services -> charges agency wallet
- Agency Stripe automatically charges sub-account card for identical amount
- Both agency and sub-account maintain separate wallets
- Net cost to agency: $0 (pass-through)

**Scenario 3: Rebilling WITH Markup ($497 plan only)**

- Sub-account uses services -> charges agency wallet at HighLevel cost
- Agency Stripe charges sub-account wallet at marked-up agency price
- Agency retains profit margin difference
- **Example**: Client sends 100 SMS worth $10 at wholesale. With 5x markup, client wallet charged $50. Agency profit: $40.

### 3.3 Wallet Mechanics

- **Wallet**: Pre-loaded virtual credits. Usage (SMS, email, AI, phone, WhatsApp) deducted as consumed.
- **Auto-Recharge**: When balance drops below threshold, system charges card on file. Example: $50 recharge amount, $25 threshold. When balance hits $24.99, card charged $50.
- **Smart Adjustment**: If auto-recharge fires 3+ times in 7 days, HighLevel automatically increases recharge amount to next tier.
- **Service Interruption**: If wallet hits $0 or goes negative, all LC services suspend until payment succeeds.
- **Card Cascade**: If primary card fails, system tries previously added cards.

### 3.4 SaaS Mode Plan Configuration

**SaaS Configurator** allows agencies to build client pricing plans:

- Plan name, description, monthly/annual pricing
- Trial period (configurable per plan)
- One-time setup fees
- Complimentary credits (immediate or post-trial)
- Feature access toggles (per plan)
- Usage limits per plan
- Rebilling markup configuration (global slider or per-service)
- Maximum 20 SaaS plans per agency account

**Feature Gating**: Location permissions applied to sub-account based on purchased plan's feature set. Admin can later toggle features in "Enable/Disable Products" section.

**Rebilling Markup Configuration**: Global slider sets one multiplier across all services, OR individual sliders for fine-grained control per service.

### 3.5 Customer Onboarding Flow (Automated)

1. Client purchases plan via 2-step order form (card payments only)
2. Sub-account/location automatically created using customer name
3. User account generated with email and auto-generated password
4. Permissions applied per plan configuration
5. SaaS Mode enabled on sub-account
6. Twilio rebilling activated per plan settings
7. Welcome email sent with login credentials

### 3.6 Stripe Integration

- Only Stripe works for SaaS products (PayPal not supported)
- Plans created in agency's Stripe account via SaaS Configurator
- Plans must NOT be deleted from Stripe after creation
- Currency can be changed but not after active subscription exists
- Tax handling: agency configures rates in Stripe (inclusive or exclusive)

### 3.7 Key Limitations and Problems

- Wallet system confusing for end clients
- Usage-based rebilling creates unpredictable costs for clients
- Twilio rebilling only works in USD regardless of plan currency
- Sub-accounts won't create if: price isn't SaaS-designated, purchase in test mode, using non-Stripe payment, or email already has associated account
- Max 20 SaaS plans per agency
- No PayPal for SaaS products

---

## 4. VENDASTA BILLING ARCHITECTURE (CASE STUDY)

### 4.1 Overall Model

Vendasta uses a **wholesale marketplace + monthly minimum** model:

```
Vendasta Platform
    |
    |-- Monthly subscription ($99-$1,579/mo)
    |-- Monthly minimum commitment
    |-- Wholesale product charges (per client, per month)
    |
    v
Agency/Reseller
    |
    |-- Sets own retail prices (8-15x markup typical)
    |-- Bills clients directly via Stripe integration
    |-- Invoices clients on subscription/renewal dates
    |
    v
End Client
```

### 4.2 Billing Mechanics

- **Monthly Invoice**: At beginning of every month, Vendasta invoices for all products activated/renewed in previous month + current month subscription
- **Payment Terms**: Net 10, automatic credit card charges
- **Monthly Minimum**: Agency commits to minimum monthly spend. Qualifying Vendasta-owned products (Conversations AI, Reputation AI) count toward minimum.
- **Wholesale Pricing**: Each product has a wholesale cost that varies by subscription tier. Higher tiers = better wholesale discounts.
- **Reseller Markup**: Agencies mark up however they want. Many generate 8-15x markup when bundled strategically.
- **Per-Seat Charges**: Additional $15-$65/seat/month depending on tier.
- **Onboarding Fees**: $750-$1,500 for higher tiers (waived with annual commitment).

### 4.3 Client Billing

- Partners bill clients directly
- Stripe-based payment collection recently added (US/Canada only)
- Invoice generation tied to client subscription/renewal dates
- Partner can add own products/services alongside Vendasta marketplace products

### 4.4 Referral Commissions

Partners earn up to 30% recurring revenue per new partner referred.

---

## 5. OTHER PLATFORM BILLING MODELS

### 5.1 SiteSwan (Per-Site Licensing)

- **Model**: Flat monthly fee per site, bulk pricing tiers
- **Agency Plan**: Up to 10 sites at $19.90/mo per site
- **Professional Plan**: Up to 100 sites at $4.99/mo per site (additional at $5/mo)
- **Pro Plan**: As low as $3/mo per site at volume
- **Reseller Revenue**: Set own prices, keep 100% of sales. Typical: $500-$1,500 upfront + monthly hosting fee to client.
- **Simplicity**: No usage-based billing, no wallets, no rebilling. Pure license model.

### 5.2 Duda (Feature-Gated Plan Tiers)

- **Model**: Plan tiers unlock features; sites are add-ons
- **White Label Plan**: $149/mo, includes 4 sites. Additional sites $17/mo each.
- **Custom Plan**: Negotiated tiered pricing per site based on volume
- **Reseller Billing**: Collect one-time and recurring payments through Duda under reseller brand
- **Feature Gating**: White-label features only available on White Label and Custom plans

### 5.3 Sellful (Minimum Per-Account)

- **Model**: Monthly subscription + minimum per sub-account
- **Plans**: $129-$599/month
- **Minimum**: Agencies must charge at least $9/mo per sub-account
- **Client Billing**: Handled within the platform

---

## 6. FEATURE GATING & ENTITLEMENTS ARCHITECTURE

### 6.1 The Entitlements Layer

The entitlements layer sits **between billing and the product runtime**:

```
Identity Provider (who is this user?)
        |
        v
Entitlement System (what can this account access?)
        |                    |
        v                    v
  Billing System        Product Runtime
  (Stripe, etc.)        (features, APIs)
```

**Four types of entitlements:**

| Type              | Example                           | Implementation                      |
| ----------------- | --------------------------------- | ----------------------------------- |
| **Feature Gates** | "Can this account export to PDF?" | Binary on/off flag per plan         |
| **Usage Limits**  | "10,000 API calls per month"      | Counter with threshold check        |
| **Seat-Based**    | "25 purchased seats"              | User count check against plan limit |
| **Rate Limits**   | "100 requests per minute"         | Operational constraint tied to tier |

### 6.2 Entitlement System Architecture Components

1. **System of Record**: Centralized data store with plans, limits, add-ons, and account-specific overrides as structured data (NOT hard-coded feature checks)
2. **Evaluation Engine**: Processes access checks at runtime. Inputs: account ID, plan reference, usage counters, subscription status, account attributes. Output: allow/deny.
3. **Enforcement Points**: API endpoints, UI rendering, background tasks -- anywhere access decisions are made
4. **Billing Integration**: Subscription state changes automatically update access decisions

### 6.3 Data Model Elements

The entitlement system tracks:

- Active subscription plans with bundled features and limits
- Metered usage counters (API calls, tokens, storage, seats)
- Time-bound entitlements (trial expiration, contract windows)
- Prepaid credit balances with deduction mechanics
- Enterprise-specific overrides with effective dates

### 6.4 Stripe Entitlements API

Stripe now offers a native Entitlements API:

**Feature Definition**:

```
stripe entitlements features create --lookup-key="feature_id" --name="Display Name"
```

**Linking Features to Products**:

```
stripe product_features create "prod_xxx" --entitlement-feature="feat_xxx"
```

**Runtime Check**:

```
stripe entitlements active_entitlements list --customer="cus_xxx" --expand "data.feature"
```

**Webhook Event**: `entitlements.active_entitlement_summary.updated` fires when permissions change (subscription upgrade, downgrade, cancellation).

**Example Tier Structure**:

- Free: "View free articles" feature
- Personal ($98/mo): "View free articles" + "View paid articles"
- Business ($980/mo): All three features

### 6.5 Feature Flags vs. Entitlements

| Aspect          | Feature Flags                   | Entitlements                    |
| --------------- | ------------------------------- | ------------------------------- |
| Purpose         | Test readiness, gradual rollout | Control access based on payment |
| Scope           | Per-user or percentage-based    | Per-account/subscription        |
| Source of truth | Feature flag service            | Billing system                  |
| Change trigger  | Developer/PM decision           | Subscription event              |

**Integration Pattern**: Connect feature flag service to billing via webhooks. When `customer.subscription.updated` fires in Stripe, update user's flag targeting context with new tier. Feature access changes propagate within seconds.

**Critical**: Use **server-side evaluation** for subscription tier gating, entitlement checks, API rate limiting. Client-side flags can be tampered with.

### 6.6 Implementation Best Practices

- Separate account-level entitlements from user-level permissions
- Evaluate entitlements at request-time rather than caching decisions
- Record all usage events for billing alignment
- Support account-specific overrides without branching application logic
- Maintain audit trails for compliance when terms change
- Define entitlement schema early, choose right granularity without over-engineering
- Business teams should define meters, entitlements, and catalog mappings. Engineering emits events once, then steps out of the loop.

---

## 7. USAGE-BASED BILLING PIPELINE

### 7.1 Five-Stage Architecture

```
Event Ingestion --> Metering --> Entitlements --> Rating --> Invoicing
       |               |              |              |           |
   Capture raw    Aggregate to    Check limits    Calculate    Generate
   events         billable units  and allowances  charges      invoice
```

Each layer handles a single responsibility and connects through well-defined interfaces. Pricing changes don't touch ingestion. Entitlement changes don't require billing rewrites.

### 7.2 Event Ingestion Layer

- Accepts flexible JSON payloads without rigid schema enforcement
- Any attribute can be added on-the-fly and stored at full fidelity
- Example: Track API calls, messages sent, storage used, AI tokens consumed
- Must be high-throughput and never miss an event (lost records = billing disputes)

### 7.3 Metering Engine

- Processes raw events into billable units
- Applies aggregation logic and filtering rules independently from ingestion
- Supports separate meters for different product types (e.g., GPT-5 vs GPT-4 usage)
- Filtering by attributes in the UI without code changes

### 7.4 Entitlements Engine

- Configurable usage limits and allowances per subscription tier
- Example: "1,000 GPT-5 tokens included monthly, $0.02 per additional token"
- Configured through UI without code changes
- Handles overage: block, allow with overage pricing, or notify

### 7.5 Rating Engine

- Calculates charges based on complex pricing models
- Supports: tiered pricing, usage-based billing, volume discounts
- Converts metered usage into monetary charges
- Must handle: per-unit, tiered, graduated, and hybrid pricing

### 7.6 Invoicing

- Calculates final charges based on subscription plans, usage, and applicable discounts/taxes
- Creates invoices detailing services used and amounts due
- Handles proration for mid-cycle changes
- Generates at billing period end or on-demand

### 7.7 Beyond Billing

Usage data also powers:

- Lifecycle campaigns (expansion opportunities)
- Churn prediction
- Customer health scoring
- Real-time dashboards for resellers and their clients

---

## 8. UPGRADE/DOWNGRADE HANDLING

### 8.1 Core Rules

**Upgrades**: Always immediate. Prorated. Customer charged the difference for remainder of billing period.

**Downgrades**: Two approaches:

1. **Immediate** with credit for unused time (Slack, Notion model)
2. **Scheduled** for end of billing period (Zoom, GitHub model)

### 8.2 Implementation Patterns

**Separate Change Tracking**: Store each subscription modification independently. Enables selective cancellation without tangled dependencies.

**Stripe Subscription Schedules**:

- Current state in `phase[0]`
- Pending changes in `phase[1]`
- Set end behavior to `release` so schedules terminate after execution
- Prevents race conditions where Stripe invoices before your system detects scheduled changes

**Webhook-Driven Sync**: Listen to `customer.subscription.updated` to confirm Stripe executed scheduled changes. Mark completed schedules as "Done" in your database.

### 8.3 Handling Contradictory Changes

When customer requests conflicting modifications (tier downgrade + unit upgrade):

1. Execute upgrades immediately with prorated charges
2. Cancel conflicting downgrades
3. Schedule new downgrades reflecting updated quantities

**Example**: Customer with 5 scheduled seats reduces to 4, then adds 2 team members before period end. Cancel the 4-seat schedule, charge immediately for new 6-seat total.

### 8.4 What Executes Immediately vs. Scheduled

| Change Type           | Timing                |
| --------------------- | --------------------- |
| Tier upgrades         | Immediate (prorated)  |
| Unit/add-on increases | Immediate (prorated)  |
| Monthly to annual     | Immediate             |
| Tier downgrades       | End of billing period |
| Unit reductions       | End of billing period |
| Add-on removals       | End of billing period |
| Annual to monthly     | End of billing period |

### 8.5 Product Archive Management

When archiving pricing plans, find all affected subscription schedules and recreate them with current product versions. Prevents schedules from referencing deprecated pricing data.

---

## 9. TRIAL & ONBOARDING BILLING FLOWS

### 9.1 Trial Models

| Model                         | How It Works                           | Conversion                        |
| ----------------------------- | -------------------------------------- | --------------------------------- |
| **Free Trial (no card)**      | Full access, card collected at end     | Lower barrier, lower conversion   |
| **Free Trial (card upfront)** | Full access, auto-converts             | Higher barrier, higher conversion |
| **Freemium**                  | Limited features forever, pay for more | Long nurture, high volume needed  |
| **Reverse Trial**             | Start on highest tier, downgrade after | Users experience full value       |

**Best practice** (from multiple sources): Start every customer on a free trial of the highest plan, giving them ability to use and experience nearly all features. Typical duration: 14 or 30 days.

### 9.2 Trial Billing Mechanics

- Trial period configurable per plan and per pricing variant (monthly/yearly)
- Complimentary credits can be issued immediately upon signup or after trial period ends
- No charges during trial period; subscription activates on trial end
- Card collection during trial varies by platform (GoHighLevel requires card upfront)

### 9.3 Automated Onboarding (GoHighLevel Example)

1. Client purchases via order form -> payment processed
2. Sub-account auto-created with plan permissions
3. User account generated with credentials
4. Welcome email sent with login instructions
5. Rebilling activated per plan settings
6. Credits issued per configuration (immediate or post-trial)

---

## 10. DUNNING & FAILED PAYMENT RECOVERY

### 10.1 How Dunning Works

Dunning combines automated payment retries with customer communications. Can recover 50-80% of failed payments.

### 10.2 Automated Retry Strategies

- **Stripe Smart Retries**: ML-optimized timing based on failure codes, card type, customer location, day of week
- **Scheduled retries**: First attempt 24+ hours after failure, second on following Sunday
- **Card cascade**: If primary card fails, try previously added cards
- **Timezone-aware**: Retries and emails triggered based on customer's local timezone

### 10.3 White-Label Dunning Requirements

- Custom-branded emails matching reseller's tone and visual identity
- In-app payment reminders under reseller brand
- Self-service payment update portal (white-labeled)
- Escalation workflows (email -> in-app -> service suspension)

### 10.4 Service Suspension on Failed Payment

GoHighLevel approach: If wallet reaches $0 or goes negative, LC services suspend until successful payment reloads wallet. This is aggressive but effective.

---

## 11. PRICING STRATEGIES FOR RESELLERS

### 11.1 What Resellers Actually Charge

- 85% of agency owners resell white-labeled software for **$100-$700/month** per client
- GoHighLevel agencies typical tiers: Basic $97/mo, Standard $197/mo, Premium $297-$497/mo
- Vendasta agencies achieve **8-15x markup** on wholesale marketplace products when bundled
- SiteSwan resellers charge **$500-$1,500 upfront** + monthly hosting fee

### 11.2 Pricing Models Available to Resellers

| Model                  | Description                          | Best For                       |
| ---------------------- | ------------------------------------ | ------------------------------ |
| **Flat rate**          | One price, all features              | Simple offerings, low support  |
| **Tiered**             | 3-5 packages with different features | Most common for agencies       |
| **Per-user/seat**      | Price scales with team size          | B2B clients with growing teams |
| **Per-location**       | Price per business location          | Multi-location businesses      |
| **Usage-based**        | Pay per action (SMS, emails, AI)     | High-volume, variable usage    |
| **Per-feature/module** | Base + add-ons                       | Clients wanting customization  |
| **Hybrid**             | Base subscription + usage + add-ons  | Maximum flexibility            |

### 11.3 Common Reseller Pricing Challenges

1. **Pricing too high**: Losing deals to competitors
2. **Pricing too low**: Unsustainable margins, can't afford support
3. **Usage unpredictability**: Clients fear escalating costs from usage-based models
4. **Billing complexity**: Multiple models create confusion for clients
5. **Margin erosion**: Platform price changes or hidden fees eat into margins
6. **Support burden**: Clients see reseller as provider for ALL issues, including billing
7. **Currency issues**: Some platforms only rebill in USD regardless of client currency

---

## 12. REVENUE SHARE ECONOMICS

### 12.1 Value Distribution Framework

| Phase                    | Provider Gets                  | Partner Gets |
| ------------------------ | ------------------------------ | ------------ |
| **Market Entry**         | 20-30% of final customer value | 70-80%       |
| **Market Establishment** | 30-45%                         | 55-70%       |
| **Market Leadership**    | 40-60%                         | 40-60%       |

### 12.2 Revenue Share Structures

**Revenue-based**: Reseller collects from clients, remits percentage to platform

- Start: 30-40% to technology provider
- Scale: Performance incentives adjust split based on volume or account size

**Fee-on-top (Stripe Connect model)**: Platform adds fees on top of payment processing

- Stripe charges base rate (2.9% + $0.30)
- Platform adds application fee per transaction
- Revenue limited by how much fee merchants will tolerate

**Wholesale markup**: Platform sells at wholesale, reseller sets retail price

- Vendasta: agencies get better wholesale discounts at higher subscription tiers
- Typical markup: 3-15x depending on product and bundling strategy

### 12.3 Implementation Guardrails

- **Minimum Commitments**: $10,000-$100,000 annually for enterprise white-label deals
- **Maximum Discount Limitations**: Cap partner discounts at 30-40% below standard market rates
- **Setup Fees**: One-time integration/onboarding: $5,000-$50,000 for enterprise
- **Referral Commissions**: 10-30% recurring revenue per referred partner

### 12.4 Usage-Based Revenue Share Growth

Usage-based white-label arrangements grow **28% faster** than flat-fee models, though with higher administrative overhead.

---

## 13. MULTI-TENANT BILLING DATABASE ARCHITECTURE

### 13.1 Core Data Model

```
Organizations (tenants)
  |-- Subscriptions (plan, status, billing period)
  |     |-- Subscription Items (line items, quantities)
  |     |-- Invoices (charges, tax, discounts)
  |     |-- Payment Methods (cards, bank accounts)
  |
  |-- Entitlements (features, limits, overrides)
  |     |-- Feature Flags (boolean per plan)
  |     |-- Usage Meters (counter per period)
  |     |-- Seat Limits (max users per plan)
  |
  |-- Usage Events (raw events, timestamps, attributes)
  |
  |-- Wallets (balance, auto-recharge config, transaction history)
```

### 13.2 Parent-Child Tenant Hierarchy

For white-label with resellers:

```
Platform (root)
  |
  |-- Reseller A (parent tenant)
  |     |-- Client 1 (child tenant)
  |     |-- Client 2 (child tenant)
  |     |-- Client 3 (child tenant)
  |
  |-- Reseller B (parent tenant)
        |-- Client 4 (child tenant)
        |-- Client 5 (child tenant)
```

**Key architectural decisions:**

- Every tenant-specific table includes `tenant_id` and often `created_by_user_id`
- Parent admins view/manage billing for all child tenants
- Local admins manage only their department/sub-account
- Usage aggregation rolls up from child to parent level
- Consolidated invoicing (single invoice for all children) OR split invoicing (separate per child)

### 13.3 Billing Isolation

- Each child tenant maintains independent: user memberships, subscription plans, resource allocations, usage metrics
- Parent organization handles: master service agreements, consolidated reporting, global user management
- Decentralized budgets: each department manages own subscription tier
- Variable access: different teams use different feature tiers

### 13.4 Microservices Architecture

Modern billing systems decompose into independent services:

- **Subscription Service**: Plan management, lifecycle events
- **Metering Service**: Usage event ingestion and aggregation
- **Rating Service**: Price calculation based on usage and plan
- **Invoice Service**: Invoice generation and delivery
- **Payment Service**: Payment processing and retry logic
- **Entitlement Service**: Feature access control
- **Notification Service**: Dunning emails, usage alerts

Each communicates via APIs and webhooks. Changes to pricing don't affect metering. Changes to entitlements don't require billing rewrites.

---

## 14. ARCHITECTURAL DECISION: STRIPE CONNECT VS. DIRECT BILLING

### 14.1 When to Use Stripe Connect

| Use Case                                              | Recommendation                                                |
| ----------------------------------------------------- | ------------------------------------------------------------- |
| Resellers need to collect payments from their clients | Stripe Connect (Custom accounts)                              |
| Platform charges resellers a subscription             | Stripe Connect Billing or direct Stripe Billing               |
| Multi-party payment splitting                         | Stripe Connect with destination charges or separate transfers |
| Full white-label payment experience                   | Stripe Connect Custom accounts                                |
| Resellers want their own payment dashboard            | Stripe Connect Standard or Express                            |

### 14.2 When to Use Direct Billing (No Connect)

| Use Case                                                             | Recommendation                               |
| -------------------------------------------------------------------- | -------------------------------------------- |
| Platform bills resellers directly, resellers bill clients separately | Direct Stripe Billing for both relationships |
| Simple SaaS subscription, no payment pass-through                    | Standard Stripe Billing                      |
| Platform wants to own the entire payment relationship                | Direct billing, no Connect                   |

### 14.3 Pros/Cons Comparison

**Stripe Connect**:

- (+) Quick time to market, excellent documentation
- (+) Built-in onboarding and verification for connected accounts
- (+) Application fees for platform revenue
- (+) Full white-label with Custom accounts
- (-) Per-account monthly fees for Express/Custom
- (-) Platform liable for connected account negative balances (Custom)
- (-) Revenue ceiling on fee-on-top model
- (-) Limited branding/UI customization compared to building own

**Direct Billing (platform bills reseller, reseller has own Stripe)**:

- (+) Simpler architecture
- (+) Reseller has full control of their own Stripe
- (+) No platform liability for client payment issues
- (-) No automated payment splitting
- (-) Reseller must manage all client billing themselves
- (-) Platform has no visibility into reseller-client transactions

### 14.4 The GoHighLevel Approach (Hybrid)

GoHighLevel uses a hybrid: Agency connects their OWN Stripe account. HighLevel charges the agency wallet directly. The agency's Stripe charges the sub-account. This means:

- HighLevel doesn't use Stripe Connect for client billing
- The agency's Stripe is independent
- HighLevel only bills the agency directly for usage
- The agency handles all client billing through their own Stripe (facilitated by GHL's SaaS mode)

This avoids Stripe Connect complexity while still automating client billing.

---

## 15. MODULAR / PER-FEATURE PRICING ARCHITECTURE

### 15.1 How Module-Based Pricing Works

```
Base Platform Fee ($X/mo)
  |
  +-- Module A: Website Builder (+$Y/mo)
  +-- Module B: CRM (+$Z/mo)
  +-- Module C: Email Marketing (+$W/mo)
  +-- Module D: AI Chatbot (+$V/mo)
  |
  +-- Usage Add-ons:
        +-- Extra SMS: $0.02/message
        +-- Extra AI tokens: $0.01/1K tokens
        +-- Extra storage: $1/GB
```

### 15.2 Implementation Approach

**Feature Flagging System**: Centralized system that instantly enables/disables modules across different branded domains without code deployment.

**Catalog Structure**:

- **Products**: Individual modules (Website, CRM, Email, etc.)
- **Prices**: Per-product pricing (monthly, annual, usage-based)
- **Plans/Bundles**: Pre-configured combinations at discount
- **Add-ons**: Optional extras purchasable independently

**Database Pattern**:

```
Plans
  |-- plan_id, name, base_price
  |-- PlanFeatures (plan_id, feature_id, enabled, limit)

Features
  |-- feature_id, name, lookup_key, type (boolean/metered/seat)

Subscriptions
  |-- subscription_id, tenant_id, plan_id, status
  |-- SubscriptionAddons (subscription_id, feature_id, quantity)

Entitlements (computed view)
  |-- tenant_id, feature_id, access_level, usage_limit, current_usage
```

### 15.3 Pricing Component Structure

- **Base access**: Per org/tenant fee
- **Per-user/per-unit consumption**: Scales with usage
- **Optional add-ons**: Advanced features, premium support
- **Hybrid**: Base licensing fee + commission on premium feature usage

### 15.4 Reseller Flexibility

Resellers should be able to:

- Create their own pricing tiers using platform modules
- Bundle modules differently than the platform suggests
- Set custom prices for each module/bundle
- Toggle modules on/off per client plan
- Apply custom discounts or promotional pricing
- Offer different trial configurations per plan

---

## 16. KEY TAKEAWAYS FOR SURGENT

### 16.1 Architecture Recommendations

1. **Use a hybrid billing model**: Base subscription (flat) + usage-based rebilling + modular add-ons
2. **Don't use Stripe Connect for client billing** (follow GHL model): Let resellers connect their own Stripe. Platform charges reseller directly. Reseller's Stripe charges clients.
3. **Build entitlements as a separate layer**: Not hard-coded in application logic. Centralized system of record with runtime evaluation engine.
4. **Feature flagging for plan gating**: Server-side evaluation. Webhook-driven sync with billing events. No code deployment needed to change plans.
5. **Wallet system for usage**: Prepaid credits, auto-recharge, per-service metering. But make it simpler and more transparent than GHL's.
6. **Five-stage billing pipeline**: Ingestion -> Metering -> Entitlements -> Rating -> Invoicing. Each layer independent.

### 16.2 Critical Differentiators vs. GHL

1. **Simpler billing UX**: GHL's wallet system is confusing. Make usage costs transparent and predictable.
2. **Module-based pricing**: Let resellers build custom packages from individual modules (website, social, marketing, CRM, AI). GHL bundles everything.
3. **Better trial management**: Support reverse trials (start on highest tier), flexible trial durations per module.
4. **Multi-currency native**: Don't force USD for usage rebilling.
5. **Self-service pricing builder**: Let resellers visually build and preview pricing pages for their clients.
6. **Real-time usage dashboards**: Both reseller and client can see usage, projected costs, and alerts.

### 16.3 Revenue Model Options for Surgent

| Model                    | Platform Revenue                     | Reseller Experience                |
| ------------------------ | ------------------------------------ | ---------------------------------- |
| **Flat subscription**    | Predictable, limited upside          | Simple to understand               |
| **Per-client fee**       | Scales with reseller growth          | Fair, aligned                      |
| **Usage-based margin**   | Scales with actual usage             | Complex but transparent            |
| **Hybrid (recommended)** | Base sub + per-client + usage margin | Predictable base + variable upside |

**Recommended**: $X/mo base subscription to platform + $Y/mo per active client + usage costs at wholesale with reseller markup capability.

---

## Sources

### Stripe Documentation

- [Build a SaaS Platform with Stripe Connect](https://docs.stripe.com/connect/saas)
- [Stripe Connect Account Types](https://docs.stripe.com/connect/accounts)
- [Charge Types in Connect](https://docs.stripe.com/connect/charges)
- [Direct Charges](https://docs.stripe.com/connect/direct-charges)
- [Destination Charges](https://docs.stripe.com/connect/destination-charges)
- [Charge SaaS Fees to Connected Accounts](https://docs.stripe.com/connect/integrate-billing-connect)
- [Stripe Entitlements API](https://docs.stripe.com/billing/entitlements)
- [Stripe Connect Pricing](https://stripe.com/connect/pricing)
- [Automate Payment Retries (Smart Retries)](https://docs.stripe.com/billing/revenue-recovery/smart-retries)
- [Managing SaaS Access Control with Stripe Entitlements API](https://stripe.dev/blog/managing-saas-access-control-with-stripe-entitlements-api)

### GoHighLevel

- [SaaS Mode Full Setup Guide](https://help.gohighlevel.com/support/solutions/articles/48001184920-saas-mode-full-setup-guide-faq)
- [Rebilling, Reselling, and Wallets Explained](https://help.gohighlevel.com/support/solutions/articles/155000002095-rebilling-reselling-and-wallets-explained)
- [SaaS Plan Creation and Customer Onboarding Guide](https://help.gohighlevel.com/support/solutions/articles/155000003670-guide-to-saas-plan-creation-sales-and-customer-onboarding)
- [Wallet Auto Recharge Guide](https://help.gohighlevel.com/support/solutions/articles/155000005620-wallet-auto-recharge-smart-adjustment-and-cancellation)
- [SaaS Configurator Onboarding](https://help.gohighlevel.com/support/solutions/articles/155000004199-saas-configurator-onboarding)
- [HighLevel SaaS Mode in 2026](https://ghl-services-playbooks-automation-crm-marketing.ghost.io/gohighlevel-saas-mode-setup-pricing-and-growth-strategy-guide-for-agencies/)

### Vendasta

- [Vendasta Pricing](https://www.vendasta.com/pricing/)
- [Vendasta Marketplace](https://www.vendasta.com/marketplace/)
- [Vendasta Review 2024 (Uncensored)](https://devonhennig.com/blog/vendasta-review/)
- [Vendasta Payment Processing](https://www.vendasta.com/newsroom/payment-processing/)

### Entitlements & Feature Gating

- [Entitlement Management System (Schematic)](https://schematichq.com/blog/entitlement-management-system)
- [The Entitlements Layer (Schematic)](https://schematichq.com/blog/the-entitlements-layer-how-saas-products-control-customer-access)
- [Feature Gating - 8 Ways to Implement It (Stigg)](https://www.stigg.io/blog-posts/feature-gating)
- [SaaS Feature Flags Guide 2026](https://designrevision.com/blog/saas-feature-flags-guide)

### Billing Architecture

- [Billing System Architecture for SaaS (Orb)](https://www.withorb.com/blog/billing-architecture)
- [Usage-Based Billing Architecture (Chargebee)](https://www.chargebee.com/blog/usage-based-billing-architecture-pricing-agility/)
- [Multi-Tenant Billing Architecture (Kinde)](https://www.kinde.com/learn/billing/billing-infrastructure/multi-tenant-billing-architecture-scaling-b2b-saas-across-enterprise-hierarchies/)
- [AWS SaaS Metering and Billing](https://aws.amazon.com/blogs/apn/building-a-third-party-saas-metering-and-billing-integration-on-aws/)

### Upgrade/Downgrade Flows

- [Upgrade/Downgrade Implementation Guide (Stigg)](https://www.stigg.io/blog-posts/the-only-guide-youll-ever-need-to-implement-upgrade-downgrade-flows-part-2)

### Pricing Strategy

- [How to Price White-Label Software (Cloud Campaign)](https://www.cloudcampaign.com/blog/how-to-price-white-label-software)
- [White-Label Pricing Models (Monetizely)](https://www.getmonetizely.com/articles/white-label-pricing-models-maximizing-value-when-licensing-your-technology)
- [White Label SaaS Pricing for Resellers (SmartSaaS)](https://smartsaas.works/blog/post/white-label-saas-pricing-how-to-set-model-for-resellers/118)

### Revenue Share & Payment Processing

- [Stripe Connect Revenue Share (Fiska)](https://fiska.com/blog/stripe-connect-revenue-share/)
- [Ultimate Guide to White Label Payment Processing (Swipesum)](https://www.swipesum.com/insights/the-ultimate-guide-to-white-label-payment-processing)
- [White-Label Payment Gateways (Stripe)](https://stripe.com/resources/more/white-label-payment-gateways)

### Dunning & Recovery

- [Subscription Dunning: Recover 80% of Failed Payments (ProsperStack)](https://prosperstack.com/blog/subscription-dunning/)
- [SaaS Trial Management (Chargebee)](https://www.chargebee.com/subscription-management/saas-trial-management/)

### Platform Examples

- [SiteSwan Reseller Pricing](https://www.siteswan.com/pricing)
- [Duda White Label](https://www.duda.co/website-builder/white-label)
- [Sellful Pricing](https://sellful.com/pricing/)
- [Best White-Label Payment Gateway Solutions 2026 (SDK.finance)](https://sdk.finance/blog/top-white-label-payment-gateway-providers/)
