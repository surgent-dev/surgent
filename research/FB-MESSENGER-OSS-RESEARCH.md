# Facebook Messenger Open-Source Integration Research

**Date:** 2026-03-29

## Executive Summary

After examining the actual source code and implementation quality of 7+ open-source projects, **Botpress has the best Facebook Messenger integration** for bot-building use cases -- it is the only OSS project with genuine **comment-to-DM** functionality built-in. **Chatwoot** has the most complete customer-support-oriented integration. However, **no open-source project comes close to ManyChat's growth tools** (comment-to-Messenger automation, m.me link triggers, JSON growth tools, checkbox plugin, etc.). This represents a massive gap in the OSS landscape.

---

## 1. Chatwoot

**GitHub:** 28,100 stars | Active (pushed daily) | Ruby on Rails
**Gems Used:** `facebook-messenger` gem + `koala` gem (no version pinning in Gemfile)

### API Version

- Uses `facebook-messenger` gem v2.1.2, which internally uses **Graph API v20.0**
- `koala` gem (v3.4.0) for general Facebook Graph API calls -- configurable API version via `Koala.config.api_version`

### Implementation Quality

**Model:** `Channel::FacebookPage` (`app/models/channel/facebook_page.rb`)

- Subscribes to: messages, messaging_deliveries, messaging_echoes, messaging_reads, messaging_handovers
- Token encryption support
- Auto-subscribe/unsubscribe on channel create/destroy
- Contact inbox creation for Instagram IDs

**Outgoing Messages** (`SendOnFacebookService`):

- Text messages with optional quick replies
- Attachments (image, audio, video, file) sent individually
- Uses `Facebook::Messenger::Bot.deliver()` with `messaging_type: 'MESSAGE_TAG'`
- Message tags: `HUMAN_AGENT` or `ACCOUNT_UPDATE`
- Error handling for timeouts and JSON parse failures

### What It Supports

- Incoming: text, attachments, echoes, read receipts, delivery confirmations, handover protocol
- Outgoing: text, quick replies, image/audio/video/file attachments
- Unified inbox across channels
- Instagram DMs, story replies, mentions (separate channel but same architecture)

### What It Does NOT Support

- **No comment-to-Messenger / comment-to-DM**
- No template messages (generic, receipt, airline, etc.)
- No persistent menu configuration
- No Get Started button
- No m.me link handling
- No growth tools whatsoever
- No structured message types beyond quick replies
- Agent reply-to-specific-message not supported via API (dashboard display only)

### Verdict

Solid **customer support** integration. Treats Messenger as another inbox channel. Not designed for marketing automation, bot building, or growth.

---

## 2. Botpress

**GitHub:** 14,600 stars | Active (pushed weekly) | TypeScript
**Integration Version:** 5.1.7

### API Version

- Requires **Graph API v15.0 or higher** (must be manually set in Facebook App settings -- not the default)
- Internally uses Meta Graph API through a shared `metaClient` abstraction

### Implementation Quality

**Structure:** Full integration module at `integrations/messenger/`

- `integration.definition.ts` -- defines channels, actions, config schema
- `src/setup.ts` -- OAuth, manual, and sandbox configuration modes
- `src/channels/` -- message channel implementations
- `src/webhook/` -- webhook handler with rate limiting (1 req/1000ms)
- `src/actions/` -- proactive messaging actions
- VRL processing files for data extraction and link templates
- Vitest test configuration
- Sentry error tracking

**Two Channels:**

1. `channel` -- Standard Messenger DM conversations (tags: ID, commentId, recipientId, senderId)
2. `commentReplies` -- Replies to Facebook Page post comments (tags: commentID, postID, userID)

### Key Features (BEST-IN-CLASS for bot building)

- **Comment-to-DM:** Can detect comments on Page posts and initiate private DM conversations
- **Proactive conversation creation** from comment IDs or Messenger user IDs
- **"Start DM Conversation from Comment"** action card
- **"Get or Create a Conversation"** action
- **"Get or Create a User"** action (with name, picture URL, email)
- User profile auto-sync (name + picture URL)
- Media file downloads via Files API with configurable expiry
- Webhook signature verification (HMAC via client secret)
- OAuth, manual, and sandbox configuration modes

### Webhook Subscriptions

- `messages`
- `messaging_postbacks`
- `feed` (required for comment interaction features)

### What It Does NOT Support

- No m.me link special handling
- No checkbox plugin
- No JSON growth tools
- No persistent menu management
- No Get Started button management
- Limited to text message card (no carousel templates visible in definition)

### Verdict

**Best comment-to-DM implementation** in any open-source project. The two-channel architecture (DM + commentReplies) is smart. Closest to ManyChat's comment automation, but still far from ManyChat's full growth toolkit.

---

## 3. n8n

**GitHub:** 181,700 stars | Active (pushed daily) | TypeScript

### Implementation

Two nodes, neither Messenger-specific:

1. **FacebookGraphApi node** (`FacebookGraphApi.node.ts`)
   - Generic Graph API HTTP wrapper
   - Supports API versions v3.0 through v23.0 + "Default"
   - Operations: GET, POST, DELETE
   - Configurable host URLs (graph endpoint, video upload endpoint)
   - Binary file uploads, query parameter customization
   - **Not Messenger-specific at all** -- it is a raw API client

2. **FacebookTrigger node** (`FacebookTrigger.node.ts`)
   - Subscribes to 11 object types: Ad Account, Application, Certificate Transparency, Group, Instagram, Link, Page, Permissions, User, WhatsApp Business Account, Workplace Security
   - Webhook verification via challenge-response
   - HMAC-SHA1 signature validation (if appSecret configured)
   - **Explicitly disclaims Messenger support** in the code
   - Note in code: "To watch Whatsapp business account events use the Whatsapp trigger node"

### What You CAN Do (with manual work)

- Build a Messenger bot workflow using the generic Graph API node + Webhook node
- Community workflow templates exist (e.g., "Facebook Messenger Bot with GPT-4")
- Requires manual webhook subscription setup via Graph API
- Requires manual message formatting

### What It Does NOT Support

- No native Messenger trigger node
- No message type abstractions
- No template message helpers
- No comment-to-DM
- No growth tools
- n8n Cloud may not even include the Facebook Messenger Trigger capability

### Verdict

n8n is a **workflow automation tool**, not a Messenger integration. You can wire up Messenger via raw Graph API calls, but there is zero Messenger-specific abstraction. Useful as plumbing, not as a Messenger platform.

---

## 4. Rocket.Chat

**GitHub:** 45,000 stars | Active | TypeScript/Meteor

### Implementation

- Facebook Messenger is available as a **Marketplace app** (not core)
- Installed via Marketplace > Explore > Facebook App
- Requires Omnichannel feature enabled
- Requires public internet-accessible instance + Rocket.Chat Cloud connection

### Features

- Receive and send Messenger messages
- Quick reply buttons
- Welcome messages for chat start/close
- File sharing
- Route Facebook pages to specific departments
- Agent assignment via Omnichannel

### Known Issues (from GitHub)

- Issue #24780: Facebook Pages not listing, conversations one-directional
- Issue #17952: Attachments (images/files) not appearing from Messenger
- Issue #534: `subscribed_fields` API errors
- Multiple forum threads about broken integration
- No clear documentation on which API version is used

### What It Does NOT Support

- No comment-to-DM
- No template messages
- No growth tools
- No bot building capability (it is a team chat tool)

### Verdict

**Fragile integration** focused on agent-based customer support. Marketplace app architecture means it can break independently from the core. Multiple unresolved GitHub issues suggest maintenance problems.

---

## 5. Rasa

**GitHub:** 21,100 stars | Active | Python
**File:** `rasa/core/channels/facebook.py`

### API Version

- Uses the `fbmessenger` Python library as abstraction -- **no explicit Graph API version specified** in code
- The `fbmessenger` library defaults to whatever Meta's current default is

### Implementation Quality (Partial)

**Three classes:**

| Class           | Purpose                                                                                                               |
| --------------- | --------------------------------------------------------------------------------------------------------------------- |
| `Messenger`     | Incoming message handler: text, quick replies, audio, image, video, file, postbacks                                   |
| `MessengerBot`  | Outgoing: text, image URLs, quick replies, buttons (max 3), generic template elements, custom JSON, typing indicators |
| `FacebookInput` | Sanic web server routes, HMAC-SHA256 webhook validation, hub challenge verification                                   |

### Message Types

- **Incoming:** text, quick replies, audio, image, video, file attachments, postbacks
- **Outgoing:** text (split by double newline), images, quick replies, button template (max 3 buttons), generic template (carousel elements), raw JSON payloads, sender actions (typing on/off, mark seen)

### What It Does NOT Support

- No read receipts handling
- No delivery confirmation handling
- No message echo handling
- No comment-to-DM
- No growth tools
- No persistent menu
- No Get Started button
- No structured templates beyond button/generic
- No error recovery or retry logic
- Limited to 3 buttons per message

### Verdict

**Minimal but functional** for simple chatbot use cases. Designed as a connector for Rasa's NLU pipeline, not as a full Messenger platform integration. The button limit of 3 and lack of advanced templates is limiting.

---

## 6. Hexabot

**GitHub:** 927 stars | Active (pushed daily) | TypeScript
**Extension:** `hexabot-channel-messenger` (separate npm package)
**Extension Stars:** 5

### API Version

- Uses a `GraphApi` class (internal abstraction) -- **no explicit version specified** in channel code
- Version likely configured at the GraphApi wrapper level

### Implementation Quality (Good for its size)

**File:** `index.channel.ts`

**Incoming:**

- Text messages, attachments (image/video/audio/file), quick replies, postback events
- HMAC-SHA1 signature verification
- Webhook subscription verification (hub.challenge)

**Outgoing:**

- Button template (text with action buttons)
- Generic template (carousel/gallery with multiple elements)
- List template (deprecated, auto-converts to carousel with "View More" button)
- Quick replies
- Simple attachments (image, video, audio, file)
- Typing indicators (configurable up to 20 seconds)

**Platform Features:**

- Persistent menu configuration (`_setPersistentMenu`)
- Greeting text (`_setGreetingText`)
- Get Started button (`_setGetStartedButton`)
- User profile retrieval (name, picture, locale, timezone, gender)
- User label management (sync labels with Facebook)
- Custom labels for conversation organization

### What It Does NOT Support

- No comment-to-DM
- No m.me link handling
- No growth tools
- Small community (5 stars on the extension)

### Verdict

**Surprisingly complete Messenger-specific implementation** for a small project. The persistent menu, Get Started button, greeting text, and label management are features most larger projects lack. Best "pure Messenger platform" implementation if you need bot framework features without comment-to-DM.

---

## 7. Other Notable Open-Source Projects

### BootBot (Node.js)

- **GitHub:** 975 stars | **Last pushed: March 2023** (abandoned)
- Simple JavaScript framework for Messenger bots
- Clean API but completely unmaintained
- No comment-to-DM

### Stealth (Ruby)

- 596 stars | Framework for text/voice chatbots
- Multi-channel (Messenger, SMS, Alexa)
- Minimal Messenger-specific features

### Ampalibe (Python)

- Lightweight Python framework specifically for Messenger bots
- Active development
- Good for quick bot prototyping

### messenger-node (Node.js)

- By `amuramoto` (former Meta developer)
- Node.js SDK specifically for Messenger Platform
- Not actively maintained

---

## 8. Open-Source Comment-to-DM Tools

This is ManyChat's killer feature and the **biggest gap in the OSS landscape**.

### What Exists

| Project                                               | Stars | Comment-to-DM        | Platform           | Status |
| ----------------------------------------------------- | ----- | -------------------- | ------------------ | ------ |
| **Botpress**                                          | 14.6k | Yes (Facebook only)  | TypeScript         | Active |
| **SAAS-Instagram-DM-Automations** (SashenJayathilaka) | 43    | Yes (Instagram)      | Next.js/TypeScript | Active |
| **saas-dm-automations** (Sudershhh)                   | 10    | Yes (Instagram)      | Next.js/TypeScript | Active |
| **MR.DM** (Oxlac)                                     | -     | Bulk DM sending only | Python             | Active |

### SAAS-Instagram-DM-Automations (Best OSS Comment-to-DM)

- **GitHub:** github.com/SashenJayathilaka/SAAS-Instagram-DM-Automations
- **Tech Stack:** Next.js 14 (App Router), TypeScript, TailwindCSS, Prisma, Neon (PostgreSQL), Clerk auth, Stripe, OpenAI
- **Features:**
  - Instagram API integration with OAuth
  - Automation builder UI
  - Comment-to-DM automation for outreach
  - Keyword-triggered DM automations
  - Story reply automations
  - Dashboard with metrics
- **Limitation:** Instagram only, not Facebook Messenger. Tutorial/portfolio project quality, not production-grade.

### What Does NOT Exist in OSS

- **No open-source ManyChat alternative** that covers Facebook + Instagram comment-to-DM
- **No OSS m.me link growth tools**
- **No OSS checkbox plugin equivalent**
- **No OSS JSON growth tools**
- **No OSS Messenger Ref URL handling**
- **No OSS "Send to Messenger" plugin**

### Verdict

**Massive opportunity.** The comment-to-DM space is dominated by SaaS (ManyChat, Chatfuel, respond.io). The only OSS implementations are either Botpress (limited to Facebook, requires their cloud) or small tutorial projects for Instagram. A production-grade OSS comment-to-DM tool for both Facebook and Instagram does not exist.

---

## 9. facebook-messenger Gem (Ruby)

**RubyGems:** rubygems.org/gems/facebook-messenger
**GitHub:** github.com/jgorset/facebook-messenger (970 stars)
**Maintainer:** Johannes Gorset

### Version History

| Version   | Date         | Notes            |
| --------- | ------------ | ---------------- |
| **2.1.2** | Dec 19, 2025 | Latest (recent!) |
| 2.0.1     | Jul 31, 2020 | -                |
| 2.0.0     | Jul 31, 2020 | -                |
| 1.5.0     | Apr 19, 2020 | -                |

**Total downloads:** 1,463,677

### Graph API Version

- Uses **Graph API v20.0** (hardcoded in `base_uri 'https://graph.facebook.com/v20.0'`)

### Webhook Events Supported (15 total)

message, delivery, postback, optin, read, account_linking, referral, message_echo, payment, policy_enforcement, pass_thread_control, game_play, reaction, **feed**, leadgen

### Key Methods

- `deliver()` -- send message payload to a page
- `reply_to_comment()` -- reply to Facebook comments via Graph API
- `on()` -- register event hooks
- `receive()` -- parse incoming webhook payloads
- Default timeout: 300 seconds

### Notable

- **Has `reply_to_comment()` method** -- enables comment reply functionality
- **Has `feed` event** -- can receive feed (post/comment) webhooks
- **Has `referral` event** -- can handle m.me link referrals
- Actively maintained (Dec 2025 release)
- Used by Chatwoot in production

### Verdict

**Best Ruby library for Messenger.** Actively maintained, supports modern Graph API, has comment reply and feed event support. The `referral` event + `reply_to_comment` method could be the building blocks for comment-to-DM.

---

## 10. Meta's Official SDKs

### facebook-nodejs-business-sdk

- **GitHub:** github.com/facebook/facebook-nodejs-business-sdk (584 stars)
- **Latest:** v25.0.0 (March 10, 2026) -- corresponds to Graph API v25.0
- **Focus:** Marketing API, Pages API, Business Manager, Instagram API
- **Messenger Platform:** Not specifically covered. The SDK handles Graph API broadly but has no Messenger-specific abstractions (no message templates, no webhook helpers, no Send API wrappers)
- Available on npm as `facebook-nodejs-business-sdk`

### facebook-python-business-sdk

- **GitHub:** github.com/facebook/facebook-python-business-sdk
- Same architecture as Node.js SDK -- Marketing API focused
- No Messenger-specific support

### Meta Business SDK (General)

- Available for: Node.js, Python, PHP, Java, Ruby
- Covers: Marketing API, Pages API, Business Manager, Instagram API, Conversions API
- **Does NOT cover:** Messenger Platform Send/Receive API, Webhook management, Template messages, Growth tools

### Community Python Libraries

| Library                     | Messenger Support      | Status           |
| --------------------------- | ---------------------- | ---------------- |
| `fbmessenger` (rehabstudio) | Yes (used by Rasa)     | Maintenance mode |
| `pymessenger` (davidchua)   | Yes (Send/Receive API) | Unmaintained     |
| `messenger-api-python`      | Yes (various APIs)     | Active on PyPI   |

### Verdict

**Meta does NOT provide an official Messenger Platform SDK.** Their Business SDK focuses on Marketing/Ads APIs. For Messenger, you must use community libraries or build directly against the Graph API. This is a significant gap -- Meta expects developers to use the raw REST API with their own webhook server.

---

## Comparison Matrix

| Feature                  | Chatwoot        | Botpress        | n8n        | Rocket.Chat | Rasa        | Hexabot     |
| ------------------------ | --------------- | --------------- | ---------- | ----------- | ----------- | ----------- |
| **Stars**                | 28.1k           | 14.6k           | 181.7k     | 45k         | 21.1k       | 927         |
| **Graph API Version**    | v20.0 (via gem) | v15.0+          | v3.0-v23.0 | Unknown     | Unspecified | Unspecified |
| **Text Messages**        | Yes             | Yes             | Manual     | Yes         | Yes         | Yes         |
| **Quick Replies**        | Yes             | Yes             | Manual     | Yes         | Yes         | Yes         |
| **Button Template**      | No              | Limited         | Manual     | No          | Yes (max 3) | Yes         |
| **Generic Template**     | No              | Limited         | Manual     | No          | Yes         | Yes         |
| **Carousel**             | No              | No              | Manual     | No          | No          | Yes         |
| **Attachments In**       | Yes             | Yes             | Manual     | Buggy       | Yes         | Yes         |
| **Attachments Out**      | Yes             | Yes             | Manual     | Yes         | Yes         | Yes         |
| **Typing Indicators**    | No              | No              | Manual     | No          | Yes         | Yes         |
| **Persistent Menu**      | No              | No              | No         | No          | No          | **Yes**     |
| **Get Started Button**   | No              | No              | No         | No          | No          | **Yes**     |
| **Greeting Text**        | No              | No              | No         | No          | No          | **Yes**     |
| **Comment-to-DM**        | **No**          | **Yes**         | No         | No          | No          | No          |
| **m.me Link Handling**   | No              | No              | No         | No          | No          | No          |
| **Feed Webhooks**        | No              | **Yes**         | No         | No          | No          | No          |
| **User Labels**          | No              | No              | No         | No          | No          | **Yes**     |
| **Webhook Verification** | Via gem         | HMAC            | HMAC-SHA1  | Unknown     | HMAC-SHA256 | HMAC-SHA1   |
| **Growth Tools**         | None            | Minimal         | None       | None        | None        | None        |
| **Use Case**             | Support         | Bot + Marketing | Workflow   | Support     | NLU Bot     | Bot         |

---

## Key Takeaways for Surgent

1. **Comment-to-DM is the #1 gap.** Only Botpress has it for Facebook, and only tutorial-grade projects have it for Instagram. A production-quality, self-hosted comment-to-DM engine for both Facebook and Instagram would be a significant differentiator.

2. **The `facebook-messenger` Ruby gem is surprisingly good.** v2.1.2 (Dec 2025), Graph API v20.0, has `reply_to_comment()`, `feed` events, and `referral` events. These are the building blocks for comment-to-DM and growth tools. If building in Ruby/Rails, this gem is the foundation.

3. **For a TypeScript/Node.js stack**, there is no equivalent of the `facebook-messenger` gem. You would need to build against the raw Graph API or fork/adapt Botpress's integration code (MIT licensed).

4. **Meta has no official Messenger SDK.** Their Business SDK (v25.0.0) covers Marketing/Ads APIs only. Messenger Platform developers are on their own for Send API, webhooks, templates, and growth tools.

5. **Hexabot's implementation is the most complete for pure Messenger platform features** (persistent menu, Get Started, greeting, labels, carousels). Worth studying as a reference implementation even if the project is small.

6. **Growth tools are completely absent from OSS.** No open-source project implements: m.me link parameters, checkbox plugin, "Send to Messenger" button, JSON ad growth tools, or Messenger Ref URLs. This is ManyChat's moat.

7. **The Graph API version matters.** Facebook is currently on v25.0 (March 2026). Most OSS projects are on v15-v20. Staying current requires regular maintenance -- this is where many projects fall behind.

---

## Recommended Approach

If Surgent wants to build best-in-class Messenger integration:

1. **Build directly on Graph API v25.0** -- do not depend on community libraries that lag behind
2. **Implement the full Messenger Platform feature set:**
   - Send API (all message types, templates, quick replies)
   - Webhook handling (all 15+ event types)
   - Handover Protocol (for bot-to-human handoff)
   - Messenger Profile API (persistent menu, Get Started, greeting, whitelisted domains)
3. **Build comment-to-DM as a core feature** -- this is the #1 growth tool and the #1 gap in OSS
4. **Support both Facebook and Instagram** comment-to-DM (Instagram uses the same underlying API since Meta unified them)
5. **Study Hexabot's implementation** for Messenger Profile API features (persistent menu, Get Started, greeting, labels)
6. **Study Botpress's two-channel architecture** (DM channel + commentReplies channel) as a design pattern
7. **The `facebook-messenger` gem's `reply_to_comment()` method** shows the API pattern if exploring Ruby

---

## Sources

- [Chatwoot GitHub](https://github.com/chatwoot/chatwoot) (28.1k stars)
- [Botpress GitHub](https://github.com/botpress/botpress) (14.6k stars)
- [Botpress Messenger Integration Docs](https://botpress.com/docs/integrations/integration-guides/messenger)
- [Botpress Messenger Hub](https://botpress.com/integrations/messenger)
- [n8n GitHub](https://github.com/n8n-io/n8n) (181.7k stars)
- [Rocket.Chat GitHub](https://github.com/RocketChat/Rocket.Chat) (45k stars)
- [Rocket.Chat FB Messenger Issue #24780](https://github.com/RocketChat/Rocket.Chat/issues/24780)
- [Rasa GitHub](https://github.com/RasaHQ/rasa) (21.1k stars)
- [Hexabot GitHub](https://github.com/Hexastack/hexabot) (927 stars)
- [Hexabot Messenger Extension](https://hexabot.ai/extensions/67272f907ddd71f5fb2f0cd5)
- [facebook-messenger gem](https://github.com/jgorset/facebook-messenger) (970 stars)
- [facebook-messenger on RubyGems](https://rubygems.org/gems/facebook-messenger/versions/1.0.0)
- [facebook-nodejs-business-sdk](https://github.com/facebook/facebook-nodejs-business-sdk) (584 stars)
- [Meta Messenger Platform Docs](https://developers.facebook.com/docs/messenger-platform)
- [Meta Business SDK Docs](https://developers.facebook.com/docs/business-sdk/)
- [SAAS-Instagram-DM-Automations](https://github.com/SashenJayathilaka/SAAS-Instagram-DM-Automations) (43 stars)
- [saas-dm-automations](https://github.com/Sudershhh/saas-dm-automations) (10 stars)
- [BootBot](https://github.com/Charca/bootbot) (975 stars, abandoned)
- [n8n Facebook Trigger Docs](https://docs.n8n.io/integrations/builtin/trigger-nodes/n8n-nodes-base.facebooktrigger/)
- [Chatwoot Facebook Integration](https://www.chatwoot.com/features/facebook-integration/)
- [Chatwoot Instagram Integration](https://www.chatwoot.com/features/instagram-integration/)
