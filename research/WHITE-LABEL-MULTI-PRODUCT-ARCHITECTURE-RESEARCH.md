# White-Label Multi-Product Platform Architecture Research

**Date:** 2026-03-30
**Purpose:** Understanding how companies build suites of tools that can be white-labeled individually (standalone) or together (bundled)

---

## Table of Contents

1. [Architectural Patterns Overview](#1-architectural-patterns-overview)
2. [Multi-Tenant Architecture Deep Dive](#2-multi-tenant-architecture-deep-dive)
3. [How Companies Structure Products: Standalone vs. Bundled](#3-how-companies-structure-products-standalone-vs-bundled)
4. [Authentication & Shared Identity](#4-authentication--shared-identity)
5. [Branding & Theming Architecture](#5-branding--theming-architecture)
6. [Billing & Entitlements](#6-billing--entitlements)
7. [Feature Flags & Entitlement Gating](#7-feature-flags--entitlement-gating)
8. [Shared Data Layer Between Products](#8-shared-data-layer-between-products)
9. [Real-World Platform Deep Dives](#9-real-world-platform-deep-dives)
10. [Technical Implementation Patterns](#10-technical-implementation-patterns)
11. [Key Takeaways & Recommendations](#11-key-takeaways--recommendations)

---

## 1. Architectural Patterns Overview

### Three Core Architecture Models

**A. Composable / MACH Architecture**

- MACH = Microservices, API-first, Cloud-native, Headless
- Products are built as Packaged Business Capabilities (PBCs) -- self-contained business functions that bundle multiple microservices, APIs, and UIs together
- Each PBC delivers a specific business capability (e.g., checkout, CRM, social media management) and can be independently developed, deployed, and replaced
- Products communicate through well-defined APIs; no product directly accesses another's database
- An orchestration hub or workflow engine routes data and business logic across modules
- Event-driven architecture enables loose coupling: when a user signs up or makes a purchase, it triggers events that other services subscribe to

**B. Monolith with Modular Feature Flags**

- Single codebase with all products built in
- Features toggled on/off per tenant via configuration
- Simpler to build initially; used by GoHighLevel
- Feature access per plan configured in a central "SaaS Configurator"
- For 99% of early-stage products, a properly architected monolith is optimal

**C. Marketplace / Extension Layer**

- Core platform provides shared infrastructure (auth, billing, SSO, notifications)
- Third-party vendors plug in via APIs and SDKs
- Used by Vendasta (250+ products from different vendors)
- Platform acts as the identity provider; vendor products are service providers

### Key Distinction: Composable vs. Microservices

- Microservices focus on **technical decomposition** -- breaking applications into small, deployable services
- Composable architecture extends that idea by **mapping software components to business capabilities** that can be assembled, governed, and evolved strategically
- Microservices break systems apart; composable architecture brings them back together around the structure of the business itself

---

## 2. Multi-Tenant Architecture Deep Dive

### Three Database Strategies

**Strategy 1: Shared Database, Shared Schema**

- All tenants coexist in identical tables with `tenant_id` columns
- Ideal for startups/MVPs; minimizes infrastructure costs
- Risk of data leakage; requires strict query filtering
- Implementation: PostgreSQL Row-Level Security (RLS)

```sql
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON orders
  USING (tenant_id = current_setting('app.current_tenant')::uuid);
```

**Strategy 2: Shared Database, Separate Schemas**

- Each tenant gets a dedicated schema within a single database
- Balances isolation with resource efficiency
- Schema migrations become operationally challenging at scale

**Strategy 3: Separate Databases (per tenant)**

- Enterprise-grade isolation; each tenant on independent database instances
- Used by Atlassian Cloud (one database per tenant across 200,000+ customers)
- Maximum security boundaries but substantial DevOps overhead

**Recommended Progression:**

- Start with shared databases + strict tenant scoping (RLS)
- Migrate enterprise customers to isolated databases for SLA compliance
- Use a hybrid-sharded configuration where tenants can be moved between shared and exclusive databases based on resource requirements

### Tenant Context Architecture

Every layer needs tenant context. The authentication and authorization experience should bind tenant identity to the authenticated user, yielding a "SaaS identity" passed through all system layers.

**Atlassian's Tenant Context Service (TCS):**

- Central tenant ID linked to metadata: which databases contain data, licensed products, accessible features, configuration info
- When customers access any product, TCS collates metadata and links it with all operations throughout the session
- All service access requires tenant context validation; requests without it are rejected

### Data Isolation Enforcement

- Application layer: Global scopes/middleware that auto-filter by tenant_id
- Database layer: RLS policies as a safety net
- Cache layer: Tenant-prefixed Redis keys
- Connection pooling: PgBouncer configured per-tenant
- Read replicas for analytics-heavy tenants

---

## 3. How Companies Structure Products: Standalone vs. Bundled

### Pattern A: Unified Platform with Hubs (HubSpot Model)

- **Shared CRM is the data layer**: HubSpot's Smart CRM is the system of record connecting all products
- **Six hubs**: Marketing Hub, Sales Hub, Service Hub, Content Hub, Data Hub, Commerce Hub
- Each hub has a built-in connection to the Smart CRM foundation
- Marketing, Sales, and Service all work from the **same activity log**
- Hubs can be purchased independently or via "Create-a-Bundle" feature mixing hubs from different tiers
- Architecture establishes how hubs communicate, what data they share, and how handoffs happen between teams

### Pattern B: Standalone Products with Shared Services (Atlassian Model)

- Products (Jira, Confluence, Bitbucket, etc.) are standalone but share:
  - **Identity**: Common "Atlassian account" system; single authentication session across all products
  - **Session Service + Edge Authenticator**: User moves freely between products without re-authenticating
  - **Shared platform services**: Request routing, multi-tenant context management, auth, binary storage, data lakes, logging, request tracing, observability
  - **Commerce, Identity, Media platforms** consumed across multiple products
- Each product consists of multiple containerized microservices
- Each microservice owns its own data storage accessible only via its own authentication protocol
- A "site" is the container of multiple products licensed to a customer (site-name.atlassian.net)

### Pattern C: Marketplace Model (Vendasta)

- Core platform provides: user management, billing, notifications, logins, SSO
- 250+ products from multiple vendors organized into categories (marketing, operations, communication, commerce)
- Partners build bundles from the marketplace: 3-5 products per bundle recommended
- Products include both DIY tools (website builders, social schedulers, ad platforms) and services (SEO, website production)
- SSO integration via OAuth2 3-legged flow; Vendasta acts as Identity Provider
- Each vendor product has a Service Provider ID (e.g., "RM" for Reputation Management, "MP-\*" for marketplace apps)

### Pattern D: Monolith with Sub-Accounts (GoHighLevel)

- Single platform with all features built in
- Each client gets a dedicated sub-account -- a private workspace containing CRM, funnels, email, calendar, contacts
- Zero data bleed between clients; clean reporting per business
- Feature access controlled via "SaaS Configurator" per plan
- "Snapshots" allow copying entire sub-account configurations to new clients (eliminates 10-40 hours of manual setup)
- White-labeling: clients log in at custom domain, see agency's brand -- logo, colors, favicon

### Pattern E: Unified Platform Built on Single Data Model (Zoho One)

- 45+ applications built on a unified and integrated data layer
- Shared AI, search, analytics, and messaging services scale alongside users
- Apps grouped into Spaces (HR, Marketing, Finance, etc.)
- Integration through Flow (no-code), Sigma (developer extensions with OAuth 2.0), and RPA
- Single set of credentials accesses all apps; SAML-based SSO

---

## 4. Authentication & Shared Identity

### Core Patterns

**Single Identity Provider (IdP) Pattern**

- One account system for all products
- Platform owns the identity; vendor products are Service Providers
- Session Service maintains authenticated sessions
- Users move freely between products without re-authenticating

**How Atlassian Does It:**

1. Request hits nearest Atlassian edge
2. Edge verifies user session and identity using shared Session Service + Edge Authenticator
3. Edge determines product data location via Tenant Context Service
4. Request forwarded to target region
5. JWT tokens ensure signing authority outside the application
6. ASAP (Atlassian Service Authentication Protocol) uses explicit allowlist of which services may communicate

**How Vendasta Does It:**

- Platform acts as Identity Provider; vendor products as Service Providers
- OAuth2 3-legged flow for SSO
- Session transfer: system checks for active session; auth flow only when no valid session exists
- Service Context describes the resource being accessed (accounts, partners, etc.)
- Just-in-Time IAM: developers parse service context and do access checks as part of SSO flow

**Common SSO Protocols:**

- SAML v2: XML-based, standard for cross-domain SSO
- OpenID Connect (OIDC): Based on OAuth 2.0, used by most modern platforms
- OAuth 2.0: Authorization flows for mobile, web, and desktop

### Implementation Pattern

- Shared user-pool approach: single pool where a user creates one account and belongs to multiple organizations, with separate roles in each
- Auth0 Organizations: recommended for multi-tenant B2B SaaS
- JWT tokens carry tenant context through all system layers
- Each service validates tokens against the identity system independently

---

## 5. Branding & Theming Architecture

### How It Works Technically

**Theming Engine Components:**

- Visual customization: Primary/secondary colors, typography, logos, imagery
- Layout variations: Sidebar vs. top navigation per brand
- Custom CSS: Per-tenant CSS overrides for pixel-perfect control
- Custom domains: Each tenant supports custom domains (brandA.com, app.brandB.io)

**Theme Storage:**

- Themes stored as JSON or YAML configurations
- Enables easy versioning, rollback, and user-specific customization
- Retrieved per tenant on each request
- Cached aggressively for performance

**Custom Domain Routing:**

1. Tenant configures CNAME/A record pointing to platform's load balancer
2. Nginx/reverse proxy receives request, reads Host header
3. Proxy appends `X-Served-For` header with original domain
4. Application reads header, maps to tenant_id via domains table (cached in Redis)
5. Loads tenant-specific theme configuration
6. SSL certificates auto-managed via Let's Encrypt with DNS validation

**CSS Variables Pattern:**

- CSS Variables + Tailwind CSS or Material-UI enable dynamic style adjustments
- Design system components expose only customizable properties (colors, fonts, spacing)
- System prevents unwanted changes by limiting what can be adjusted
- API-driven configuration with REST or GraphQL APIs for real-time changes

**Best Practice: "Test with the ugliest theme"**

- Use neon colors and unusual fonts during testing to catch layout issues
- Ensures the theming engine is truly flexible before production

### Branding as First-Class Architectural Concern

- Branding is separated from core logic
- Microservices architecture separates core services (billing, user management, workflows) from branding layers (theme config, UI components)
- Configuration toggles control: logo, color scheme, typography, domains, UI layouts

---

## 6. Billing & Entitlements

### Multi-Product Billing Architecture

**Stripe Connect for Platforms:**

- Platform purchases and white-labels payment processing from Stripe
- Offers financial products to connected accounts (Instant Payouts, Issuing, Capital)
- Revenue: subscription fees or per-transaction application fees
- Supports flat rate, good-better-best, per-seat, usage-based, tiered, multiple products per subscription
- Embedded dashboards or white-labeled dashboards via Stripe APIs

**Billing Integration Pattern:**

1. User selects plan and submits payment details
2. Backend creates Stripe customer and subscription record
3. Stripe sends `invoice.paid` webhook notification
4. Application marks subscription active and unlocks features
5. On upgrade: `customer.subscription.updated` webhook updates tenant's feature flag context
6. Feature access changes propagate within seconds of billing event

**Revenue Models for White-Label Platforms:**

- Monthly SaaS fees (tiered by features/users)
- Setup and customization fees
- Transaction-based revenue sharing
- Commission-based: percentage of each sale
- Hybrid: subscription plus per-transaction
- Professional services for integrations

**Vendasta's Model:**

- Wholesale pricing from Vendasta; partners markup 60-80% above wholesale
- Tiered bundles: Starter -> Professional -> Premium
- Partners set pricing, billing, and packaging independently
- Encrypted, integrated billing; recurring automated invoices
- Can bill for both platform products and custom services

**GoHighLevel's Model:**

- SaaS Configurator sets feature access per plan
- Usage-based billing for conversations, emails, phone minutes
- Integrated Stripe billing with configurable pricing plans
- SaaS dashboard showing MRR, churn, and client health metrics
- New sub-account auto-created when client purchases subscription

### Usage Metering Pattern

For per-seat, per-API-call, or per-GB pricing:

- Each billable event inserted as immutable row: `tenant_id, event_type, quantity, timestamp`
- Webhook-based billing architecture decouples payment processing from application logic
- Payment processor manages flows and publishes events to webhook endpoints

---

## 7. Feature Flags & Entitlement Gating

### How Feature Flags Control Product Access

**Architecture:**

1. SaaS application receives request with JWT containing tenant and tier info
2. Calls feature flag service with context information
3. Feature flag service evaluates and returns flags targeted for that context
4. Application gates feature access based on flag values

**Flag Types:**

- **Boolean flags**: Feature is on or off per tier/tenant
- **Multivariate flags**: String, number, or JSON values (e.g., "concurrent meetings" limit varies per tier)

**Integration with Billing:**

- Connect feature flag service to payment platform via webhooks
- When Stripe `customer.subscription.updated` fires, update user's flag targeting context with new tier
- Feature access changes propagate within seconds
- Single source of truth for entitlements

**Feature Flag vs. Entitlement Distinction:**

- Feature flags manage **deployment** (when a feature rolls out)
- Entitlements manage **monetization** (who can use it and how it links to pricing/usage)
- Feature flag tools decide when a feature rolls out; entitlement system determines who can use it

### Per-Tenant Feature Configuration

**Implementation:**

```
# Tenant configuration lookup
tenant = Tenant.find(tenant_id)
features = tenant.plan.features  # Returns list of enabled feature slugs

# Gate check
if 'social_media_management' in features:
    render_social_dashboard()
```

**Best Practices:**

- Toggle modules on/off per tenant without code deployment
- Use global scopes or middleware to enforce feature access
- Permission caching prevents latency from repetitive lookups
- Server-side evaluation for subscription tier checks (not client-side)
- Tenant_id is REQUIRED context everywhere -- data model, request routing, caching, background jobs, authorization

### Configurable Feature Tiers Example

- **Basic tier**: Dashboard, orders, reports
- **Pro tier**: Adds analytics and API access
- **Enterprise tier**: Includes white-label emails and custom domains

---

## 8. Shared Data Layer Between Products

### How Products Share Data

**Pattern 1: Shared CRM / Central Data Model (HubSpot)**

- Smart CRM is the single source of truth
- Every product reads/writes to the same customer data
- Marketing, Sales, Service share the same activity log
- Handoffs between products are seamless because same data model

**Pattern 2: Shared Platform Services with Isolated Product Data (Atlassian)**

- Each microservice owns its own exclusive data storage
- No other service can read/write another's API
- Shared platform services: request routing, auth, binary storage, data lakes, logging, observability
- Products communicate through the platform layer, not direct database access

**Pattern 3: Unified Data Layer with API Access (Zoho)**

- All software built on unified integrated data layer
- Shared AI, search, analytics, messaging services
- Unified Data Services (UDS): universal cloud data model for data transfer between services

**Pattern 4: Event-Driven Data Sharing**

- Services publish domain events when business-significant things happen
- Other services subscribe to events they care about
- Asynchronous communication decouples producers from consumers
- Event bus enables real-time workflows across products
- Example: user signup triggers welcome email, CRM update, dashboard creation

### Implementation Recommendations

- Start with a shared database + tenant scoping for MVP
- As products mature, move to event-driven communication between bounded contexts
- Each product/service owns its data; shares through APIs and events
- Central user/tenant database is always shared; product-specific data is owned by each product
- Cache aggressively with tenant-prefixed keys

---

## 9. Real-World Platform Deep Dives

### Atlassian Cloud

- **Scale**: 200,000+ customers across 13 AWS regions, millions of databases, billions of daily requests
- **Multi-tenancy**: One database per tenant (PostgreSQL); absolute data isolation
- **Infrastructure**: Two platforms -- "Micros" (internal PaaS for Jira, Confluence) and non-Micros (Opsgenie, Trello)
- **Shared services**: Request routing, auth, binary storage, UGC stores, data lakes, logging, observability, Commerce/Identity/Media platforms
- **Identity**: Atlassian account system provides SSO across all products; shared Session Service + Edge Authenticator
- **Security**: JWT-based service auth; ASAP protocol with explicit service allowlists; least privilege data access
- **Provisioning lifecycle**: 7-step orchestration (commerce metadata -> site creation -> product activation -> region provisioning -> identity data -> product databases -> licensed apps)
- **Key insight**: A "site" is the container of multiple products licensed to a customer

### Vendasta

- **Scale**: 250+ products, 60,000+ resellers, 5.5M+ local businesses
- **Architecture**: Marketplace model; core platform + vendor extensions
- **SSO**: OAuth2 3-legged flow; Identity Provider / Service Provider model
- **Vendor integration**: REST APIs; vendors get Service Provider ID; CSP API for customer provisioning
- **Bundling**: Partners create 3-5 product bundles; tiered from starter to established
- **Pricing**: Wholesale from Vendasta; 60-80% partner markup
- **Branding**: Full white-label; partners' clients never see Vendasta brand
- **Key limitation**: AI features siloed because each vendor's data is separate

### GoHighLevel

- **Architecture**: Monolithic platform with sub-account isolation
- **Multi-tenancy**: Agency account contains unlimited sub-accounts; each sub-account is isolated workspace
- **Feature control**: SaaS Configurator sets feature access per plan; granular permission settings per sub-account
- **Branding**: Full white-label; custom domain mapping; logo, colors, favicon customization
- **Billing**: Integrated Stripe; usage-based options for conversations, emails, phone minutes
- **Onboarding**: "Snapshots" copy entire sub-account configurations; eliminates hours of setup per client
- **Engineering**: Microservices architecture in multi-tenant environment; high-scale mission-critical platform components

### HubSpot

- **Architecture**: Unified platform with modular Hubs sharing a Smart CRM data layer
- **Product independence**: Hubs purchasable individually or mixed via "Create-a-Bundle"
- **Data sharing**: All hubs read/write to same CRM; same activity log across Marketing, Sales, Service
- **Key insight**: The shared data model is what makes the product suite cohesive
- **Handoffs**: Architecture establishes how hubs communicate and how handoffs happen between teams

### Zoho One

- **Architecture**: 45+ apps built on unified integrated data layer
- **Shared services**: AI, search, analytics, messaging scale alongside users
- **SSO**: SAML-based; syncs with LDAP/Active Directory
- **Integration**: Flow (no-code), Sigma (developer extensions with OAuth 2.0), RPA
- **Key insight**: Everything shares the same underlying data model; apps grouped by department

### Thryv

- **Architecture**: Unified cloud platform; modular tech stack with tiered bundles (Essentials/Plus/Premium)
- **Data flows**: Cross-module automations -- appointment reminders, two-way messaging with payment links, drip marketing, review requests
- **Integrations**: Partners with payment acquirers, listings distributors, third-party apps (QuickBooks, Gmail, Slack, MailChimp)
- **Key insight**: Customizable CRM database is the foundation; all modules flow from it

### Birdeye

- **Architecture**: Agentic platform with proprietary Outcome Framework
- **Unified data**: Aggregates signals from reviews, social, messaging, surveys, listings, CRM into single customer profile per location
- **Multi-location**: Role-based access, tiered approvals, location-level reporting
- **AI integration**: 10+ autonomous AI agents work across the entire customer journey because of shared data
- **Key insight**: Shared data is what enables AI agents to work across product boundaries

---

## 10. Technical Implementation Patterns

### Database Schema for Multi-Product Multi-Tenant Platform

```
# Core tables
tenants (id, name, domain, plan_id, theme_config, created_at)
users (id, tenant_id, email, role_id)
roles (id, tenant_id, name)
permissions (id, name)
role_permissions (role_id, permission_id)

# Product/Feature entitlements
plans (id, name, price, billing_interval)
plan_features (plan_id, feature_slug, value)  -- value can be boolean, numeric limit, etc.
tenant_feature_overrides (tenant_id, feature_slug, value)  -- per-tenant overrides

# Billing
subscriptions (id, tenant_id, plan_id, stripe_subscription_id, status)
usage_events (id, tenant_id, event_type, quantity, timestamp)

# Branding
tenant_themes (tenant_id, primary_color, secondary_color, logo_url, font_family, custom_css, layout_variant)
tenant_domains (tenant_id, domain, ssl_status, verified)
```

### Service Architecture

```
[Edge / CDN / Load Balancer]
        |
[API Gateway] -- Routes by tenant context
        |
   +---------+---------+---------+---------+
   |         |         |         |         |
[Auth     [Billing  [Product  [Product  [Product
 Service]  Service]  A]        B]        C]
   |         |         |         |         |
   +---------+---------+---------+---------+
        |                    |
[Shared Identity DB]   [Event Bus / Message Queue]
[Shared Config DB]     [Per-product databases]
```

### Domain-Driven Design for Multi-Product

- Each product = bounded context with own model, language, data
- Bounded contexts communicate through domain events
- Shared Kernel pattern (shared types between products) should be minimized -- tight coupling
- Customer/Supplier pattern preferred: one product publishes events, others subscribe
- Central "user" and "tenant" domains are shared; product-specific domains are isolated

### Custom Domain + Tenant Resolution Flow

```
1. DNS: client.customdomain.com -> CNAME -> platform-lb.example.com
2. Load Balancer terminates TLS (Let's Encrypt auto-managed)
3. Nginx reads Host header, appends X-Served-For
4. Application middleware:
   a. Reads X-Served-For header
   b. Looks up domain in domains table (Redis-cached)
   c. Sets tenant context for request
   d. Loads theme configuration
   e. Loads feature entitlements
5. All subsequent queries scoped to tenant_id
6. Response rendered with tenant's branding
```

### Event-Driven Cross-Product Communication

```
Product A publishes: "customer.signed_up" event
  -> Product B subscribes: Creates CRM record
  -> Product C subscribes: Sends welcome email
  -> Product D subscribes: Sets up social media workspace
  -> Billing service subscribes: Starts trial period

Product B publishes: "deal.closed" event
  -> Product A subscribes: Updates dashboard metrics
  -> Product C subscribes: Triggers onboarding sequence
```

### Deployment Patterns

- Blue-green deployments for zero-downtime releases
- Feature flags for gradual rollouts
- Canary releases testing features on single tenants first
- Instant rollback capability
- All tenants share single codebase; careful deployment strategies critical

---

## 11. Key Takeaways & Recommendations

### For Building a Multi-Product White-Label Platform Like Surgent

**1. Start with a Shared Data Core**

- Build a central data model (like HubSpot's Smart CRM) that all products share
- This is what makes standalone products work BETTER together (the cross-product value proposition)
- For Surgent: the business profile, contacts, and activity log should be the shared core

**2. Use Feature Flags, Not Separate Codebases**

- Toggle products/features on/off per tenant
- Connect feature flags to billing via webhooks
- Avoids maintaining separate deployments for different product combinations

**3. Design for Standalone First, Bundle Second**

- Each product should work independently with its own value proposition
- Shared data layer makes them better together, not required together
- This enables "land and expand" sales: sell one product, upsell the suite

**4. Theming is a First-Class Concern**

- Store theme as JSON configuration per tenant
- Use CSS variables and a design token system
- Support custom domains from day one
- Separate branding layer from core logic

**5. Billing Architecture**

- Stripe Connect or Stripe Billing for multi-product subscriptions
- Per-tenant configurable pricing
- Usage-based billing for metered features
- Webhook-driven entitlement updates
- Support mix-and-match: individual products or bundled pricing

**6. Authentication: Single Identity, Multiple Products**

- One account accesses all products
- Session Service for seamless cross-product navigation
- JWT tokens carry tenant context through all layers
- SSO for white-label partners who want to use their own IdP

**7. Start Monolith, Evolve to Microservices**

- Begin with a well-architected monolith with modular boundaries
- Extract products into microservices as they mature and teams grow
- Use domain-driven design bounded contexts from the start (even in a monolith)
- Event-driven communication patterns prepare for eventual extraction

**8. Per-Tenant Configuration Stack**

```
Tenant -> Plan -> Features (from plan_features)
                -> Overrides (from tenant_feature_overrides)
                -> Theme (from tenant_themes)
                -> Domains (from tenant_domains)
                -> Billing (from subscriptions + usage_events)
```

**9. Key Infrastructure Savings**

- One platform powering multiple brands achieves 60-70% infrastructure savings vs. individual deployments
- White-label platform businesses typically achieve 200-500% ROI within 12 months

**10. Avoid Common Mistakes**

- Don't fork codebases per customer/product
- Don't skip tenant scoping -- enforce at database level (RLS) as safety net
- Don't build billing from scratch -- use Stripe/Paddle
- Don't mix feature deployment with feature monetization -- separate feature flags from entitlements
- Plan for exceptions: "Every client will want just one small custom feature"

---

## Sources

### Architecture & General

- [White-Label SaaS Architecture & Growth Strategy Guide 2026](https://developex.com/blog/building-scalable-white-label-saas/)
- [We Built One Platform That Powers 30+ Brands](https://dev.to/jos_gonalves_fac39f3437/we-built-one-platform-that-powers-30-brands-the-white-label-saas-playbook-445d)
- [Building Scalable White-Label Platforms](https://dev.to/bob_packer_7c9018a4d1a1f1/building-scalable-white-label-platforms-for-interactive-digital-experiences-44gf)
- [How to Build a White-Label SaaS Product](https://www.wildnetedge.com/blogs/how-to-build-a-white-label-saas-product-for-multi-branding-success)
- [White-labeling: putting the design system in users' hands](https://www.designsystems.com/white-labeling-putting-the-design-system-in-users-hands/)
- [Architecture Patterns for SaaS Platforms: Billing, RBAC, and Onboarding](https://medium.com/appfoster/architecture-patterns-for-saas-platforms-billing-rbac-and-onboarding-964ea071f571)

### Composable & MACH

- [Composable SaaS: Why Modular Apps Are Replacing Monoliths](https://www.ishir.com/blog/246061/composable-saas-in-2025-why-modular-apps-are-outpacing-monoliths.htm)
- [MACH Architecture](https://macharchitecture.com/)
- [Composable Architecture vs. Microservices](https://www.luzmo.com/blog/composable-architecture-vs-microservices)
- [How Composable SaaS Builds Flexible Systems with API-First Design](https://www.synlabs.io/post/how-composable-saas-builds-flexible-and-scalable-systems-with-api-first-design)

### Multi-Tenancy

- [Ultimate Guide to Multi-tenant White-label eCommerce](https://spreecommerce.org/the-ultimate-guide-to-multi-tenant-white-label-ecommerce/)
- [Demystifying Multi-Tenancy in B2B SaaS](https://auth0.com/blog/demystifying-multi-tenancy-in-b2b-saas/)
- [Developer's Guide to SaaS Multi-tenant Architecture](https://workos.com/blog/developers-guide-saas-multi-tenant-architecture)
- [Building Multi-Tenant SaaS Applications](https://www.actinode.com/blog/multi-tenant-saas-architecture-patterns)
- [AWS SaaS Lens General Design Principles](https://docs.aws.amazon.com/wellarchitected/latest/saas-lens/general-design-principles.html)

### Feature Flags & Entitlements

- [SaaS Entitlement Management with LaunchDarkly](https://aws.amazon.com/blogs/apn/simple-and-flexible-saas-entitlement-management-with-launchdarkly/)
- [Rethinking SaaS Entitlement Management with Feature Flags](https://qconsf.com/presentation/oct2023/rethinking-saas-entitlement-management-feature-flags)
- [SaaS Feature Flags Implementation Guide](https://designrevision.com/blog/saas-feature-flags-guide)
- [How do entitlements work in SaaS](https://getlago.com/blog/saas-entitlements)

### Platform Deep Dives

- [Atlassian Cloud Architecture](https://www.atlassian.com/trust/reliability/cloud-architecture-and-operational-practices)
- [How Atlassian Built a Multi-Tenant SaaS Empire](https://blackflow.co.uk/entreprise-software-development/how-atlassian-built-a-multi-tenant-saas-empire-the-cloud-architecture-behind-jira-and-confluence/)
- [Migrating the Atlassian Identity Platform to AWS](https://www.atlassian.com/engineering/migrating-the-atlassian-identity-platform-to-aws)
- [Vendasta Marketplace](https://www.vendasta.com/marketplace/)
- [Vendasta Developer Center](https://developers.vendasta.com/)
- [Vendasta SSO PHP SDK](https://github.com/vendasta/sso-php-sdk)
- [How to bundle white-label content with Vendasta](https://www.vendasta.com/blog/white-label-content-vendasta-marketplace/)
- [GoHighLevel SaaS Mode Setup Guide](https://help.gohighlevel.com/support/solutions/articles/48001184920-saas-mode-full-setup-guide-faq)
- [GoHighLevel White Label Guide](https://ecosire.com/blog/gohighlevel-white-label-saas-complete-guide)
- [HubSpot Customer Platform](https://www.hubspot.com/products/customer-platform)
- [HubSpot Solution Architecture](https://huble.com/blog/hubspot-solution-architecture)
- [Zoho One Unified Platform](https://www.zoho.com/one/platform.html)

### Billing

- [Build a SaaS platform on Stripe](https://docs.stripe.com/connect/saas)
- [Stripe Connect for Platforms and Marketplaces](https://docs.stripe.com/connect/saas-platforms-and-marketplaces)
- [Integrate a SaaS business on Stripe](https://docs.stripe.com/saas)

### Custom Domains & Routing

- [Custom Domains and Subdomains for Multi-Tenant SaaS](https://www.dchost.com/blog/en/custom-domains-and-subdomains-for-multi-tenant-saas/)
- [Ultimate Guide to Custom Domains for SaaS](https://saascustomdomains.com/blog/posts/the-ultimate-guide-to-custom-domains-for-your-saas-app)
- [SaaS Custom Domains](https://saascustomdomains.com/)

### Domain-Driven Design

- [Domain-Driven Design for Microservices](https://semaphore.io/blog/domain-driven-design-microservices)
- [Shared Kernel Pattern in DDD](https://mehmetozkaya.medium.com/shared-kernel-pattern-in-domain-driven-design-ddd-21cba2a9f92a)
