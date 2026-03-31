# Open-Source WhatsApp Integration Research (March 2026)

_Companion to WHATSAPP-API-RESEARCH.md — focused specifically on open-source implementation quality_

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Chatwoot](#2-chatwoot)
3. [Evolution API](#3-evolution-api)
4. [WAHA](#4-waha)
5. [Baileys](#5-baileys)
6. [n8n](#6-n8n)
7. [Botpress](#7-botpress)
8. [Typebot](#8-typebot)
9. [Rocket.Chat](#9-rocketchat)
10. [whatsapp-web.js](#10-whatsapp-webjs)
11. [wa-automate (open-wa)](#11-wa-automate-open-wa)
12. [Other Notable Projects](#12-other-notable-projects)
13. [Comparison Matrix](#13-comparison-matrix)
14. [Meta's January 2026 AI Chatbot Policy](#14-metas-january-2026-ai-chatbot-policy)
15. [Implications for Surgent](#15-implications-for-surgent)

---

## 1. Executive Summary

### The Landscape in March 2026

The open-source WhatsApp ecosystem splits into two fundamentally different camps:

**Camp A: Official Cloud API (Safe, Compliant, Limited)**

- Chatwoot, Rocket.Chat, n8n, Botpress, Whatomate, OpenWABA, Receevi
- Use Meta's official WhatsApp Cloud API
- Zero ban risk, full template/interactive message support
- Require Meta Business Verification, per-message costs from Meta
- Cannot access features outside the official API (e.g., reading group chats without being added as a business number)

**Camp B: Unofficial Baileys-based (Feature-rich, Risky)**

- Evolution API, WAHA, Baileys, whatsapp-web.js, wa-automate
- Reverse-engineer WhatsApp Web protocol
- Free messaging (no Meta per-message fees), more features (polls, reactions, group management)
- Significant ban risk (300%+ increase in bans in 2025-2026 per reports)
- Protocol can break at any time when Meta updates

### Top-Line Verdict

| Project             | Stars | API Type                         | Best For                                          | Production Ready?                        |
| ------------------- | ----- | -------------------------------- | ------------------------------------------------- | ---------------------------------------- |
| **Chatwoot**        | 28k   | Official Cloud API               | Customer support inbox with WhatsApp as a channel | YES - most mature                        |
| **Evolution API**   | 7.7k  | Both (Baileys + Cloud API)       | Developers who want maximum flexibility           | RISKY for production                     |
| **WAHA**            | 6.3k  | Unofficial (3 engines)           | Self-hosted WhatsApp automation                   | RISKY for production                     |
| **Baileys**         | 8.8k  | Unofficial (WebSocket)           | Building custom WhatsApp clients                  | Library only, not production-ready alone |
| **n8n**             | 52k+  | Official Cloud API               | Workflow automation with WhatsApp triggers        | YES                                      |
| **Botpress**        | 14k+  | Official Cloud API               | AI chatbot deployment on WhatsApp                 | YES (Cloud only; v12 OSS is sunset)      |
| **Typebot**         | 7k+   | Via Evolution API (unofficial)   | Visual chatbot builder on WhatsApp                | RISKY (depends on Evolution API)         |
| **Rocket.Chat**     | 42k+  | Official Cloud API (+ 360Dialog) | Team messaging with WhatsApp omnichannel          | YES but basic                            |
| **whatsapp-web.js** | 21.5k | Unofficial (Puppeteer)           | Browser-based WhatsApp automation                 | RISKY, high resource usage               |
| **wa-automate**     | ~4k   | Unofficial (browser)             | WhatsApp Web automation scripting                 | DECLINING, partially paywalled           |
| **Whatomate**       | 954   | Official Cloud API               | Full WhatsApp Business Platform (Go)              | PROMISING but young                      |
| **OpenWABA**        | ~50   | Official Cloud API               | White-label WhatsApp for agencies                 | VERY EARLY                               |

---

## 2. Chatwoot

**GitHub:** github.com/chatwoot/chatwoot | **Stars:** ~28,000 | **License:** MIT
**API Type:** Official WhatsApp Cloud API (also supports Twilio and 360Dialog as BSPs)

### Architecture

Chatwoot uses a polymorphic channel model where `Channel::Whatsapp` connects to `Inbox` entities. The `channel_whatsapp` table stores configuration including phone numbers, provider types, credentials in `provider_config` (JSONB), and cached message templates. The system supports three BSPs:

- **WhatsApp Cloud (Meta Direct)** — Direct API integration requiring phone_number_id, WABA ID, access tokens
- **Twilio** — Third-party BSP
- **360Dialog** — Alternative BSP

### Feature Assessment

| Feature                        | Status             | Details                                                                                                                                                                                                 |
| ------------------------------ | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Template Messages**          | GOOD               | Templates cached in `message_templates` JSONB column. `TemplatesSyncJob` periodically fetches approved templates. Manual sync via API. Template params validation.                                      |
| **Interactive Messages**       | PARTIAL            | `input_select` (list picker) works. URL buttons with dynamic links, copy codes, quick replies work. `form`, `cards`, `article` content types do NOT work on WhatsApp. Carousel templates NOT supported. |
| **Media Messages**             | GOOD               | Images, files, videos, links, location supported. Some reported issues with media uploads failing when sent back to Cloud API.                                                                          |
| **Broadcast/Bulk**             | YES (since v4.4.0) | WhatsApp campaigns feature lets you send pre-approved templates to contact lists. Rolling out gradually to new accounts.                                                                                |
| **WhatsApp Flows**             | NO                 | Not supported. Flow-based templates silently fail. Workaround: separate application with separate webhooks.                                                                                             |
| **Webhook Handling**           | GOOD               | Routes at `GET/POST /webhooks/whatsapp/:phone_number`. Challenge-response verification. Delivery/read/failed status tracking.                                                                           |
| **WhatsApp Embedded Signup**   | YES                | OAuth-based setup without manual webhook configuration.                                                                                                                                                 |
| **CSAT Integration**           | YES                | Captain-powered CSAT template analyzer predicts if Meta might reclassify Utility templates as Marketing.                                                                                                |
| **Health Monitoring**          | YES                | `GET /api/v1/accounts/:id/inboxes/:id/health` returns account status and quality ratings.                                                                                                               |
| **24-Hour Window Enforcement** | YES                | Only template messages allowed outside window.                                                                                                                                                          |

### Key Limitations

1. **No WhatsApp Flows** — significant gap for lead capture, appointment booking, surveys
2. **Interactive message types incomplete** — no carousel, no catalog templates, no list picker templates
3. **Hardcoded English** in WhatsApp interactive list "Choose an item" button label
4. **Media upload bugs** — files appear in Chatwoot UI but can fail when sent to Cloud API
5. **No WhatsApp Calling API** support (filed as issue #12678)

### Verdict

**Best-in-class open-source WhatsApp inbox** for customer support. The most mature, most complete official Cloud API implementation. But it is fundamentally a **support/helpdesk tool**, not a marketing automation platform. Broadcast campaigns are new and basic. No WhatsApp Flows is a significant omission for lead generation use cases.

---

## 3. Evolution API

**GitHub:** github.com/EvolutionAPI/evolution-api | **Stars:** 7,700 | **License:** Apache 2.0
**API Type:** BOTH — Baileys (unofficial) AND WhatsApp Cloud API (official)
**Latest Version:** v2.3.7 (Dec 2025) | **Language:** TypeScript (98.7%)

### Architecture

Node.js server that maintains active WhatsApp Web sessions via Baileys or connects to official Cloud API. Exposes REST API with API key authentication. Manages multiple instances (phone numbers) from a single installation. Uses Prisma ORM for database.

### Feature Assessment

| Feature                  | Status               | Details                                                                                |
| ------------------------ | -------------------- | -------------------------------------------------------------------------------------- |
| **Text Messages**        | YES                  | Full text messaging support                                                            |
| **Media Messages**       | YES                  | Images, documents, audio, video, stickers, locations, contacts                         |
| **Interactive Messages** | YES (Baileys mode)   | Buttons, lists, polls via Baileys. Limited in Cloud API mode to official capabilities. |
| **Template Messages**    | YES (Cloud API mode) | Full template support when using official Cloud API connection                         |
| **Polls**                | YES                  | Send polls and receive poll votes (Baileys mode)                                       |
| **Reactions**            | YES                  | Emoji reactions on messages                                                            |
| **Group Management**     | YES                  | Create groups, manage members, find groups by JID                                      |
| **Broadcast/Bulk**       | YES (Baileys mode)   | Can send to multiple recipients. Significant ban risk.                                 |
| **WhatsApp Flows**       | NO                   | Not documented                                                                         |
| **Labels**               | UNCLEAR              | Not prominently documented                                                             |
| **Webhook Handling**     | YES                  | Webhooks, RabbitMQ, Kafka, Amazon SQS, Socket.io                                       |

### Integration Ecosystem

- **Typebot** — Visual chatbot flows
- **Chatwoot** — Customer service inbox
- **Dify** — AI workflows
- **OpenAI** — Audio-to-text conversion
- **n8n** — Workflow automation
- **Amazon S3 / Minio** — Media storage
- **RabbitMQ / Kafka / SQS** — Event streaming

### Production Reliability Issues

**Documented problems from GitHub issues and community reports:**

1. **Account bans after 1-2 days** — Issue #2298: WhatsApp accounts get temporarily restricted after normal usage with v2.3.7 (QR Code blocked for 24h)
2. **Number checking causes bans** — Issue #2228: The `/chat/whatsappNumbers/` endpoint lacks rate limiting; bulk checking triggers WhatsApp's detection systems
3. **Connection failures** — `device_offline`, `session_not_found`, `connection_closed`, `browser_connection_failed` errors
4. **Memory leaks** — Requires minimum 4GB RAM; 1-2GB systems fail consistently
5. **Estimated true cost:** $40-90/month when factoring VPS ($15-35) + admin time (10-25 hours/month) + update maintenance

### Ban Risk Assessment

- WhatsApp bans have increased **300%+** for unofficial API users in 2025-2026
- Meta actively detects and blocks automated/bot-like behavior
- Protocol changes every 3-6 months can cause days/weeks of downtime
- **Not suitable for production customer-facing use where continuity is critical**

### Verdict

**Most feature-rich open-source WhatsApp integration** thanks to dual Cloud API + Baileys support. The integration ecosystem (Typebot, Chatwoot, Dify, n8n) is unmatched. However, Baileys mode carries substantial ban risk, and production stability requires significant devops investment. Best for: prototyping, internal tools, or as a Cloud API gateway (use only the official API path for production).

---

## 4. WAHA (WhatsApp HTTP API)

**GitHub:** github.com/devlikeapro/waha | **Stars:** 6,300 | **License:** Apache 2.0
**API Type:** Unofficial (all three engines reverse-engineer WhatsApp Web protocol)

### Engine Comparison

| Engine    | Approach                                       | RAM Usage                  | Reliability                                        | Features                        |
| --------- | ---------------------------------------------- | -------------------------- | -------------------------------------------------- | ------------------------------- |
| **WEBJS** | Puppeteer/Chromium browser automation          | HIGH (~500MB+ per session) | Most reliable — mimics human browser usage         | Most complete feature set       |
| **NOWEB** | Direct WebSocket to WhatsApp servers (Node.js) | LOW                        | Medium — WhatsApp detects this pattern more easily | Good feature set                |
| **GOWS**  | Direct WebSocket to WhatsApp servers (Go)      | LOWEST                     | Similar to NOWEB                                   | Newest, fastest, still maturing |
| **WPP**   | WPPConnect-based (added 2026.3)                | Medium                     | Similar to WEBJS                                   | Newer engine option             |

### Feature Assessment

| Feature                            | Status     | Details                                                         |
| ---------------------------------- | ---------- | --------------------------------------------------------------- |
| **Text Messages**                  | YES        | Full support across all engines                                 |
| **Media Messages**                 | YES        | Images, videos, voice messages                                  |
| **Polls**                          | YES        | Send polls, receive votes (GOWS engine)                         |
| **Reactions**                      | YES        | Emoji reactions                                                 |
| **Presence/Status**                | YES        | Online/offline/typing indicators (WEBJS engine)                 |
| **Groups**                         | YES        | Comprehensive group management                                  |
| **Channels (Newsletters)**         | YES        | WhatsApp Channel automation                                     |
| **Labels**                         | YES (GOWS) | WhatsApp Business labels                                        |
| **Status/Stories**                 | YES        | User and channel stories                                        |
| **Calls**                          | YES        | Phone call integration                                          |
| **Contacts**                       | YES        | LID-to-phone conversion across all engines                      |
| **Template Messages**              | NO         | Unofficial API — templates are an official API concept          |
| **WhatsApp Flows**                 | NO         | Official API only                                               |
| **Interactive Buttons (official)** | NO         | But can send native WhatsApp buttons via Baileys-style protocol |

### Pricing

| Tier          | Price      | Features                                                                                                        |
| ------------- | ---------- | --------------------------------------------------------------------------------------------------------------- |
| **WAHA Core** | FREE       | Single session, basic messaging                                                                                 |
| **WAHA Plus** | ~$19/month | Multi-session (unlimited accounts), Dashboard UI, S3/MinIO storage, proxy support, HMAC-SHA512 webhook security |

### Production Reliability

- Protocol updates break connectivity every 3-6 months
- WEBJS engine is most reliable but uses most resources
- NOWEB/GOWS are lighter but more easily detected by WhatsApp
- Same ban risks as all unofficial APIs
- Better documented than Evolution API; more focused project with clearer engine selection guidance

### Verdict

**Best-documented unofficial WhatsApp API** with the cleanest REST interface. The multi-engine approach is unique — you can choose your reliability/resource tradeoff. Swagger/OpenAPI documentation is excellent. But fundamentally carries the same ban risks as all unofficial solutions. Best for: developers who want a clean HTTP API over WhatsApp Web, small-scale internal automation, or experimenting with WhatsApp features not available via Cloud API.

---

## 5. Baileys

**GitHub:** github.com/WhiskeySockets/Baileys | **Stars:** 8,800 | **License:** MIT
**API Type:** Unofficial (WebSocket reverse-engineering of WhatsApp Web protocol)
**Latest Version:** 7.0.0-rc.9 (Nov 2025) | **Language:** TypeScript

### What It Is

Baileys is the **underlying library** that powers Evolution API, WAHA's NOWEB engine, and many other WhatsApp tools. It communicates directly with WhatsApp's WebSocket servers — no browser, no Selenium, no Chromium (~500MB RAM savings vs browser-based approaches).

### Feature Assessment

| Feature                  | Status  | Details                                                             |
| ------------------------ | ------- | ------------------------------------------------------------------- |
| **Text Messages**        | YES     | Full send/receive                                                   |
| **Media Messages**       | YES     | Images, videos, audio, documents, stickers                          |
| **Interactive Messages** | YES     | Native flow buttons, carousels, lists, polls, shop messages         |
| **Polls**                | YES     | Send polls, receive votes                                           |
| **Reactions**            | YES     | Emoji reactions                                                     |
| **Group Management**     | YES     | Create groups, manage participants, update settings, handle invites |
| **Privacy Controls**     | YES     | Blocking, online status, read receipts, disappearing messages       |
| **Multi-Device**         | YES     | QR code or pairing code authentication                              |
| **Labels**               | PARTIAL | Some support through WhatsApp Web protocol                          |
| **Channels**             | YES     | Newsletter/Channel access                                           |
| **Template Messages**    | NO      | Not applicable — unofficial API                                     |
| **WhatsApp Flows**       | NO      | Official API only                                                   |
| **Broadcast**            | YES     | Can message multiple recipients (high ban risk)                     |

### Key Considerations

- **v7.0.0 breaking changes** — Multiple breaking changes require migration; community still adapting
- **Maintainer monetization** — Enterprise support available through paid consulting
- **Used by ~4,200 projects** — Very widely adopted as foundation library
- **Explicitly discourages bulk/automated messaging** — README warns against this
- **247 open issues** — Active development but significant backlog

### Verdict

**The foundation library** for the unofficial WhatsApp ecosystem. Everything unofficial builds on top of Baileys (or its competitors like whatsapp-web.js). Extremely capable but raw — you need to build everything on top (session management, REST API, persistence, scaling). Not a standalone solution; it's a building block.

---

## 6. n8n

**GitHub:** github.com/n8n-io/n8n | **Stars:** 52,000+ | **License:** Sustainable Use License (source-available, not pure OSS)
**API Type:** Official WhatsApp Cloud API

### WhatsApp Node Capabilities

n8n has a built-in **WhatsApp Business Cloud** node with 1 trigger + 6 actions:

| Operation               | Details                                                               |
| ----------------------- | --------------------------------------------------------------------- |
| **Trigger: On Message** | Receives incoming WhatsApp messages via webhook                       |
| **Send Text**           | Send text messages with formatting                                    |
| **Send Template**       | Send pre-approved WhatsApp templates with dynamic parameters          |
| **Send Media**          | Send images with captions (mediaUrl + caption)                        |
| **Send Location**       | Share location coordinates                                            |
| **Send Quick Reply**    | Interactive buttons (up to 3)                                         |
| **Send List**           | Interactive list messages for selections                              |
| **Send and Wait**       | Pause workflow until user responds (Approval, Free Text, Custom Form) |
| **Upload Media**        | Upload media files to WhatsApp servers                                |
| **Download Media**      | Download received media                                               |
| **Delete Media**        | Remove uploaded media                                                 |

### What n8n Does Well

- **Workflow orchestration** — Connect WhatsApp to 700+ other apps
- **AI integration** — Route incoming messages through AI models (GPT, Claude, etc.)
- **Custom HTTP requests** — Can call any WhatsApp Cloud API endpoint not covered by the native node
- **Self-hostable** — Run on your own infrastructure
- **Send and Wait** — Unique feature that pauses workflows for human input

### What n8n Does NOT Do

- No built-in WhatsApp inbox/UI
- No contact management
- No broadcast/campaign management (must build as workflows)
- No WhatsApp Flows
- Template issues reported with media (videos/images in templates can be buggy)
- Interactive button reply handling requires workarounds

### Verdict

**Best workflow automation tool with WhatsApp support.** Not a WhatsApp platform — it's an automation engine that happens to have solid WhatsApp Cloud API integration. Perfect for connecting WhatsApp to CRMs, AI models, databases, and other business tools. Complements (not replaces) a dedicated WhatsApp inbox like Chatwoot.

---

## 7. Botpress

**GitHub:** github.com/botpress/botpress | **Stars:** 14,000+ | **License:** AGPLv3 / Proprietary dual license
**API Type:** Official WhatsApp Cloud API

### Critical Update: OSS vs Cloud

- **Botpress v12 (self-hosted OSS)** — **SUNSET.** No longer available for download or new deployments. Existing customers supported, but no new licenses.
- **Botpress Cloud** — The only actively developed version. NOT open source. Proprietary SaaS.

This means **Botpress is effectively no longer an open-source WhatsApp solution** for new projects.

### WhatsApp Integration (Cloud Version)

| Feature                 | Status    | Details                                                                         |
| ----------------------- | --------- | ------------------------------------------------------------------------------- |
| **Text Messages**       | YES       | Full support                                                                    |
| **Media Messages**      | YES       | Images, PDFs, documents, videos, voice notes                                    |
| **Template Messages**   | YES       | Required for proactive/outbound messages                                        |
| **Interactive Buttons** | YES       | Via Cloud API                                                                   |
| **AI Chatbot**          | EXCELLENT | Autonomous Node for dynamic conversation paths. Supports GPT-4, Claude, Gemini. |
| **Multi-LLM**           | YES       | Not locked to single provider                                                   |
| **Broadcast**           | NO        | Not a marketing tool                                                            |
| **WhatsApp Flows**      | NO        | Not documented                                                                  |

### Verdict

**Excellent AI chatbot platform with WhatsApp** — but no longer open source. The self-hosted v12 is dead. Botpress Cloud is a proprietary SaaS that competes with Tidio, Intercom, etc. Not relevant for Surgent's "build our own" approach unless we want to use it as a SaaS dependency.

---

## 8. Typebot

**GitHub:** github.com/baptisteArno/typebot.io | **Stars:** ~7,000 | **License:** AGPLv3
**API Type:** Unofficial (connects to WhatsApp via Evolution API)

### How It Works

Typebot is a visual conversation flow builder. It connects to WhatsApp **through Evolution API** — Typebot sends flow definitions to Evolution API, which handles the WhatsApp connection via Baileys. The integration is configured by pointing Evolution API webhooks to Typebot endpoints.

### Feature Assessment

| Feature                 | Status    | Details                                            |
| ----------------------- | --------- | -------------------------------------------------- |
| **Visual Flow Builder** | EXCELLENT | Drag-and-drop conversational flows                 |
| **Dynamic Variables**   | YES       | Personalization via variables passed to flows      |
| **Lead Qualification**  | YES       | Built-in flow logic for lead capture               |
| **Surveys**             | YES       | Interactive survey flows                           |
| **Media in Flows**      | YES       | Images, buttons within conversation flows          |
| **AI Integration**      | YES       | Can connect to OpenAI/Claude within flows          |
| **Template Messages**   | NO        | Evolution API (Baileys mode) doesn't use templates |
| **WhatsApp Flows**      | NO        | Uses its own flow system, not WhatsApp Flows       |
| **Broadcast**           | NO        | Not a broadcast tool                               |

### Key Dependency Risk

Typebot's WhatsApp integration is **entirely dependent on Evolution API**. If Evolution API goes down, breaks, or your WhatsApp number gets banned, Typebot's WhatsApp integration stops working. This is a significant architectural risk for production use.

### Verdict

**Best visual chatbot builder for WhatsApp** if you accept the Evolution API dependency and ban risk. Excellent for prototyping conversational flows. Not recommended for production customer-facing deployments due to the unofficial API chain. The flow builder itself is genuinely impressive — if it could connect to the official Cloud API directly, it would be a top-tier solution.

---

## 9. Rocket.Chat

**GitHub:** github.com/RocketChat/Rocket.Chat | **Stars:** 42,000+ | **License:** MIT (with enterprise features)
**API Type:** Official Cloud API (direct + 360Dialog)

### WhatsApp Integration Options

1. **WhatsApp Cloud App** — Direct connection to Meta's Cloud API (free, no third-party dependency)
2. **360Dialog Integration** — BSP-based, $39/month subscription
3. **WhatsApp Sandbox** — For testing

### Feature Assessment

| Feature                     | Status | Details                                        |
| --------------------------- | ------ | ---------------------------------------------- |
| **Text Messages**           | YES    | Send/receive                                   |
| **Media Messages**          | YES    | Images, files, location, videos, links         |
| **Template Messages**       | YES    | Via API endpoint only (not from UI natively)   |
| **Interactive Messages**    | BASIC  | Not prominently documented                     |
| **Broadcast**               | NO     | Not designed for marketing                     |
| **WhatsApp Flows**          | NO     | Not supported                                  |
| **Message Status Tracking** | YES    | Queued, failed, sent, delivered, read statuses |
| **Omnichannel Routing**     | YES    | Queue-based or direct agent assignment         |
| **End-to-End Encryption**   | YES    | Enterprise-grade security                      |

### Key Limitations

- Template messages only via API (not UI) — poor UX for non-technical agents
- WhatsApp is a secondary channel — Rocket.Chat is fundamentally a team messaging platform
- Less WhatsApp-specific development compared to Chatwoot
- 360Dialog integration adds cost ($39/month)

### Verdict

**Good for organizations already using Rocket.Chat** as their team communication tool. WhatsApp integration is functional but basic — it's clearly a bolt-on, not a first-class focus. Chatwoot's WhatsApp implementation is significantly more complete.

---

## 10. whatsapp-web.js

**GitHub:** github.com/pedroslopez/whatsapp-web.js (now under wwebjs org) | **Stars:** 21,500 | **License:** Apache 2.0
**API Type:** Unofficial (Puppeteer browser automation)
**Latest Version:** v1.34.6 (Jan 2026)

### How It Differs from Baileys

| Factor             | whatsapp-web.js                      | Baileys                              |
| ------------------ | ------------------------------------ | ------------------------------------ |
| **Approach**       | Puppeteer (headless Chromium)        | Direct WebSocket                     |
| **RAM Usage**      | HIGH (~500MB+ per session)           | LOW (~50-100MB per session)          |
| **Reliability**    | Higher — mimics real browser         | Lower — more easily detected         |
| **Speed**          | Slower                               | Faster                               |
| **Features**       | More features historically           | Catching up, more actively developed |
| **Detection Risk** | Lower — looks like real WhatsApp Web | Higher — unusual connection pattern  |

### Feature Assessment

| Feature               | Status      | Details                                                               |
| --------------------- | ----------- | --------------------------------------------------------------------- |
| **Text Messages**     | YES         | Full support                                                          |
| **Media Messages**    | YES         | Images, audio, documents, video (Chrome required for video), stickers |
| **Reactions**         | YES         | Emoji reactions                                                       |
| **Polls**             | YES         | Create and vote                                                       |
| **Buttons**           | DEPRECATED  | Was supported, now deprecated by WhatsApp                             |
| **Lists**             | DEPRECATED  | Same as buttons                                                       |
| **Group Management**  | YES         | Join, invite, modify info/settings, add/remove/promote/demote members |
| **Channels**          | YES         | Newsletter/Channel support                                            |
| **Mentions**          | YES         | User and group mentions                                               |
| **Location/Contacts** | YES         | Send location and contact cards                                       |
| **Communities**       | COMING SOON | In development                                                        |
| **Multi-Device**      | YES         | Supported                                                             |

### Key Issues

- Deprecated dependencies (rimraf, glob, fluent-ffmpeg) cause warnings on Node 22+
- High memory footprint (one Chromium instance per session)
- Puppeteer dependency adds complexity to Docker deployments
- Not as actively developed as Baileys for new features

### Verdict

**The most popular unofficial WhatsApp library by star count** (21.5k vs Baileys' 8.8k). Higher RAM usage but potentially lower ban risk due to browser-based approach. Still actively maintained but the Baileys ecosystem (Evolution API, WAHA) has surpassed it in terms of tooling and integrations built on top. Best for: developers who prioritize stability over resource efficiency and want to automate a personal WhatsApp account.

---

## 11. wa-automate (open-wa)

**GitHub:** github.com/open-wa/wa-automate-nodejs | **Stars:** ~4,000 | **License:** Partially proprietary
**API Type:** Unofficial (browser automation)

### Current Status

- Available in Node.js and Python versions
- **Partially paywalled** — Sending texts to unknown numbers requires a license key ($5/month or $50/year per number)
- In transitionary period for Multi-Device support
- Less actively developed compared to whatsapp-web.js and Baileys

### Verdict

**Declining project.** The paywall for basic features (messaging unknown numbers) and slower development pace make it less attractive than whatsapp-web.js or Baileys. Not recommended for new projects.

---

## 12. Other Notable Projects

### Whatomate

**GitHub:** github.com/shridarpatil/whatomate | **Stars:** 954 | **License:** Open source
**API Type:** Official WhatsApp Cloud API
**Stack:** Go (Fastglue) + Vue.js 3 + PostgreSQL

**This is the most interesting newcomer.** A single-binary, self-hosted WhatsApp Business Platform with:

- WhatsApp Cloud API integration
- Real-time chat with WebSocket
- Template management with Meta approval workflow
- Bulk campaigns with retry support
- Chatbot automation (keyword-based + AI-powered via OpenAI, Anthropic, Google)
- Voice Calling & IVR with DTMF routing, team transfers, hold music, call recording
- Canned responses with slash commands and dynamic placeholders
- Multi-tenant architecture
- Granular roles & permissions
- Analytics dashboard
- Single binary deployment — zero external dependencies

**Why it matters:** Whatomate is the closest thing to a self-hosted WATI/Respond.io alternative built on the official Cloud API. If it matures, it could be the best open-source WhatsApp Business Platform available.

### OpenWABA

**GitHub:** github.com/OpenWABA-Project/OpenWABA | **Stars:** ~50
**API Type:** Official WhatsApp Cloud API

White-label WhatsApp Business API platform for agencies. Features:

- Multi-tenancy (agency > company > users)
- Template builder
- Webhook integrations
- Custom branding at agency and company levels
- Docker Compose deployment

**Very early stage** — interesting concept but likely too immature for production.

### whatsapp-cloud-inbox (by Kapso)

**GitHub:** github.com/gokapso/whatsapp-cloud-inbox | **Stars:** 623
**API Type:** Official WhatsApp Cloud API
**Stack:** Next.js + TypeScript

Clean WhatsApp Web-style inbox for Cloud API with:

- Template messages with dynamic parameters
- Interactive buttons (1-3 per message)
- Media support (images, videos, audio, documents)
- 24-hour window enforcement
- Read receipts and timestamps
- One-click Vercel deployment

**Note:** Integrates with Kapso's hosted service rather than direct Meta API. Good reference implementation but has vendor dependency.

### Receevi

**GitHub:** github.com/receevi/receevi | **Stars:** 230
**API Type:** Official WhatsApp Cloud API
**Stack:** Next.js + Supabase

**IN PROGRESS** — Only basic text messaging works. No media, templates, interactive messages, or broadcast yet. Too early.

---

## 13. Comparison Matrix

### Feature Comparison: All Projects

| Feature                  | Chatwoot      | Evolution API                 | WAHA          | Baileys     | n8n       | Botpress      | Typebot      | Rocket.Chat    | whatsapp-web.js | Whatomate |
| ------------------------ | ------------- | ----------------------------- | ------------- | ----------- | --------- | ------------- | ------------ | -------------- | --------------- | --------- |
| **API Type**             | Official      | Both                          | Unofficial    | Unofficial  | Official  | Official      | Unofficial\* | Official       | Unofficial      | Official  |
| **Template Messages**    | YES           | YES (Cloud mode)              | NO            | NO          | YES       | YES           | NO           | YES (API only) | NO              | YES       |
| **Interactive Messages** | PARTIAL       | YES                           | PARTIAL       | YES         | YES       | YES           | PARTIAL      | BASIC          | DEPRECATED      | UNCLEAR   |
| **Media Messages**       | YES           | YES                           | YES           | YES         | YES       | YES           | YES          | YES            | YES             | YES       |
| **Broadcast/Bulk**       | YES (v4.4+)   | YES (risky)                   | YES (risky)   | YES (risky) | BUILD IT  | NO            | NO           | NO             | YES (risky)     | YES       |
| **WhatsApp Flows**       | NO            | NO                            | NO            | NO          | NO        | NO            | NO           | NO             | NO              | NO        |
| **Polls**                | NO            | YES                           | YES           | YES         | NO        | NO            | NO           | NO             | YES             | NO        |
| **Reactions**            | NO            | YES                           | YES           | YES         | NO        | NO            | NO           | NO             | YES             | NO        |
| **Groups**               | NO            | YES                           | YES           | YES         | NO        | NO            | NO           | NO             | YES             | NO        |
| **Labels**               | NO            | UNCLEAR                       | YES (GOWS)    | PARTIAL     | NO        | NO            | NO           | NO             | NO              | NO        |
| **Channels/Newsletters** | NO            | NO                            | YES           | YES         | NO        | NO            | NO           | NO             | YES             | NO        |
| **Webhook Handling**     | GOOD          | EXCELLENT                     | GOOD          | N/A (lib)   | EXCELLENT | GOOD          | VIA EVAPI    | GOOD           | N/A (lib)       | GOOD      |
| **AI Integration**       | YES (Captain) | YES (OpenAI)                  | NO (external) | NO          | EXCELLENT | EXCELLENT     | YES          | NO             | NO              | YES       |
| **Team Inbox**           | YES           | NO                            | NO            | NO          | NO        | NO            | NO           | YES            | NO              | YES       |
| **Ban Risk**             | NONE          | HIGH (Baileys) / NONE (Cloud) | HIGH          | HIGH        | NONE      | NONE          | HIGH         | NONE           | HIGH            | NONE      |
| **Self-Hosted**          | YES           | YES                           | YES           | YES (lib)   | YES       | NO (v12 dead) | YES          | YES            | YES (lib)       | YES       |
| **Production Ready**     | YES           | RISKY                         | RISKY         | NO (lib)    | YES       | YES (SaaS)    | RISKY        | YES            | RISKY           | YOUNG     |

_Typebot is unofficial because it uses Evolution API's Baileys mode for WhatsApp connectivity_

### Production Reliability Ranking (for customer-facing deployments)

1. **Chatwoot** — Most battle-tested, official API, 28k stars, active development
2. **n8n** — Solid Cloud API integration, excellent for automation workflows
3. **Rocket.Chat** — Reliable but basic WhatsApp support
4. **Whatomate** — Official API, promising architecture, but young (954 stars)
5. **Evolution API (Cloud API mode only)** — If restricted to official API path
6. **Botpress Cloud** — Reliable but proprietary SaaS (no longer OSS)
7. **Everything else** — Unofficial API = not production-reliable for customer-facing

### "What Can Unofficial API Do That Official Can't?"

| Capability                               | Official Cloud API            | Unofficial (Baileys/etc.)     |
| ---------------------------------------- | ----------------------------- | ----------------------------- |
| **Free messaging** (no per-message cost) | NO — Meta charges per message | YES — no costs beyond hosting |
| **Polls**                                | NO                            | YES                           |
| **Reactions (sending)**                  | NO                            | YES                           |
| **Group management**                     | NO                            | YES                           |
| **Channels/Newsletters**                 | NO                            | YES                           |
| **Presence/typing indicators**           | NO                            | YES                           |
| **Read any message in group**            | NO                            | YES                           |
| **Labels**                               | LIMITED                       | YES                           |
| **Status/Stories**                       | NO                            | YES                           |
| **Contact online status**                | NO                            | YES                           |
| **No Meta Business Verification**        | Required                      | Not needed                    |
| **No template approval process**         | Required for outbound         | Not needed                    |
| **Use personal WhatsApp number**         | NO — must be Business number  | YES                           |

---

## 14. Meta's January 2026 AI Chatbot Policy

### What Changed

Effective **January 15, 2026**, Meta banned "general-purpose AI chatbots" (like ChatGPT, Perplexity) from operating on WhatsApp via the Business API.

### What's BANNED

- Open-ended AI assistants that answer any question
- ChatGPT-style conversational AI distributed via WhatsApp
- AI providers using WhatsApp as their distribution channel

### What's STILL ALLOWED

- Customer service and FAQ chatbots
- Order tracking and delivery updates
- Booking and reservation bots
- Lead qualification bots
- Authentication prompts
- Any AI that is **ancillary to a legitimate business service**

### Key Distinction

> "Your chatbot's AI must be ancillary to a legitimate business service, not the centerpiece of the interaction."

This means Surgent's AI Sales Agent on WhatsApp is **still allowed** — it serves a specific business function (selling the business's services/products), not general-purpose AI assistance.

### Regulatory Pushback

- **EU Commission** (Feb 2026): Issued Statement of Objections to Meta, saying the policy may breach EU competition rules
- **Brazil** (Jan 2026): Ordered Meta to suspend the policy
- This policy may be reversed or modified under regulatory pressure

---

## 15. Implications for Surgent

### Recommended Architecture

Based on this research, the recommended WhatsApp integration for Surgent is:

**Primary: Official Cloud API (direct integration)**

- Build on Meta's Cloud API for all production, customer-facing WhatsApp features
- Zero ban risk, full template/interactive message support
- Per-message costs passed through to Surgent customers (or absorbed into pricing)

**Reference Implementation: Chatwoot's WhatsApp module**

- Study Chatwoot's polymorphic channel model, template sync, webhook handling
- Their `Channel::Whatsapp` architecture is the gold standard for official API integration
- Don't copy their limitations (no WhatsApp Flows, incomplete interactive messages)

**Feature Inspiration: Whatomate**

- Single-binary Go architecture is aligned with Surgent's philosophy
- Template management + bulk campaigns + AI chatbot + multi-tenant is the right feature set
- Their approach to WhatsApp Cloud API integration is clean and modern

**Workflow Automation: n8n patterns**

- n8n's "Send and Wait" pattern is excellent for human-in-the-loop workflows
- Their WhatsApp trigger > AI processing > response pattern is exactly what Surgent needs

### What Surgent Should Build That Nobody Has

1. **WhatsApp Flows** — Zero open-source projects support WhatsApp Flows. This is a massive opportunity for lead capture, appointment booking, surveys.
2. **AI Sales Agent on WhatsApp** — Not a general-purpose chatbot (banned), but a business-specific AI agent that qualifies leads, books appointments, handles FAQs, and drives sales. This is explicitly allowed under Meta's new policy.
3. **Unified AI across website + WhatsApp** — No open-source project connects a website chatbot with WhatsApp continuity. Surgent's AI agent should recognize the same customer across both channels.
4. **WhatsApp-first onboarding** — For markets where WhatsApp is dominant (LATAM, India, SEA, Africa), the business setup flow should happen inside WhatsApp, not just on a website.

### Feature Priority for Surgent WhatsApp

| Priority | Feature                                                                  | Rationale                                    |
| -------- | ------------------------------------------------------------------------ | -------------------------------------------- |
| **P0**   | Cloud API integration, template management, service messages, AI chatbot | Core functionality, zero ban risk            |
| **P0**   | Webhook handling, 24-hour window enforcement                             | Required for compliance                      |
| **P1**   | WhatsApp Flows (lead capture, appointment booking)                       | Nobody else has this — competitive advantage |
| **P1**   | Broadcast campaigns with template messages                               | Essential for marketing automation           |
| **P2**   | Interactive messages (buttons, lists, product messages)                  | Rich customer experience                     |
| **P2**   | Multi-agent inbox                                                        | For businesses with support teams            |
| **P3**   | WhatsApp Calling API                                                     | High-impact but complex (July 2025 launch)   |
| **P3**   | Catalog integration, WhatsApp Payments                                   | E-commerce features                          |

---

## Sources

### Project Repositories

- [Chatwoot](https://github.com/chatwoot/chatwoot) — 28k stars
- [Evolution API](https://github.com/EvolutionAPI/evolution-api) — 7.7k stars
- [WAHA](https://github.com/devlikeapro/waha) — 6.3k stars
- [Baileys](https://github.com/WhiskeySockets/Baileys) — 8.8k stars
- [n8n](https://github.com/n8n-io/n8n) — 52k+ stars
- [Botpress](https://github.com/botpress/botpress) — 14k+ stars
- [Botpress v12 (sunset)](https://github.com/botpress/v12)
- [Typebot](https://github.com/baptisteArno/typebot.io) — 7k+ stars
- [Rocket.Chat](https://github.com/RocketChat/Rocket.Chat) — 42k+ stars
- [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js) — 21.5k stars
- [wa-automate](https://github.com/open-wa/wa-automate-nodejs) — ~4k stars
- [Whatomate](https://github.com/shridarpatil/whatomate) — 954 stars
- [OpenWABA](https://github.com/OpenWABA-Project/OpenWABA) — ~50 stars
- [whatsapp-cloud-inbox](https://github.com/gokapso/whatsapp-cloud-inbox) — 623 stars
- [Receevi](https://github.com/receevi/receevi) — 230 stars

### Documentation & Analysis

- [Chatwoot WhatsApp Channel Architecture (DeepWiki)](https://deepwiki.com/chatwoot/chatwoot/7.4-whatsapp-channel)
- [Evolution API Documentation](https://doc.evolution-api.com/v2/en/get-started/introduction)
- [WAHA Documentation](https://waha.devlike.pro/)
- [WAHA Features — How-to Guides](https://waha.devlike.pro/docs/how-to/)
- [Baileys Documentation](https://baileys.wiki/docs/intro/)
- [n8n WhatsApp Business Cloud Node](https://docs.n8n.io/integrations/builtin/app-nodes/n8n-nodes-base.whatsapp/)
- [Botpress WhatsApp Setup](https://www.botpress.com/docs/integrations/integration-guides/whatsapp/introduction)
- [Rocket.Chat WhatsApp Cloud App](https://docs.rocket.chat/docs/whatsapp-cloud-app)
- [Chatwoot Supported Features on Channels](https://developers.chatwoot.com/self-hosted/supported-features)

### Risk & Policy

- [Evolution API Ban Risk Issues (GitHub #2228, #2298)](https://github.com/EvolutionAPI/evolution-api/issues/2228)
- [Evolution API Production Problems Analysis](https://wasenderapi.com/blog/evolution-api-problems-2025-issues-errors-best-alternative-wasenderapi)
- [Evolution API WhatsApp Analysis (GuruSup)](https://gurusup.com/blog/evolution-api-whatsapp)
- [Meta Blocks Third-Party AI Chatbots (TechCrunch)](https://techcrunch.com/2025/10/18/whatssapp-changes-its-terms-to-bar-general-purpose-chatbots-from-its-platform/)
- [WhatsApp 2026 AI Policy Explained (Respond.io)](https://respond.io/blog/whatsapp-general-purpose-chatbots-ban)
- [Meta AI Chatbot Ban Details (ChatBoq)](https://chatboq.com/blogs/third-party-ai-chatbots-ban)
- [Brazil Orders Meta to Suspend Policy (TechCrunch)](https://techcrunch.com/2026/01/13/brazil-orders-meta-to-suspend-policy-banning-third-party-ai-chatbots-from-whatsapp/)
- [WAHA Pricing & Reliability Analysis](https://wasenderapi.com/blog/waha-pricing-why-wasenderapi-is-a-more-affordable-whatsapp-api)
- [WAHA vs Evolution API Comparison (Apidog)](https://apidog.com/blog/top-10-whatsapp-business-api/)
- [Chatwoot WhatsApp Campaigns Announcement](https://www.chatwoot.com/blog/whatspp-and-small-workflow-improvements/)
- [Chatwoot WhatsApp Interactive Templates Issues (GitHub #9991)](https://github.com/orgs/chatwoot/discussions/9991)
- [Chatwoot WhatsApp Flows Limitation (GitHub #9991)](https://github.com/orgs/chatwoot/discussions/9991)
