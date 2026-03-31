# White-Label Software: End User (SMB Owner) Experience Research

**Date:** 2026-03-30
**Focus:** What the agency's client (SMB owner) actually sees, uses, and experiences when using white-labeled software

---

## Table of Contents

1. [What the End Client Actually Sees](#1-what-the-end-client-actually-sees)
2. [Agency View vs Client View: The Simplification Gap](#2-agency-view-vs-client-view-the-simplification-gap)
3. [Features Clients Actually Use Daily](#3-features-clients-actually-use-daily)
4. [What Confuses End Clients](#4-what-confuses-end-clients)
5. [How Clients Interact with AI Features](#5-how-clients-interact-with-ai-features)
6. [Mobile Experience](#6-mobile-experience)
7. [Client Portal & Dashboard Experience](#7-client-portal--dashboard-experience)
8. [Permission & Access Control Systems](#8-permission--access-control-systems)
9. [What Clients Wish Was Different](#9-what-clients-wish-was-different)
10. [What Makes Clients Stick (Retention)](#10-what-makes-clients-stick-retention)
11. [What Makes Clients Churn](#11-what-makes-clients-churn)
12. [Churn Statistics & Benchmarks](#12-churn-statistics--benchmarks)
13. [Platform-Specific Findings](#13-platform-specific-findings)
14. [CRM Usage Statistics](#14-crm-usage-statistics)
15. [Key Implications for Surgent](#15-key-implications-for-surgent)

---

## 1. What the End Client Actually Sees

### The White-Label Promise

The fundamental proposition: clients never see the underlying platform provider, only the agency's brand. This includes:

- **Custom logo, colors, and domain** -- the entire UI reflects the agency's brand
- **Custom login pages** -- branded email authentication and password recovery
- **Branded emails** -- all system notifications carry agency branding
- **Branded mobile app** (premium tier) -- agency's app in App Store/Play Store

### What a Typical Client Dashboard Shows

When an SMB owner logs in to their white-labeled platform, they typically see:

**GoHighLevel Sub-Account View:**

- Unified inbox (SMS, email, phone, Facebook Messenger, Instagram DM, WhatsApp, Google Business messages)
- Pipeline/opportunities with visual stages
- Calendar with appointments and bookings
- Contact list with smart filtering
- Basic reporting widgets (lead sources, conversion tracking, appointment stats)
- Client portal access (courses, community, affiliate commissions)

**Vendasta Business App View:**

- Single dashboard with profit and expenses
- Website traffic, SEO, advertising, digital listings, social media, reputation metrics
- Lead capture and appointment management
- Review management
- E-commerce tools
- QuickBooks integration for financial data
- Multi-location roll-up view for multi-location businesses

**SuiteDash Client Portal View:**

- Project timeline and task assignments
- Invoice viewing and payment
- File upload and document sharing
- Messaging/communication threads
- E-signature functionality
- KPIs and progress tracking

**vcita/inTandem View:**

- CRM with client records
- Online scheduling and booking
- Invoice and payment processing
- Email marketing campaigns
- Document sharing
- BizAI assistant for automated recommendations

### The "One Login" Reality

The best white-label platforms achieve "one experience, one password, one bill" (Vendasta's framing). SMB owners get a single integrated dashboard where leads, communications, reviews, payments, and analytics live in one place. This is a critical differentiator from the fragmented multi-tool reality most SMBs face.

---

## 2. Agency View vs Client View: The Simplification Gap

### What the Agency Sees (That the Client Doesn't)

White-label platforms maintain a clear hierarchy of visibility:

**Agency-Level Controls (Hidden from Client):**

- Multi-client account management and switching
- Template Library (can be hidden per sub-account)
- App Marketplace (can be toggled off for sub-accounts)
- SaaS plan configuration and pricing
- White-label DNS/domain settings
- Snapshot deployment tools
- Cross-client reporting and analytics
- Billing and rebilling infrastructure
- Workflow builder (complex automation engine)
- User permission management across all clients

**Client-Level View (What They See):**

- Only their own business data (fully isolated)
- Only enabled modules (agency controls which are visible)
- Only assigned data (if "Only Assigned Data" toggle is on)
- Simplified dashboard with relevant widgets
- Branded experience throughout

### The Permission Architecture (GoHighLevel)

GoHighLevel has the most documented permission system:

**Two-Tier Control:**

1. **Sub-Account Level** (acts as a ceiling) -- Controls which modules/features are available at all
2. **User Level** (within that ceiling) -- Further restricts what individual users can do

**Key principle:** "A User cannot have more permissions than the Sub-Account Level permissions allow."

**Module Toggles (28+ modules):**

- AI Agents, Calendars, Conversations, Workflows
- Contacts, Opportunities, Payments, Forms
- Funnels, Integrations, Marketing, Reputations
- WordPress, Memberships, Quizzes, Surveys
- Each can be completely toggled off

**Granular Permission Controls:**

- Export data (controls who can export dashboard widget data)
- Calendar permissions (booking access to specific calendars vs full management)
- Workflow management (users without access can't interact, but automations keep running in the background)
- "Only Assigned Data" toggle: users see exclusively contacts assigned to them, opportunities where they're the owner, and appointments linked to their name

### The Simplification Strategy

The best white-label experiences follow a clear pattern:

| Aspect     | Agency View                            | Client View                                 |
| ---------- | -------------------------------------- | ------------------------------------------- |
| Navigation | Full platform with all modules         | Curated set of enabled features             |
| Data       | Cross-client, all contacts             | Only their business, only assigned data     |
| Automation | Workflow builder, complex logic        | They experience the results, not the engine |
| Reporting  | Multi-client dashboards, attribution   | Their KPIs, their leads, their revenue      |
| Settings   | Full configuration                     | Profile, basic preferences                  |
| Billing    | Stripe integration, rebilling controls | Simple invoice/payment view                 |
| Templates  | Full library, snapshot management      | Pre-configured, ready to use                |

---

## 3. Features Clients Actually Use Daily

### The Core Daily Actions (Based on Real User Data)

**#1: Unified Conversations/Inbox (Highest Daily Usage)**

- Checking and responding to SMS messages from leads
- Reviewing missed call notifications
- Responding to Facebook Messenger and Instagram DMs
- Reviewing email inquiries
- WhatsApp messages (where applicable)
- This is the single most-used feature daily

**#2: Calendar & Appointment Management**

- Checking today's appointment schedule
- Receiving booking notifications
- Reviewing upcoming appointments
- Managing cancellations/reschedules
- Sending appointment reminders (often automated)

**#3: Pipeline/Lead Tracking**

- Checking new leads that came in
- Moving leads through pipeline stages
- Reviewing which leads need follow-up
- Checking lead source attribution

**#4: Notifications & Alerts**

- Push notifications for new leads
- Missed call text-back alerts
- Appointment reminders
- Review alerts (new Google/Facebook reviews)

**#5: Basic Reporting**

- How many leads this week/month
- Where leads are coming from
- Conversion rates
- Revenue tracking

### What They DON'T Touch Daily

- Workflow/automation builder (agency handles this)
- Funnel/website editor (agency handles this)
- Email template design
- Integration settings
- Advanced reporting/analytics
- User permission management

### The "94% Problem"

94% of SMB employees say they perform repetitive, time-consuming tasks in their role. 44% say they're not highly efficient or productive. The white-label tools that win are those that automate the repetitive work (lead follow-up, appointment reminders, review requests) while giving the SMB owner visibility into results.

---

## 4. What Confuses End Clients

### The Complexity Problem

**Feature Overload:**

- 43% of CRM users use less than half of available features
- 22% of sales professionals remain unsure how to use CRM to full potential
- SMBs lack dedicated IT departments, making utilization challenging
- "Most CRM packages enterprise complexity with enterprise pricing -- then market it as 'SMB-friendly.'"

**Specific Confusion Points:**

1. **Too Many Tabs/Modules:** Even with permission controls, clients often see more features than they need. The "kitchen sink" approach overwhelms non-technical SMB owners.

2. **Workflow/Automation Understanding:** Clients experience automated actions (texts, emails) without understanding why they happened. When something goes wrong (like the GoHighLevel user who had 171 irrelevant emails sent to wrong contacts), they can't diagnose or fix it themselves.

3. **Multiple Settings Panels:** One user complained the funnel builder required "3 separate settings panels" with controls "spread out on opposite sides of the screen."

4. **Email Deliverability (Technical):** Users don't understand SPF, DKIM, DMARC -- they just see their open rates drop from 35-40% to 9% and don't know why.

5. **Hidden Costs:** Unexpected charges for SMS usage, email sending, phone numbers, and add-ons confuse SMB owners who expected a flat monthly fee.

6. **Multi-Device Inconsistency:** 81% of users access CRM from multiple devices (48% via mobile, 45% via tablet), but mobile apps have significantly reduced functionality compared to desktop.

### The Learning Curve Reality

- GoHighLevel's workflow builder is described as having the platform's "steepest learning curve"
- One user said it took them "a few years and required a tech team to understand" the platform
- "The system was described as not intuitive or user-friendly, with difficulty during initial setup"
- 32% cite lack of technical expertise as the biggest CRM obstacle
- 70% of CRM projects fail due to poor adoption and cross-departmental misalignment

### The "Three Separate Settings Panels" Problem

A key negative review from an experienced agency owner (10+ years, former Keap user):

- Invested 30-40 hours migrating to GoHighLevel
- Found the funnel builder required navigating "3 separate settings panels"
- Described the platform as "a work-in-progress rather than a polished product"
- Email open rates plummeted from 35-40% to 9%
- Unexpected charges appeared regularly on credit card statements
- Platform charged per email sent through their servers, plus add-on fees

---

## 5. How Clients Interact with AI Features

### Current AI Feature Landscape

**GoHighLevel AI Employee (Most Advanced):**

What the end client's CUSTOMERS experience:

- **Voice AI:** Answers inbound calls with sub-600ms latency. Customers "feel like they are talking to a real, helpful human receptionist who never sleeps." It qualifies leads, books appointments in real-time (checking calendar availability, handling time-zone conversions), and routes calls.
- **Conversation AI:** Handles incoming SMS, Facebook Messenger, Instagram DM, and website chat automatically. Tracks full conversation context -- if a customer asks about pricing, switches to location questions, then asks for a discount, the AI tracks the entire thread.
- **Review AI:** Generates and sends review requests; responds to Google reviews automatically.

What the SMB owner (agency client) experiences:

- AI runs in the background, handling conversations they would otherwise need to manage manually
- They see AI-handled conversations in their unified inbox
- AI-booked appointments appear in their calendar
- AI-generated review responses show up in their reputation management dashboard

**Stammer.ai / Chatbase / White-Label AI Chatbots:**

- Clients get a branded dashboard showing AI value metrics (e.g., "847 calls handled this month")
- Revenue comparison: "You'd have spent $4,000 on staff" -- making renewal obvious
- Sub-Account Wallet system: clients pre-load funds, usage deducted per message/call
- Clients see the results (booked appointments, answered questions) without managing the AI

**vcita/inTandem BizAI:**

- Built-in AI assistant that automates time-consuming tasks
- Provides real-time recommendations
- "Seamlessly blending into the user's daily tasks"

### The AI Value Proposition for End Clients

The key insight: SMB owners don't interact WITH AI features directly -- they experience the RESULTS of AI features. The best implementations make AI invisible:

- Phone gets answered 24/7 (they used to miss 30% of calls)
- Leads get followed up instantly (they used to take hours/days)
- Reviews get responded to automatically (they used to ignore them)
- Appointments get booked without back-and-forth (they used to play phone tag)

**Pricing:** Usage-based or "$97/mo unlimited per sub-account" (GoHighLevel)

---

## 6. Mobile Experience

### The Three Mobile App Tiers

**GoHighLevel's Approach (Industry Standard):**

1. **HighLevel App** -- Agency-branded, supports multi-account management
2. **LeadConnector App** -- Neutral/unbranded, for clients. No multi-account support
3. **White-Label App** -- Fully custom branded (agency's logo/colors), $497/month add-on, listed in App Store under agency's name

All three are functionally identical in features but differ in branding and multi-account capabilities.

### What's Available on Mobile

**Features present on mobile:**

- Calls, texts, and unified inbox
- Calendar management
- Contact management and pipeline view
- Invoice viewing
- Business card scanning
- Tap-to-pay functionality
- Universal search across contacts/conversations/opportunities
- Ask AI assistant
- Dark mode
- Push notifications for new leads, messages, appointments

**Features NOT available on mobile:**

- Workflow/automation builder
- Website/funnel editor
- Email template design
- Form builder
- Complex reporting/analytics
- Advanced settings

### Mobile App Pain Points

**Historical Issues (Pre-2025 Redesign):**

- "Lead Connector App is horrible compared with many other apps in the market. Look and Functionality are pretty old school."
- "This app keeps breaking, resulting in us missing calls from leads, which is costing us money from lost sales."
- Call functionality described as "subpar, with constant buzzing/vibration indicating low quality even on good WiFi connections"

**Post-2025 Redesign (v4.0):**

- Dynamic role-aware homepage
- Universal search across contacts/conversations/opportunities
- Redesigned App Drawer organized by business function
- "Now a functional primary tool -- not just a backup" for agency owners
- Improved performance and notifications

### Mobile Usage Statistics

- 81% of CRM users access from multiple devices
- 48% use mobile specifically
- 50% of teams report increased productivity with mobile CRM
- 65% of teams using mobile CRM achieve sales quotas vs. 22% without mobile access
- Mobile app update is critical: "improved performance, better notifications and an intuitive interface designed for daily use"

### App Store Challenges

White-label apps face a specific App Store risk:

- "If white-label apps are too similar in content, design, or functionality, they risk being flagged for duplication"
- Need to prove uniqueness to Apple/Google reviewers
- Publishing process: typically about one business week; some providers deliver in 48 hours

---

## 7. Client Portal & Dashboard Experience

### GoHighLevel Client Portal

**Components:**

- Affiliate commission tracking and payouts
- Membership courses (video courses, learning content)
- Community groups (discussions, events, polls, networking)
- Forms and invoices
- Single sign-on across all portal areas

**Client Portal Dashboard Metrics:**

- Invited Users count vs. Joined Users count
- Magic Link generation for passwordless login
- User invitation management

**Client Portal Registration Flow:**

1. Client provides name, email, password
2. Verification code sent (valid 15 minutes)
3. Multi-account handling if email linked to multiple accounts
4. Profile completion required to unlock full functionality
5. App switcher for navigating between courses, community, affiliate tools

### What SMB Owners Actually Look At

**Daily/Real-Time:**

- New lead notifications
- Inbox messages requiring response
- Today's appointment schedule
- Missed calls/texts

**Weekly:**

- Lead count and source breakdown
- Pipeline progression
- Revenue/closed deals
- Review score changes

**Monthly:**

- ROI dashboards
- Campaign performance
- Overall growth metrics
- Customer acquisition costs

**Dashboard Design Best Practice:**

- "Not every client needs to see every metric -- create tailored views highlighting the KPIs each client cares about most"
- "Create hierarchy with size and color, making most important KPIs larger and using brighter colors only for metrics needing attention"
- 80%+ of clients reviewing reports weekly or monthly are satisfied with daily data refresh
- "Many clients who request 'real-time' actually need 'same-day' data"

---

## 8. Permission & Access Control Systems

### GoHighLevel (Most Granular)

**Sub-Account Level Controls:**

- Toggle entire modules on/off (28+ modules)
- Hide Template Library entirely or by product/module
- Hide App Marketplace from sub-account users
- Control billing and financial action access
- Restrict company configuration settings

**User Level Controls (Within Sub-Account Ceiling):**

- Admin role (full access within sub-account)
- User role (restricted, customizable)
- "Only Assigned Data" toggle (see only their own contacts, opportunities, appointments)
- Export data permission
- Calendar-specific permissions
- Module-level and action-level granularity (e.g., view invoices but not edit them)

**SaaS Mode Permissions:**

- Plans define the permission ceiling
- Each subscription tier can enable/disable different feature sets
- Sub-Account Level permissions override User Level
- Agencies can create tiered plans (Basic/Pro/Enterprise) with different feature access

### Vendasta

- Unlimited users per business account
- Multi-location roll-up for business owners with multiple locations
- Partner/agency always has full visibility
- Client sees only their business data and purchased solutions

### SuiteDash

- Role-based access (staff vs client vs admin)
- Custom dashboards per user type
- Project-level permissions
- File sharing with granular access controls

---

## 9. What Clients Wish Was Different

### Top Client Frustrations

**1. Simpler Interface / Less Overwhelming**

- Clients want to see only what they need, not a platform designed for power users
- "CRM failures often aren't technical -- they're behavioral. If users find the system complex or slow, they avoid it."
- Feature overload leads to underutilization, which leads to churn during budget cuts

**2. Better Email Deliverability**

- Most cited weakness in GoHighLevel specifically
- Users migrating from ActiveCampaign/Mailchimp see inbox placement drops
- Requires technical DNS configuration most SMB owners can't do themselves

**3. More Polished Design**

- GoHighLevel design "doesn't match Webflow-level aesthetics"
- LeadConnector app was described as "old school" in look and functionality (pre-2025)
- SMB owners compare against consumer apps (Instagram, Uber) and find business tools lacking

**4. Transparent, Predictable Pricing**

- Unexpected per-message, per-email, per-call charges
- "Essential automation locked behind enterprise tiers"
- "Per-seat pricing that limits visibility" prevents non-sales departments from accessing data
- SMBs want "clear upfront, fixed-fee implementation costs"

**5. Faster Time to Value**

- "Weeks of setup before the value appears" delays ROI
- SMBs want rapid deployment (hours, not weeks)
- Pre-configured workflows requiring minimal setup
- 43% of all SMB customer losses occur within the first 90 days -- if they don't see value fast, they leave

**6. Better Mobile Parity**

- Mobile apps have "very limited" functionality compared to desktop
- Can't access builders (workflows, SMS, email, forms) on mobile
- SMBs increasingly want mobile-first design

**7. Better Customer Support**

- "Response quality is uneven; the community often responds faster than official support"
- One user: "support staff being untrained and borderline useless"
- Support email auto-responders directing to broken links

**8. AI Features Available at All Tiers**

- "AI-driven tools available at all pricing tiers, not just premium levels"
- Smaller businesses being priced out of automation that could help them most

### What SMBs Actually Want (Research Summary)

- Unlimited user access without incremental seat costs
- Rapid deployment in hours, not weeks
- Pre-configured workflows requiring minimal setup
- AI and automation features at every pricing tier
- Integrated sales, marketing, email, SMS, call tracking, and analytics in one place
- Mobile-first design prioritizing adoption
- Simplified UI that encourages natural usage
- No cost escalation penalties for growth
- Transparent pricing without hidden tiers

---

## 10. What Makes Clients Stick (Retention)

### The Stickiness Hierarchy

**Level 1: Daily Workflow Integration (Strongest)**

- When the platform becomes part of daily operations (checking inbox, managing appointments, tracking leads), switching costs become enormous
- "When your branded platform becomes part of your clients' daily workflow, it becomes indispensable... You're no longer just a vendor they pay each month; you've become an essential part of their operational fabric."

**Level 2: Data Lock-In**

- Contact databases, conversation history, pipeline data, automation workflows
- The more data clients put in, the harder it is to leave
- "Switching to a different provider would disrupt their operations"

**Level 3: Multi-Function Integration**

- "When SEO services connect seamlessly with PPC management, reputation monitoring, and analytics reporting, clients experience the comprehensive digital marketing ecosystem that makes switching vendors extremely difficult"
- Product bundling massively improves retention: "SMBs who are sold one product have a retention rate of 30% after two years, while products sold together show increased retention"

**Level 4: Transparent Reporting**

- "Structured, consistent reporting communication reduced client churn by 40%"
- Clients seeing clear ROI in branded dashboards cancel at significantly lower rates
- White-label reporting lets agencies show: "This is what we're doing for you, and here's the proof"

**Level 5: AI/Automation Value**

- AI-handled calls and chats create visible value: "847 calls handled -- you'd have spent $4,000 on staff"
- Automated lead follow-up converts leads they would have lost
- Review automation maintains their online reputation without effort

### Key Retention Statistics

- White-label partnerships enable 42% higher client retention than agencies operating independently
- Clients using multiple bundled products have dramatically higher retention
- Customer acquisition costs are 5-25x higher than retention costs
- Habit formation is critical: "The more frequently users return, the less likely they are to churn"

---

## 11. What Makes Clients Churn

### Primary Churn Drivers for SMBs

**1. Poor Onboarding / Slow Time-to-Value (Biggest Factor)**

- 43% of all SMB customer losses occur within the FIRST 90 DAYS
- 20% of voluntary churn linked to poor onboarding (first 30 days critical)
- "If customers don't get value fast, they leave"
- SMBs need to see results in days, not weeks

**2. Budget Constraints**

- "Every dollar counts for small businesses, so when budgets tighten they cut expenses fast -- including software subscriptions"
- Month-to-month plans allow easy exit with minimal friction
- Hidden/escalating costs create resentment

**3. Feature Overload / Underutilization**

- 43% of CRM users use less than half available features
- "SMBs struggle with complex offerings and underutilization, leading to churn during budget cuts"
- ~27% of software spending goes unused

**4. Payment Failures (Involuntary Churn)**

- Up to 40% of total churn from payment failures
- Expired credit cards account for 42% of payment failures
- Smart retry logic recovers 68% vs. single-retry at 23%

**5. Competitive Pressure**

- "Low barriers to entry in SaaS means new competitors popping up all the time"
- "67% of small businesses that outsourced marketing services switched providers within six months"
- Low switching costs without deep operational integration

**6. Poor Support**

- Bad communication between service providers leads to broken client relationships
- When things go wrong with white-label software, "customers place the blame on the reseller because their logo is on it"

**7. Lack of Demonstrated Value**

- Without clear reporting showing ROI, clients question the monthly spend
- Usage decline: 41% drop in activity in the quarter preceding cancellation (90-day warning window)
- Only 1 of 26 unhappy customers actually complain before churning (silent churn)

### Early Warning Signals

- Login frequency decline: 60-day lead time before churn
- Support ticket spikes: 3x higher churn risk
- Feature adoption below 30%: 80% first-year churn correlation
- NPS below 20: 2x normal churn rates
- Usage monitoring improves retention 15% vs. relationship-only approach

---

## 12. Churn Statistics & Benchmarks

### SMB SaaS Churn Rates

| Metric                       | Rate             | Context                        |
| ---------------------------- | ---------------- | ------------------------------ |
| SMB monthly churn            | 3-7%             | Translates to 31-58% annual    |
| Enterprise monthly churn     | Below 1.5%       | 5.8x better retention than SMB |
| SMB-focused SaaS good target | Below 5% monthly | Industry benchmark             |
| Marketing/Sales tools        | 4.8-8.1% monthly | High competition vertical      |
| MarTech specifically         | 6.2% monthly     | ROI challenges                 |
| Month-to-month plans         | 16% annual       | Low commitment                 |
| Multi-year contracts         | 8.5% annual      | Strongest lock-in              |

### Revenue Impact

| Metric                         | Data Point                          |
| ------------------------------ | ----------------------------------- |
| Average CRM ROI                | $8.71 per $1 spent                  |
| Conversion rate increase       | 300% for CRM users                  |
| Sales boost                    | 29% overall; 87% with full adoption |
| Marketing cost reduction       | 32%                                 |
| Lead conversion improvement    | 17%                                 |
| Customer retention improvement | 16%                                 |

### AI-Native SaaS Churn (Important for Surgent)

| Tier                        | GRR | NRR | Notes                        |
| --------------------------- | --- | --- | ---------------------------- |
| Premium AI tools ($250+/mo) | 70% | 85% | Better retention             |
| Budget AI tools (<$50/mo)   | 23% | 32% | "AI tourist" effect          |
| Overall AI-native SaaS      | 40% | 48% | Well below B2B median of 82% |

**Key insight:** AI tools at lower price points suffer dramatically higher churn. The "AI tourist" effect means users try cheap AI tools out of curiosity but don't form habits. Premium pricing correlates with commitment and usage.

### Net Revenue Retention Benchmarks

| Segment       | NRR              |
| ------------- | ---------------- |
| SMB           | 90-105%          |
| Mid-market    | 108%             |
| Enterprise    | 115-125%         |
| Best-in-class | 130%+            |
| Below 100%    | Contraction risk |

### Retention by Product Bundling

- **1 product sold:** 30% retention after 2 years
- **Multiple products bundled:** Significantly higher retention (exact figures vary)
- This is the single most important retention lever for agency platforms

---

## 13. Platform-Specific Findings

### GoHighLevel (Market Leader for Agencies)

**What Clients Like:**

- Consolidation value: replaces $400-$700/month in separate tools
- Sub-account architecture with full data isolation
- SMS capabilities, especially missed-call text-back automation
- Unlimited contacts and users on higher plans
- AI Employee (Voice AI, Conversation AI, Review AI)
- Snapshot deployment for rapid setup

**What Clients Dislike:**

- Steep learning curve ("its steepest learning curve" for workflow builder)
- Email deliverability issues (Mailgun-based, shared infrastructure)
- Design polish doesn't match modern standards
- Not suitable for ecommerce (no inventory management)
- Inconsistent customer support
- Hidden/usage-based costs
- Mobile app limitations (can't access builders)

**Who Stays:** Marketing agencies with 2+ clients, freelancers, local service businesses, SaaS resellers
**Who Leaves:** Solo CRM-only users, ecommerce, email-first businesses, enterprise teams

**Pricing Tiers for White-Label:**

- $97/mo: Basic
- $297/mo: Full white-label desktop
- $497/mo: + White-label mobile app (custom branded in App Store)

### Vendasta (Enterprise White-Label)

**Client Experience:**

- "One experience, one password, one bill"
- Multi-location roll-up dashboards
- QuickBooks integration (financial + marketing data in one view)
- Unlimited users per business account
- "UI/UX is intuitive, with even non-tech-savvy small business owners finding it very easy"
- Strong transparency: clients can "log in and see everything happening"

**Strengths:** Breadth of marketplace products, multi-location support, executive reporting
**Weaknesses:** Higher price point, more enterprise-focused, complex partner setup

### SuiteDash (Client Portal Focused)

**Client Experience:**

- 100% white-label with custom URL
- ONE Dashboard showing tasks, invoices, files, forms, checklists
- Mobile app for iOS/Android
- Secure messaging within portal
- E-signature and document management

**Strengths:** Project management focus, file collaboration, invoicing
**Weaknesses:** Less marketing/CRM depth, smaller ecosystem

### vcita/inTandem (SMB-Optimized)

**Client Experience:**

- Designed specifically for non-tech-savvy SMBs
- CRM + scheduling + payments + marketing in one
- BizAI assistant with real-time recommendations
- AI automation "seamlessly blending into daily tasks"

**Strengths:** SMB-friendly simplicity, AI-first approach, scheduling excellence
**Weaknesses:** Smaller scale, less agency tooling

### Stammer.ai (AI-First White-Label)

**Client Experience:**

- Branded AI chatbot and voice agent dashboards
- Sub-Account Wallet for usage billing
- Analytics showing AI value (calls handled, money saved)
- Chat agents on website, social, CRM
- Voice agents answering phones, qualifying leads

**Strengths:** AI-native, clear value demonstration, flexible pricing
**Weaknesses:** Narrow focus (AI chatbots only, not full business platform)

---

## 14. CRM Usage Statistics

### Adoption Rates

- 91% of companies with 11+ employees use CRM
- Only 50% of companies with 10 or fewer employees adopt CRM
- 65% of companies adopt CRM within first 5 years
- 87% of businesses now use cloud-based CRM (up from 12% in 2008)
- 71% of small businesses (500 or fewer employees) use a CRM

### Feature Usage

- 43% of CRM users use LESS THAN HALF of available features
- 82% use it for sales reporting and automation
- 61% use it for lead generation
- 57% for lead nurturing
- 54% to "build stronger relationships with buyers"
- 74% improved customer data access after implementation

### Top Challenges

- 32% cite lack of technical expertise (biggest obstacle)
- 31% struggle with cost
- 30% face data migration issues
- 27% report user adoption problems
- 23% lack app integrations
- 17% cite manual data entry as primary challenge

### ROI Data

- 83% of small businesses using CRM saw positive ROI
- 61% said it improved customer retention
- 86% felt CRM helped achieve business goals
- Average ROI: $8.71 per $1 spent
- 300% increase in conversion rates for CRM users

---

## 15. Key Implications for Surgent

### The Opportunity Gap

Based on this research, the critical gaps in the current white-label end-user experience are:

**1. Complexity Is the #1 Killer**

- 43% of users use less than half of features
- 70% of CRM projects fail due to adoption issues
- SMBs don't want a "platform" -- they want outcomes (more leads, more revenue, less manual work)
- Current solutions give clients a simplified version of a complex tool rather than building simple-first

**2. The First 90 Days Are Everything**

- 43% of SMB losses happen in the first quarter
- 20% of voluntary churn traces to poor onboarding
- Time-to-value must be measured in hours, not weeks
- Pre-configured, ready-to-use setups win over customizable blank canvases

**3. AI Changes the Value Equation**

- AI features (voice answering, chat automation, review management) create the clearest ROI story
- "847 calls handled -- you'd have spent $4,000 on staff" is the retention pitch
- But cheap AI tools suffer "AI tourist" churn (23% GRR for <$50/mo tools)
- AI must be deeply integrated into workflow, not a standalone feature

**4. Bundle = Retention**

- Single product: 30% retention after 2 years
- Bundled products: dramatically higher retention
- The more business functions that run through your platform, the stickier it becomes
- Surgent's all-in-one vision (website + social + marketing + AI) is the right strategy for retention

**5. Mobile Is Table Stakes But Not Primary**

- 48% use mobile, 65% with mobile CRM hit sales quotas
- But mobile is for checking/responding, not building
- The daily mobile workflow: check leads, respond to messages, review calendar, check notifications
- Don't try to put the full platform on mobile; optimize for the 4-5 daily mobile actions

**6. The Reporting = Retention Equation**

- 40% churn reduction from structured, consistent reporting
- Clients need to SEE the value to keep paying
- Automated "here's what we did for you this week" drives retention
- Branded dashboards showing ROI are more effective than generic analytics

**7. Simplicity Over Features**

- SMBs want: scheduling, lead tracking, messaging, payments, basic reporting
- They don't want: workflow builders, funnel editors, complex automation UIs
- "Software is not the goal -- growth is"
- Build for the daily workflow (check inbox, see calendar, track leads), not for the power user

**8. Pricing Transparency Matters**

- Hidden per-message, per-email costs create resentment
- Per-seat pricing limits adoption within client organizations
- Predictable, flat pricing wins over usage-based for SMBs
- But usage-based pricing correlates with better retention (when clients understand it)

### The Surgent Differentiation Opportunity

Current white-label platforms all share the same fundamental design flaw: they're **complex platforms simplified for clients** rather than **simple platforms empowered by AI**. The end user experience is always a subset of the agency experience, which means:

- Interfaces are still complex (just with fewer tabs showing)
- Setup still requires significant configuration
- Value takes weeks to materialize
- The client is always using "someone else's tool" that's been dressed up

Surgent's opportunity is to flip this entirely:

- Start with what the SMB owner does daily (check inbox, manage calendar, track leads, see revenue)
- Let AI handle everything else (automation, follow-up, content creation, review management)
- Make the first valuable outcome happen in minutes, not days
- Make the AI invisible -- the SMB owner just sees results, not an "AI Employee" dashboard
- Bundle everything so deeply that the platform IS the business's operating system

---

## Sources

### GoHighLevel

- [GoHighLevel Sub-Accounts Guide](https://netpartners.marketing/highlevel-sub-account-guide-setup-transfer-optimization-for-agencies/)
- [GoHighLevel Review 2026](https://netpartners.marketing/gohighlevel-review-2026-full-platform-breakdown-honest-verdict/)
- [Sub-Account User Roles & Permissions](https://help.gohighlevel.com/support/solutions/articles/155000002544-user-roles-permissions-and-assigned-data-subaccount)
- [SaaS vs Sub-Account Permissions](https://help.gohighlevel.com/support/solutions/articles/48001184431-saas-user-level-permissions-vs-sub-account-level-permissions)
- [Client Portal Dashboard](https://help.gohighlevel.com/support/solutions/articles/155000001205-client-portal-dashboard)
- [How Customers Use Client Portal](https://help.gohighlevel.com/support/solutions/articles/155000000197-how-can-my-customers-use-the-client-portal-)
- [GoHighLevel White Label Mobile App](https://www.gohighlevel.com/white-label-mobile-app)
- [HighLevel vs Lead Connector Mobile Apps](https://topghlsnapshots.com/highlevel-vs-lead-connector-mobile-apps/)
- [GoHighLevel AI Employee Guide](https://getautomized.com/what-is-a-gohighlevel-ai-employee/)
- [GoHighLevel Was a Nightmare Review](https://millo.co/gohighlevel-review)
- [Template Library Visibility Control](https://help.gohighlevel.com/support/solutions/articles/155000005230-template-library-visibility-control-for-sub-accounts)
- [Hide App Marketplace from Sub-Accounts](https://ideas.gohighlevel.com/changelog/enhanced-control-for-agencies-hide-app-marketplace-from-sub-accounts)

### Vendasta

- [Vendasta Business App](https://www.vendasta.com/platform/business-app/)
- [Vendasta Client Retention Strategies](https://www.vendasta.com/blog/client-retention-strategies/)

### Other Platforms

- [SuiteDash White Label Client Portal](https://suitedash.com/features/white-label-client-customer-portal-software/)
- [vcita/inTandem White Label CRM](https://intandem.vcita.com/blog/partners/white-label-crm)
- [Stammer.ai White Label AI Agents](https://stammer.ai/)
- [Method White Label Client Portal Guide](https://www.method.me/blog/white-label-client-portal/)

### CRM & Churn Statistics

- [42 CRM Statistics 2026 - DemandSage](https://www.demandsage.com/crm-statistics/)
- [SaaS Churn Benchmarks 2026](https://www.shno.co/marketing-statistics/saas-churn-benchmarks-statistics)
- [SMB Churn Reduction Strategies](https://forecastio.ai/blog/strategies-for-reducing-smb-churn-in-saas)
- [Why CRMs Fail Small Businesses](https://www.seosamba.com/seoblog/why-most-crms-fail-small-businesses-and-what-a-modern-crm-should-actually-deliver-1772710094403.html)
- [White-Label SaaS & Client Retention](https://catalyticleadership.net/white-label-saas-client-retention-the-future-of-digital-agencies/)
- [White-Label Builders as SMB Growth Partners](https://www.basekit.com/2025/08/28/how-white-label-website-builders-help-saas-become-smb-growth-partners/)

### SMB Retention

- [SMB Retention Strategies for Agencies](https://intandem.vcita.com/blog/partners/smb-retention-strategies-for-marketing-agencies)
- [Agency Profitability with SaaS Models](https://www.marketingprofs.com/articles/2025/53908/agency-services-saas-model-profitability-client-retention)
- [White-Label Reporting for Retention](https://www.daxrm.com/how-agencies-can-increase-client-retention-with-white-label-reporting/)
