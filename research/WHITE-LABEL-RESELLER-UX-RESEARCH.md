# White-Label Reseller/Agency UX Experience Research

_Research date: March 30, 2026_

---

## Executive Summary

This research documents what agency owners actually see, do, and experience when they white-label software platforms. Based on comprehensive analysis of GoHighLevel, Vendasta, DashClicks, SuiteDash, Simvoly, Duda, and 10Web, the white-label reseller experience follows a remarkably consistent pattern across all platforms -- but with significant friction points that represent opportunities for Surgent.

**The universal reseller journey:** Connect Stripe -> Configure branding (logo/colors/domain) -> Create pricing plans -> Build sales funnel/page -> Client signs up -> Sub-account auto-provisioned -> Client sees branded dashboard -> Agency manages everything from a master view.

**The universal pain:** Setup is complex (typically 2-8 hours for initial configuration, plus 2-15 hours per client onboarding), DNS configuration is technical and error-prone, branding customization is shallow (usually just logo + 2-3 colors), and managing multiple clients at scale requires significant operational discipline.

---

## 1. THE RESELLER LOGIN EXPERIENCE

### What the Agency Owner Sees When They Log In

**GoHighLevel (Agency View):**

- Top-left dropdown shows "Agency View" vs individual sub-account names
- The Agency View is the top-level admin dashboard with:
  - Left sidebar navigation: Dashboard, Sub-Accounts, Settings, Marketplace, SaaS Configurator
  - Agency Rolled-Up Reporting: aggregated metrics across ALL sub-accounts in one view
  - Sub-account list showing every client location with status indicators
  - Quick-switch: click any sub-account name to "drop into" that client's workspace
- Clicking "Switch to Agency View" from any sub-account returns to the master dashboard
- Key distinction: Agency View = admin/management. Sub-Account View = operational (where you build funnels, pipelines, automations)

**DashClicks (Main Account):**

- Dashboard is a "digital control room" with drag-and-drop widget canvas
- Available widgets on the main dashboard:
  - Deals Widget: new/won/lost comparisons, total deal values
  - Sites Widget: page views, visitors, visits over custom periods
  - Forms Widget: form status, pending requests, submission counts
  - Inbound Widget: leads categorized as hot/warm/cold/ice by age
  - Conversations Widget: open and unassigned conversation counts
  - Reputation Widget: reviews generated in last 30 days
  - Notifications Widget: customizable alerts
- Each team member can maintain individual dashboard preferences
- Real-time data synchronization without manual page refreshes
- Main account has features sub-accounts cannot access: InstaSites, InstaReports, Projects, Fulfillment Center, Affiliate Program

**Vendasta (Partner Center):**

- Gateway dashboard with sections for:
  - Manage Accounts (create individual or import bulk)
  - Email Marketing campaigns and automations
  - Marketplace (browse and add 250+ apps to your store)
  - Invoice management
  - Product activation on accounts
  - User and admin management
- Reseller's clients log into "Business App" -- a separate, branded portal with:
  - Unified dashboard (one login, one password, one set of notifications)
  - Automated reporting
  - Customer communication hub (unified inbox for SMS and messaging)
  - Product catalog access
  - Team collaboration features
  - Conversion-building tools

**SuiteDash:**

- 100% white-labeled portal from day one (even on affordable plans)
- Dashboard uses drag-and-drop content blocks:
  - Tasks, invoices, files, forms, checklists
  - Text, photos, videos, charts
- Automated domain mapping tool replaces SuiteDash URL with yours
- Title tag and favicon customizable
- Menu colors, text colors, buttons, and logo all customizable
- Emails sent via white-labeled channels

**Simvoly (White Label Dashboard):**

- Resellers access dedicated dashboard at wl.simvoly.com
- Navigation menu sections:
  - Getting Started procedures
  - Main Site editing
  - Template building
  - Builder branding/customization
  - Pricing setup
  - Website and user management
  - Payment and transaction handling
  - Automation workflows
  - Affiliate programs
  - White label settings
  - System emails and pages
  - Subscription widgets
- Centralized customer organization through projects with team access levels

**Duda:**

- Central dashboard to view and manage: sites, clients, team members, white-label assets, business tools
- Site stats visible from dashboard
- White Label section for customizing the branded experience
- Client dashboard (what clients see) includes: site stats, activity log, permissions granted by agency

**10Web:**

- Reseller dashboard provides:
  - Client website management directly from dashboard
  - Revenue dashboards tracking MRR, transactions, subscription status
  - Usage metrics: website activity, new signups, user engagement
  - Billing management: invoices, payment statuses, refunds
  - Role-based access management for clients and internal teams
- All lifecycle, system, and payment emails sent from your domain with your branding

---

## 2. BRANDING CUSTOMIZATION: WHAT CAN ACTUALLY BE CHANGED

### The Standard Branding Checklist (What Every Platform Offers)

| Element                    | How It Works                                     | Typical Complexity        |
| -------------------------- | ------------------------------------------------ | ------------------------- |
| **Logo**                   | Upload image file, appears in dashboard top-left | Simple (1 minute)         |
| **Favicon**                | Upload small icon for browser tab                | Simple (1 minute)         |
| **Primary Color**          | Hex code, applied to header bar and emails       | Simple (1 minute)         |
| **Secondary Color**        | Hex code, applied to buttons and UI elements     | Simple (1 minute)         |
| **Text Color**             | Contrasting color for readability                | Simple (1 minute)         |
| **Login Page**             | Upload background image/GIF, add logo            | Moderate (5-15 minutes)   |
| **Custom Domain**          | CNAME record pointing to platform                | Technical (15-60 minutes) |
| **Email Sender Domain**    | SPF, DKIM, DMARC DNS records                     | Technical (30-60 minutes) |
| **Terms & Conditions URL** | Link to your legal pages                         | Simple (1 minute)         |
| **Privacy Policy URL**     | Link to your legal pages                         | Simple (1 minute)         |

### Platform-Specific Branding Depth

**GoHighLevel -- Most Comprehensive:**

- 5 separate domains to configure:
  1. **Whitelabel Domain** (app.yourdomain.com) -- brands the login/desktop app
     - CNAME pointing to: whitelabel.ludicrous.cloud
  2. **API Domain** (link.yourdomain.com) -- brands system-generated links in emails/SMS (forms, surveys, calendars, trigger links)
     - CNAME pointing to: brand.ludicrous.cloud
  3. **Sites Domain** (yourdomain.com or sites.yourdomain.com) -- for websites and funnels
     - A record to 162.159.140.166 (root) or CNAME to sites.ludicrous.cloud (subdomain)
  4. **Email Sending Domain** -- establishes sender reputation
     - TXT record (SPF): v=spf1 include:mailgun.org ~all
     - CNAME: mailgun.org
     - 2 MX records: mxa.mailgun.org
     - TXT record (DMARC): v=DMARC1;p=none;
  5. **Client Portal Domain** (memberships.yourdomain.com) -- for affiliates, memberships, communities
     - CNAME pointing to: clientportal.ludicrous.cloud
- Logo upload in Agency Company Settings
- Custom color scheme
- Login page customization
- White-label mobile app (separate setup, see below)
- Critical note: Always use subdomains, never root domains (risks disconnecting existing websites/email)

**DashClicks:**

- Logo, favicon, login image (with built-in cropping tool), floating app icons toggle
- Three colors: primary (header + emails), secondary (buttons + elements), text color
- Custom Domain (Pro Plan only) -- requires DNS record update
- Custom Email Domain (Pro Plan only)
- Sender email address configuration
- Sub-account search and access permissions (Pro Plan only)

**Vendasta:**

- White-labeled sales collateral and dashboards
- Branded client portal (Business App)
- Product catalog branding
- Less deep customization than GHL -- relies on vendor branding throughout ecosystem

**SuiteDash:**

- Custom domain via automated mapping tool (Pinnacle plan, $99/mo)
- Menu colors, text colors, button colors, logo
- Title tag and favicon
- Emails sent via white-labeled channels
- Free white-labeled mobile app included
- Unlimited users on all plans

**Simvoly:**

- Custom logo, domain, and full UI changes
- Custom CSS/JavaScript for deeper visual customization
- Unlimited custom templates (websites, funnels, pages, blocks, popups, emails)
- Non-branded academy for customer education
- System emails and pages customizable
- 35-55% partnership discount on costs

**Duda:**

- Editor interface branded with agency colors and logo
- Auto-generated SSL for all white-label domains
- Client dashboard fully branded
- Content collection forms branded
- Marketing materials under your brand
- Clients cannot tell they are using Duda

**10Web:**

- 100% branded dashboard with logo, colors, name
- Domain and subdomains under your control
- All lifecycle, system, and payment emails from your domain
- Branded invoices

---

## 3. CLIENT ACCOUNT CREATION AND ONBOARDING

### How Sub-Accounts Are Created

**GoHighLevel (Automated via SaaS Mode):**

1. Customer visits your sales funnel/website (built within GHL)
2. Customer purchases via 2-Step order form (Stripe card payments ONLY)
3. Automatic provisioning triggers:
   - Sub-account (Location) created using customer's first and last name
   - User account created with supplied email, auto-generated password
   - Permissions applied based on purchased SaaS plan's feature set
   - SaaS mode auto-activated for the sub-account
   - Twilio rebilling configured per agency's settings
   - Snapshot applied (pre-built templates, workflows, pipelines)
   - Credential email sent via Mailgun (agency's domain or default)
4. Agency receives notification via workflow trigger
5. Manual alternative: Agency Account > Sub-Accounts > three-dot menu > "Switch To SaaS"

**GoHighLevel (Manual Onboarding Best Practice -- 14-Day Process):**

- **Pre-onboarding (Day 0):** Send questionnaire within 24 hours of contract signing capturing: business details, target customer profile, current tools, top 3 goals, team members needing access, brand assets (logo, colors, fonts)
- **Day 1:** Brand the sub-account (upload logos, set colors, update company info), connect communication channels (phone via Twilio/LC Phone, business email, domain verification, chat widget)
- **Days 2-4:** Configure CRM pipeline stages, create custom contact fields, import contacts, build 3-5 core automations (instant lead responses, appointment reminders, follow-up sequences)
- **Day 5:** Landing page/funnel goes live with form fields connected to CRM
- **Days 6-10:** Build email/SMS template libraries, configure booking calendars, establish reporting dashboards
- **Days 11-14:** Record Loom training videos (CRM basics, conversations inbox, campaigns, calendar, reporting), conduct "go-live" celebration call
- **Critical metrics:** Agencies using snapshots reduce setup from 8-15 hours to 2-4 hours. Untrained clients churn 40% more. More than 3 simultaneous onboardings without a specialist = quality degradation.

**DashClicks:**

- Purchase triggers automatic sub-account creation on free plan
- Main account invites sub-accounts to branded dashboard
- Sub-accounts see agency branding automatically
- Digital, automated onboardings
- Sub-accounts cannot access: InstaSites, InstaReports, Projects, Fulfillment Center, Affiliate Program

**Vendasta:**

- Partner Center > Accounts > Manage Accounts
- Create individual accounts or bulk import
- Activate products on accounts
- Clients receive access to Business App (white-labeled portal)
- Clients can invite their own employees as users

**Simvoly (Fully Self-Serve):**

- Customer visits your branded website
- Picks a template
- Creates an account
- Starts a trial
- No agency intervention required
- When trial ends, customer pays based on plans you created
- Agency manages all customers from central dashboard organized by projects

**10Web:**

- Two paths: clients self-serve (choose plan, create profile) OR agency invites directly
- Pre-installed plugins controlled by agency
- Roles and permissions set for clients, team members, organizations

**SuiteDash:**

- Automated onboarding: clients receive intake forms, e-sign documents, schedule appointments
- Portal pages assigned per contact or via Circles (user groups)
- Dashboard content blocks customizable per client type

---

## 4. FEATURE ACCESS CONTROL: HOW AGENCIES CONTROL WHAT CLIENTS SEE

### GoHighLevel (Most Granular)

**Plan-Level Control (SaaS Configurator):**

- Up to 20 SaaS plans per agency
- Each plan includes/excludes specific platform features
- Feature icons displayed in configurator -- present = included, absent = excluded
- Example tier structure:
  - Basic ($97/mo): CRM + email marketing only
  - Professional ($197/mo): + funnels + calendars + SMS
  - Premium ($397/mo): everything including AI chatbots + advanced workflow automations

**Individual Sub-Account Control:**

- Agency Account > Sub-Accounts > "Manage Client" > "Enable/Disable Products"
- Toggle features on/off for any specific client
- Override plan-level permissions when needed

**Marketplace App Control:**

- Deselect "allow sub-accounts to view and install apps built by 3rd party developers"
- Under "App state" > "Disapproved apps" -- selectively approve/block marketplace apps
- Prevents clients from installing random third-party tools

**User Role Permissions:**

- Agency Level: Agency Owner, Agency Admin (only these can access Stripe Connect)
- Sub-Account Level: Admin, User, and custom roles with granular permission sets
- Can create users who manage multiple locations without agency-level access

### DashClicks

- Main accounts see everything; sub-accounts restricted by design
- Sub-accounts cannot access: InstaSites, InstaReports, Projects, Fulfillment Center, Affiliate Program
- Sub-accounts can only view/interact with their own business data
- Sub-accounts can add users to their own sub-account but cannot invite other sub-accounts
- Pro Plan unlocks sub-account search and access permissions management

### Duda

- Granular client permissions: enable or restrict a wide variety of features
- Predefined roles: site editor, blog contributor, etc.
- Custom roles: define exactly what each client can see or edit within the website
- Comprehensive suite of user permissions
- Agency controls what information and functionality clients can access

### Vendasta

- Product activation per account
- Marketplace app selection per client
- Role-based access within Business App

### SuiteDash

- Portal page access assigned per contact or Circle (user group)
- Feature modules visible/hidden based on plan and configuration
- Unlimited users on all plans

---

## 5. BILLING AND REVENUE FLOW

### How Money Moves in White-Label SaaS

**The Standard Model (GoHighLevel as archetype):**

```
End Customer --pays--> Agency's Stripe Account --pays--> GoHighLevel ($497/mo flat)
                                                  |
                                                  +--> Agency keeps the difference
```

**GoHighLevel Billing Architecture:**

1. **Agency pays GoHighLevel:** $497/month (Agency Pro plan) for unlimited sub-accounts
2. **Agency connects Stripe:** Settings > Stripe Connect in Agency View
   - Only Agency Owners and Agency Admins can access
   - If access revoked, "Reconnect" option appears
3. **Agency creates plans in SaaS Configurator:**
   - Up to 20 plans saved directly into agency's Stripe account as products
   - Monthly and yearly pricing options
   - Trial periods configurable
   - One-time setup fees can be added
   - Currency can be changed per plan (before any active subscriptions)
   - Plans created in Stripe must NEVER be deleted
4. **Plans sold via funnels/order forms:**
   - Import Stripe product IDs into sub-account Payments tab
   - Add products to sales page with 1-Step or 2-Step Order Form
   - SaaS subscription supports card payments ONLY (no PayPal, no BNPL)
5. **Usage-based rebilling (passive revenue):**
   - Twilio rebilling: SMS segments, phone calls
   - Email sending costs
   - AI usage credits
   - Example: 50 clients x 2,000 SMS/month = $700+ passive profit from SMS alone
   - Twilio rebilling always in USD regardless of subscription currency
6. **Client billing visibility:**
   - Clients see credit balance and usage at Settings > Company Billing
   - Auto-recharge settings configurable by client
7. **Complimentary credits:** Agency can allocate monthly credit allowance per plan toward phone/SMS/email costs

**Stripe Connect Flow (General Pattern):**

- Agency's Stripe account is the "platform" account
- Client payments go directly to agency's Stripe
- Stripe handles subscription management, renewals, failed payments
- Agency has 100% revenue control
- No revenue sharing with the platform provider (unlike Vendasta)

**Vendasta Billing Model (Different):**

- Custom pricing starting ~$500-$1,000/month (not publicly listed)
- Commission-based payout model
- Per-tool, per-client cost structure
- Tool costs accumulate as clients add services
- Revenue shared across platform and vendors
- Every new team member increases costs

**DashClicks:**

- Multiple reseller plans available
- White-label fulfillment services priced per service
- Agency sets their own markup

**Simvoly:**

- Connect your payment processor directly
- Create your own plans with your own pricing
- 35-55% partnership discount on platform costs
- Customers pay you directly based on your plans
- Self-serve model: customer subscribes without your intervention

**10Web:**

- "10Web Payments" processes subscriptions and transactions
- Custom pricing tiers, trial periods
- Invoice management, payment status monitoring, refund handling
- All payment emails from your domain

**SuiteDash:**

- Built-in estimates and invoicing
- Plans from $19-$99/month
- White-label domain at Pinnacle tier ($99/mo)
- Unlimited users on all plans

---

## 6. THE WHITE-LABEL MOBILE APP EXPERIENCE

### GoHighLevel (Most Detailed Mobile App White-Labeling)

**What it is:** A rebranded version of the GoHighLevel mobile app with your agency's name, colors, and logo on the App Store and Google Play.

**Customization elements:**

- App name (your agency's branded name)
- Logo (must be clean and readable at small icon size)
- Brand colors
- App description (for app store listings)
- Menu items

**Setup process:**

1. Upgrade to Agency Pro plan ($497/mo)
2. Gather brand assets (logo, colors, etc.)
3. Create Apple Developer account ($99/year) + Google Play account ($25 one-time)
4. Submit white label request through GoHighLevel dashboard
5. GoHighLevel provides a preview for review
6. Approve for launch
7. Timeline: approximately 1-2 weeks

**What clients access in the app:**

- Lead and contact management
- SMS, email, and chat messaging
- Pipeline deal viewing and updates
- Appointment booking and rescheduling
- Campaign activity reviews

**Other platforms with mobile apps:**

- **SuiteDash:** Free white-labeled mobile app included on all plans (no app store submission needed)
- **Clinked:** Custom app appears under your company name on App Store and Google Play
- **Zoho Creator:** White-label mobile apps with custom URLs and domains

---

## 7. THE DNS / CUSTOM DOMAIN SETUP EXPERIENCE (Pain Point Deep Dive)

### Why This Is Universally Painful

Every white-label platform requires DNS configuration, and it is consistently the #1 technical barrier for non-technical agency owners.

### GoHighLevel Domain Setup (5 Separate Domains!)

| Domain               | Purpose                              | DNS Record                           | Points To                               |
| -------------------- | ------------------------------------ | ------------------------------------ | --------------------------------------- |
| Whitelabel Domain    | Login/desktop app URL                | CNAME (subdomain, e.g., "app")       | whitelabel.ludicrous.cloud              |
| API Domain           | System-generated links in emails/SMS | CNAME (e.g., "link")                 | brand.ludicrous.cloud                   |
| Sites Domain         | Websites and funnels                 | A record (root) or CNAME (subdomain) | 162.159.140.166 / sites.ludicrous.cloud |
| Email Sending Domain | Outgoing email sender reputation     | TXT (SPF), CNAME, 2x MX, TXT (DMARC) | mailgun.org infrastructure              |
| Client Portal Domain | Memberships, communities, affiliates | CNAME (e.g., "memberships")          | clientportal.ludicrous.cloud            |

**Common pitfalls:**

- Using root domain instead of subdomain disconnects existing website/email
- Cloudflare users must toggle proxy OFF (grey cloud, not orange)
- Duplicate A records cause 404 errors
- DNS propagation takes 24-72 hours
- Some providers (e.g., Google Domains) limit MX records
- Domain Connect (auto-setup) only works with Google, Cloudflare, GoDaddy

### Email Sending Domain Setup (Universal Pattern)

All platforms using email services (Mailgun, SendGrid, etc.) require:

1. **SPF Record:** TXT record authorizing the sending server (e.g., v=spf1 include:mailgun.org ~all)
2. **DKIM Record:** CNAME or TXT record with cryptographic public key for message authentication
3. **DMARC Record:** TXT record defining email authentication policy (e.g., v=DMARC1;p=none;)
4. **MX Records:** For bounce handling (platform-specific)
5. Verification can take up to 48 hours

### Other Platforms

**DashClicks:** Custom domain requires DNS update, shows "Pending" until activated (Pro Plan only)
**Duda:** Platform domain + site domain, both via CNAME. Auto-SSL for all white-label domains.
**Simvoly:** Connect custom domain to branded platform. AWS hosting and SSL included automatically.
**SuiteDash:** Automated domain mapping tool (Pinnacle plan). Replaces SuiteDash URL with yours.
**10Web:** Connect domain, add branding "in minutes." Subdomains under your control.

---

## 8. THE SNAPSHOT / TEMPLATE SYSTEM (GoHighLevel's Key Innovation)

### What Snapshots Are

A snapshot captures the entire configuration of a sub-account:

- All pipelines
- All workflows and automations
- All funnels and websites
- All email/SMS templates
- All calendar configurations
- All form fields and custom values
- All reporting dashboard layouts

### How Agencies Use Snapshots

1. **Build once per vertical:** Create one snapshot for dental, one for real estate, one for HVAC, etc.
2. **Apply to new clients:** When a new dental client signs up, the "dental snapshot" deploys instantly
3. **Time savings:** Reduces setup from 8-15 hours to 2-4 hours per client
4. **Consistency:** Every client gets the same proven foundation
5. **Sellable asset:** Agencies sell snapshots to other agencies (marketplace model)

### Snapshot in SaaS Mode

- Snapshots are attached to SaaS plans in the Configurator
- When a customer purchases a plan, the associated snapshot is automatically applied
- Client gets a fully configured workspace immediately upon signup

### No Other Platform Matches This

- Vendasta has no equivalent -- relies on marketplace apps that are configured individually
- DashClicks has service fulfillment but not replicable account templates
- Simvoly has template libraries but not full-account snapshots
- This is GoHighLevel's strongest competitive moat for reseller experience

---

## 9. MANAGING MULTIPLE CLIENTS AT SCALE

### What Agencies Actually Do Day-to-Day

**Agency View Operations (GoHighLevel):**

- View all sub-accounts in a single list with status indicators
- Agency Rolled-Up Reporting: key data from ALL sub-accounts aggregated
  - Performance metrics across all clients in one view
  - Ability to spot underperforming accounts quickly
- Quick-switch between sub-accounts without logging out
- Manage user roles and permissions across all locations
- Adjust SaaS plan assignments per client
- Enable/disable features per client
- Monitor billing and usage across all clients

**DashClicks Multi-Client Management:**

- Main account reviews sub-account data within specific applications
- Insights on ad campaigns, websites, SEO, listings, social media per sub-account
- Projects app for managing onboarding documents, client websites, marketing performance
- Unlimited sub-accounts and users

**Vendasta Multi-Client Management:**

- Manage Accounts section with bulk import capability
- Product activation per account
- CRM with pipeline tracking
- Task Manager for workflow coordination
- Automated campaigns (prebuilt, auto-triggered)
- Email marketing campaigns and automations

**Scaling Pain Points:**

- More than 3 simultaneous client onboardings without a specialist = quality degradation (GHL)
- Untrained clients churn 40% more regardless of technical setup quality
- Agencies managing 3-4x more clients with automation vs. manual workflows
- Support demands grow exponentially with client count
- Template everything: new client setup should take 4-6 hours, not 20

---

## 10. COMMON PAIN POINTS AND FRUSTRATIONS

### Setup Complexity

- GoHighLevel requires configuring 5 separate DNS domains
- Multiple Stripe integrations (agency level AND sub-account level)
- Snapshot creation requires building a complete reference sub-account first
- Initial SaaS mode setup: estimated 2-8 hours for a first-time agency owner
- Mobile app setup requires Apple Developer ($99/yr) and Google Play ($25) accounts

### Technical Barriers

- DNS configuration is consistently the #1 technical blocker
- 24-72 hour propagation delays create anxiety ("Is it working or did I mess up?")
- Cloudflare proxy settings cause mysterious failures
- Email authentication (SPF/DKIM/DMARC) is confusing for non-technical users
- SSL certificate issues when DNS is misconfigured

### Branding Limitations

- Most platforms offer only logo + 2-3 colors for customization
- No deep CSS/theme customization (except Simvoly with custom CSS/JS)
- Login page customization is limited (usually just background image + logo)
- Mobile app customization is surface-level (name, icon, colors)
- System-generated emails often still contain subtle platform branding
- API-generated links can leak the underlying platform if not properly configured

### Client Management Friction

- Onboarding is labor-intensive: 14-day process is "best practice" for GHL
- Clients expect immediate results but setup takes days/weeks
- Training clients is essential but time-consuming (Loom videos, calls)
- Client expectations misalignment causes 30-50% rework
- Billing disputes when usage-based charges surprise clients

### Vendor Dependency

- Zero control over bugs, feature requests, or platform direction
- Vendor's changing business model can leave you stranded
- If vendor fails, you may need to purchase source code (expensive, unfamiliar)
- Platform outages affect ALL your clients simultaneously
- Price increases by vendor squeeze your margins

### Quality and Retention

- Losing 70% of clients in 2 years if you only sell them one product
- Service quality depends on white-label provider's execution
- Untrained clients churn 40% more than trained ones
- Slow onboarding loses clients; rushed onboarding causes churn
- Poor client retention reflects on agency, not platform

### Pricing Challenges

- Determining correct white-label pricing is difficult
- Resellers unsure how much markup is acceptable
- Hidden costs (Twilio usage, email sending, AI credits) hard to predict
- Vendasta's per-tool, per-client costs accumulate unpredictably
- GoHighLevel's rebilling is always in USD regardless of client currency

---

## 11. PLATFORM-BY-PLATFORM COMPARISON: RESELLER EXPERIENCE

### GoHighLevel

| Aspect                  | Details                                                           |
| ----------------------- | ----------------------------------------------------------------- |
| **Entry Cost**          | $497/mo (Agency Pro plan)                                         |
| **Sub-Accounts**        | Unlimited, included                                               |
| **Branding Depth**      | 5 custom domains, logo, colors, mobile app                        |
| **Client Provisioning** | Automated via SaaS mode or manual                                 |
| **Feature Control**     | Per-plan AND per-client toggles, marketplace app blocking         |
| **Billing**             | Stripe Connect, 100% revenue control, usage rebilling             |
| **Snapshot System**     | Full account templates, deployable instantly                      |
| **Mobile App**          | White-label iOS/Android ($99/yr Apple + $25 Google)               |
| **Key Strength**        | Most comprehensive white-label, best for building "your own SaaS" |
| **Key Weakness**        | Setup complexity, 5 DNS domains, steep learning curve             |

### Vendasta

| Aspect                  | Details                                               |
| ----------------------- | ----------------------------------------------------- |
| **Entry Cost**          | ~$500-$1,000/mo (not publicly listed)                 |
| **Sub-Accounts**        | Per-account pricing                                   |
| **Branding Depth**      | Branded Business App portal, sales collateral         |
| **Client Provisioning** | Manual via Partner Center or bulk import              |
| **Feature Control**     | Product activation per account                        |
| **Billing**             | Commission-based, revenue shared with vendors         |
| **Snapshot System**     | None -- marketplace app model                         |
| **Mobile App**          | Business App (not agency-branded)                     |
| **Key Strength**        | 250+ marketplace apps, local business focus           |
| **Key Weakness**        | Revenue sharing, per-client costs, less customization |

### DashClicks

| Aspect                  | Details                                                             |
| ----------------------- | ------------------------------------------------------------------- |
| **Entry Cost**          | Free plan available; Pro for white-labeling                         |
| **Sub-Accounts**        | Unlimited                                                           |
| **Branding Depth**      | Logo, favicon, login image, 3 colors, custom domain (Pro)           |
| **Client Provisioning** | Automatic on purchase (free plan)                                   |
| **Feature Control**     | Structural: sub-accounts restricted from specific apps              |
| **Billing**             | Per-service fulfillment pricing                                     |
| **Snapshot System**     | None                                                                |
| **Mobile App**          | Not mentioned                                                       |
| **Key Strength**        | Fulfillment services included, easy onboarding                      |
| **Key Weakness**        | Less granular feature control, Pro required for full white-labeling |

### SuiteDash

| Aspect                  | Details                                                              |
| ----------------------- | -------------------------------------------------------------------- |
| **Entry Cost**          | $19-$99/mo                                                           |
| **Sub-Accounts**        | Unlimited users on all plans                                         |
| **Branding Depth**      | Full white-label even on Start plan; custom domain at Pinnacle ($99) |
| **Client Provisioning** | Automated onboarding (intake forms, e-sign, scheduling)              |
| **Feature Control**     | Portal page access per contact or Circle                             |
| **Billing**             | Built-in invoicing and estimates                                     |
| **Snapshot System**     | None                                                                 |
| **Mobile App**          | Free white-labeled mobile app on all plans                           |
| **Key Strength**        | Most affordable full white-label, free mobile app                    |
| **Key Weakness**        | Less marketing automation, smaller ecosystem                         |

### Simvoly

| Aspect                  | Details                                                           |
| ----------------------- | ----------------------------------------------------------------- |
| **Entry Cost**          | Up to $199/mo for White Label Pro                                 |
| **Sub-Accounts**        | Managed via projects with access levels                           |
| **Branding Depth**      | Logo, domain, CSS/JS, templates, system emails, academy           |
| **Client Provisioning** | Fully self-serve (customer registers, picks template, subscribes) |
| **Feature Control**     | Plan-based feature sets                                           |
| **Billing**             | Direct Stripe connection, agency sets own plans                   |
| **Snapshot System**     | Template libraries (not full-account)                             |
| **Mobile App**          | Not mentioned                                                     |
| **Key Strength**        | Deepest visual customization (CSS/JS), fully self-serve model     |
| **Key Weakness**        | Website/funnel focused only, not full CRM/marketing               |

### Duda

| Aspect                  | Details                                                     |
| ----------------------- | ----------------------------------------------------------- |
| **Entry Cost**          | Custom/enterprise pricing                                   |
| **Sub-Accounts**        | Per-site model                                              |
| **Branding Depth**      | Branded editor, client dashboard, SSL auto-generated        |
| **Client Provisioning** | Agency creates sites, grants client access                  |
| **Feature Control**     | Granular permissions, predefined + custom roles             |
| **Billing**             | Client billing management built-in                          |
| **Snapshot System**     | Agency templates                                            |
| **Mobile App**          | Not mentioned                                               |
| **Key Strength**        | Best client permission system, professional website builder |
| **Key Weakness**        | Website-only (no CRM, marketing automation, SMS)            |

### 10Web

| Aspect                  | Details                                          |
| ----------------------- | ------------------------------------------------ |
| **Entry Cost**          | Custom pricing for reseller                      |
| **Sub-Accounts**        | Self-serve or invite-based                       |
| **Branding Depth**      | 100% branded dashboard, emails, invoices, domain |
| **Client Provisioning** | Self-serve or direct invite                      |
| **Feature Control**     | Pre-installed plugin control, role-based access  |
| **Billing**             | 10Web Payments, custom tiers, trial periods      |
| **Snapshot System**     | Plugin presets                                   |
| **Mobile App**          | Not mentioned                                    |
| **Key Strength**        | Dedicated account manager, AI website builder    |
| **Key Weakness**        | WordPress-only ecosystem                         |

---

## 12. INSIGHTS FROM THE HACKER NEWS / REAL-WORLD DISCUSSION

### What People Actually Say About White-Label Reselling

**The Good:**

- One commenter describes 11 years of successful white-label partnerships where resellers handle B2C/B2B niches the platform company cannot efficiently reach
- Resellers can make "avg. 6x on top" profit margins by adding market-specific specializations
- Geographic advantage: "You'll never be #1 in Brazil and Pakistan if you do it yourself, but resellers can make a great living off that"

**The Bad:**

- "When there are bugs, issues, or feature requests, you can't fix them, you can only try and hope that the developers will fix them" -- zero control over customer experience
- One startup became dependent on white-labeled delivery SaaS; when vendor failed, they had to purchase source code at significant cost, then struggled maintaining unfamiliar code
- Multiple commenters compare it to dropshipping as a "get rich quick with no effort" model
- Determining correct white-label pricing remains difficult for most resellers

**The Consensus:**
White-labeling works best when resellers add genuine value through specialized knowledge, customer support, or market access -- not merely as a rebrand-and-resell operation. Value Added Resellers (VARs) who provide genuine specialization and support succeed; simple rebranders who add no real value struggle.

---

## 13. KEY OPPORTUNITIES FOR SURGENT

Based on this research, the major gaps and opportunities are:

### 1. Setup Simplicity

- GoHighLevel requires 5 DNS domains -- Surgent could reduce this to 1 (or zero with automatic subdomain provisioning)
- Email authentication could be handled automatically (managed email infrastructure)
- Stripe connection is standard -- cannot avoid, but can streamline

### 2. Branding Depth Without Complexity

- Most platforms offer shallow branding (logo + 2 colors)
- Simvoly proves agencies want CSS/JS-level control
- Opportunity: theme system with deep customization that does not require CSS knowledge (visual theme builder)

### 3. Self-Serve Client Onboarding

- Simvoly's model (customer registers, picks template, subscribes without agency intervention) is the gold standard for scale
- GoHighLevel's SaaS mode automates provisioning but still requires agency-built funnels
- Opportunity: built-in signup flow that agencies configure once, clients self-serve forever

### 4. Snapshot-Level Account Templates

- GoHighLevel's snapshot system is the strongest competitive moat in the market
- No other platform offers full-account duplication
- Surgent should match or exceed this from day one

### 5. Simplified Feature Control

- Feature toggling should be visual and immediate (not buried in settings)
- Plan-builder UI with drag-and-drop feature selection
- Per-client overrides with one click

### 6. Transparent Usage Billing

- Usage-based costs (SMS, email, AI) surprise clients
- Opportunity: dashboard showing real-time usage and projected costs
- Alert system when clients approach limits

### 7. Mobile App Without the Hassle

- SuiteDash's approach (free mobile app included, no app store submission) is more accessible
- GoHighLevel's approach (custom app store listing) is more professional but expensive and slow
- Opportunity: PWA-first approach that works immediately, with optional native app for premium tiers

### 8. Client Dashboard That Proves Value

- Every platform has dashboards but few show ROI clearly
- Opportunity: automatic ROI tracking showing "you spent $X, you gained $Y in leads/revenue"
- This directly addresses the #1 churn reason: clients not seeing value

---

## Sources

### GoHighLevel

- [SaaS Mode Full Setup Guide](https://help.gohighlevel.com/support/solutions/articles/48001184920-saas-mode-full-setup-guide-faq)
- [Guide to SaaS Plan Creation, Sales, and Customer Onboarding](https://help.gohighlevel.com/support/solutions/articles/155000003670-guide-to-saas-plan-creation-sales-and-customer-onboarding)
- [Setting Up Whitelabel Domains](https://help.gohighlevel.com/support/solutions/articles/155000002561-setting-up-whitelabel-domain-api-domain-email-sending-domain-sites-domain-client-portal-domain-)
- [White Label Setup Guide (Automize)](https://getautomized.com/gohighlevel-white-label-setup/)
- [White-Label Client Onboarding Playbook (ECOSIRE)](https://ecosire.com/blog/gohighlevel-white-label-client-onboarding)
- [How to Whitelabel GoHighLevel (Bardeen)](https://www.bardeen.ai/answers/how-to-whitelabel-gohighlevel)
- [GoHighLevel White Label Complete Guide (ECOSIRE)](https://ecosire.com/blog/gohighlevel-white-label-saas-complete-guide)
- [GoHighLevel SaaS Mode (Ray O'Daniel)](https://rayodaniel.com/gohighlevel-saas-configurator/)
- [HighLevel White Label Mobile App Guide](https://ghlbuilds.com/highlevel-white-label-mobile-app/)
- [User Access in HighLevel](https://help.gohighlevel.com/support/solutions/articles/48000982600-user-access)
- [Managing Marketplace App Permissions](https://help.gohighlevel.com/support/solutions/articles/155000001163-managing-marketplace-app-permissions-white-label-agency-control)
- [GoHighLevel vs Vendasta Comparison](https://netpartners.marketing/gohighlevel-vs-vendasta-2025-white-label-saas-for-agencies-compared/)

### DashClicks

- [DashClicks White Label Dashboard](https://www.dashclicks.com/software/dashboard)
- [Main Accounts vs Sub-Accounts](https://help.dashclicks.com/en/articles/5828160-main-accounts-vs-sub-accounts)
- [Managing Business Branding](https://help.dashclicks.com/en/articles/5828196-managing-business-branding)
- [DashClicks White Label Software](https://www.dashclicks.com/white-label-software)

### Vendasta

- [Partner Center Overview](https://support.vendasta.com/hc/en-us/articles/4406960654743-Partner-Center-overview)
- [Business App](https://www.vendasta.com/platform/business-app/)
- [Partner Center Documentation](https://docs.vendasta.com/partner-center/overview)
- [White Label Software Partner Program](https://www.vendasta.com/blog/white-label-software-partner-program/)
- [Vendasta vs DashClicks](https://www.vendasta.com/compare/vendasta-vs-dashclicks/)

### SuiteDash

- [White Label Client Portal](https://suitedash.com/features/white-label-client-customer-portal-software/)
- [Client Portal Software](https://suitedash.com/features/client-portal-software/)
- [Onboarding Clients on Autopilot](https://suitedash.com/features/onboarding-clients-on-autopilot/)
- [Portal Pages](https://help.suitedash.com/article/53-creating-a-portal-page)

### Simvoly

- [White Label Builder Getting Started](https://simvoly.com/white-label-builder-getting-started)
- [Grow Your Digital Agency](https://simvoly.com/white-label)
- [Website Reseller Program](https://simvoly.com/website-reseller)
- [White Label Platform](https://simvoly.com/whitelabel-platform)

### Duda

- [White Label Features](https://www.duda.co/features/white-label-features)
- [Client Management](https://www.duda.co/client-management)
- [White Label Website Builder](https://www.duda.co/website-builder/white-label)

### 10Web

- [White Label Reseller Dashboard](https://10web.io/white-label-website-builder/reseller-dashboard/)
- [White Label Website Builder](https://10web.io/white-label-website-builder/)

### Pain Points & Industry Discussion

- [Top Challenges Faced by White-Label Resellers (Review Dingo)](https://www.reviewdingo.com/top-challenges-faced-by-white-label-resellers/)
- [7 Pain Points with White-Label Marketing Providers (White Shark Media)](https://www.whitesharkmedia.com/blog/white-label-marketing-provider/)
- [Hacker News: Reselling Software Discussion](https://news.ycombinator.com/item?id=31714448)

### Billing & Technical

- [White-label Payment Gateways (Stripe)](https://stripe.com/resources/more/white-label-payment-gateways)
- [Build a SaaS Platform (Stripe Connect Docs)](https://docs.stripe.com/connect/saas)
- [White Label Email Service (Mailgun)](https://www.mailgun.com/solutions/white-label-email-service/)
- [White Label Custom Domains (SEOptimer)](https://www.seoptimer.com/blog/white-label-custom-domains/)
- [White-Label Branding Best Practices (Collect)](https://www.usecollect.com/blog/white-label-branding-for-client-portals-best-practices/)
