# GEO & AEO Research: Making Websites Visible to AI Search Engines

_Compiled March 2026_

---

## 1. Academic Research on GEO

### The Foundational Paper

**"GEO: Generative Engine Optimization"** by Pranjal Aggarwal (IIT Delhi), Vishvak Murahari (Princeton), and collaborators from Georgia Tech, Allen Institute of AI, and Princeton.

- First published: November 2023 (arXiv 2311.09735)
- Accepted: KDD 2024 (30th ACM SIGKDD Conference on Knowledge Discovery and Data Mining, Barcelona)
- Benchmark: **GEO-bench** -- 10,000 queries (8K train, 1K val, 1K test) across 25 diverse domains sourced from 9 datasets (MS MARCO, ORCAS-I, Natural Questions, AllSouls, LIMA, ELI5, Perplexity Discover, GPT-4 generated)

### Metrics Used

1. **Position-Adjusted Word Count** (objective): Combines normalized word count of cited sentences with exponential position decay. Formula: `sum(|s| * e^(-pos(s)/|S|))`
2. **Subjective Impression** (subjective): Seven sub-metrics assessed via GPT-3.5 evaluation -- relevance, influence, uniqueness, subjective position, subjective count, click probability, diversity

### The 9 Techniques Tested -- Effectiveness Data

| Technique               | Pos-Adj Word Count | Subjective Impression | Tier         |
| ----------------------- | ------------------ | --------------------- | ------------ |
| **Quotation Addition**  | **+40.7%**         | **+27.8%**            | High-impact  |
| **Statistics Addition** | **+31.2%**         | **+23.0%**            | High-impact  |
| **Cite Sources**        | **+29.6%**         | **+13.6%**            | High-impact  |
| Fluency Optimization    | +26.6%             | +13.6%                | Moderate     |
| Technical Terms         | +17.3%             | +10.2%                | Low-moderate |
| Easy-to-Understand      | +12.2%             | +6.2%                 | Low          |
| Authoritative Tone      | +10.7%             | +15.5%                | Low-moderate |
| Unique Words            | +5.6%              | +5.2%                 | Negligible   |
| Keyword Stuffing        | **-9.1%**          | +8.2%                 | **Harmful**  |

### Key Findings

1. **The "Triple Threat"**: Citations + Quotations + Statistics delivers 30-40% combined improvement across all domains
2. **Best synergy**: Fluency Optimization + Statistics Addition yields an extra 5.5% gain over either alone
3. **Lower-ranked sites benefit most**: Rank-5 websites saw +115.1% improvement with Cite Sources vs -30.3% for rank-1 sites
4. **Keyword stuffing actively harms visibility**: -10% degradation confirmed on Perplexity.ai real-world testing
5. **Authoritative tone alone doesn't help**: Generative engines are already robust to persuasive language without evidence backing it

### Domain-Specific Results

| Domain            | Best Technique      | Notes                      |
| ----------------- | ------------------- | -------------------------- |
| Debate questions  | Authoritative tone  | Strongest gain             |
| Factual queries   | Cite Sources        | +115.1% for rank-5 sources |
| Law & Government  | Statistics Addition | Optimal                    |
| People & Society  | Quotation Addition  | Most effective             |
| History           | Quotation Addition  | Strongest results          |
| Explanation-type  | Quotation Addition  | Superior performance       |
| Opinion questions | Statistics Addition | Best improvement           |

### Real-World Validation (Perplexity.ai Testing)

| Technique           | Pos-Adj Word Count | Subjective Impression |
| ------------------- | ------------------ | --------------------- |
| Quotation Addition  | +22%               | --                    |
| Statistics Addition | --                 | +37%                  |
| Keyword Stuffing    | -10%               | --                    |

### Follow-Up Research Papers (2024-2026)

From the [Awesome-GEO repository](https://github.com/DavidHuji/Awesome-GEO):

**2026:**

- "IF-GEO: Conflict-Aware Instruction Fusion for Multi-Query Generative Engine Optimization"
- "Multimodal Generative Engine Optimization: Rank Manipulation for Vision-Language Model Rankers"
- "Navigating the Shift: A Comparative Analysis of Web Search and Generative AI Response Generation"

**2025:**

- "C-SEO Bench: Does Conversational SEO Work?" (NeurIPS D&B 2025)
- "Dynamics Of Adversarial Attacks On Large Language Model-Based Search Engines"
- "White Hat Search Engine Optimization using Large Language Models"
- "Role-Augmented Intent-Driven Generative Search Engine Optimization"
- "StealthRank: LLM Ranking Manipulation via Stealthy Prompt Optimization"
- "NExT-Search: Rebuilding User Feedback Ecosystem for Generative AI Search"

**2024:**

- "What Evidence Do Language Models Find Convincing?"
- "Adversarial Search Engine Optimization for Large Language Models"
- "Ranking Manipulation for Conversational Search Engines"

### Paper Limitations Acknowledged

1. Methods may need to adapt as generative engines evolve
2. Query distributions change over time
3. Black-box algorithm opacity prevents assessment of traditional search ranking impact
4. Single-turn evaluation only; multi-turn dynamics not studied
5. Analysis based on top 5 search results; larger context windows may shift dynamics

---

## 2. How AI Search Engines Select Sources

### ChatGPT Search (OpenAI)

**Process:** Uses Retrieval-Augmented Generation (RAG). Retrieves documents, ranks by cosine similarity to the query, then generates a response.

**Critical statistic:** ChatGPT only cites **15% of the pages it retrieves**. 85% of sources retrieved during search are never cited.

**What gets cited:**

- Unique insights, specific data points, clear explanations of complex concepts
- Content with verifiable facts and cross-referenced data
- Structured comparison articles, "best of" listicles, expert guides
- Pages ranking #1 in Google: 43.2% citation rate (3.5x more than pages beyond top 20)
- Content from the upper 10-20% of a page performs best -- ChatGPT cites heavily from the top of pages
- **44% of citations come from the first third of content**

**Citation concentration:** ~30 domains capture 67% of citations within a topic. Wikipedia dominates at 7.8% of total citations (47.9% of top 10).

**Authority signals prioritized:** Author credentials, citations to primary research, transparent sourcing, E-E-A-T factors.

### Perplexity AI

**Process:** Multi-step combining NLP, real-time web retrieval, and ranking algorithms. Interprets intent, conducts real-time searches, evaluates candidates on relevance, credibility, freshness, and structure.

**Key characteristics:**

- **Freshness is aggressive**: ~30-day freshness sweet spot; ~50% of citations are from the current year
- **Reddit-dependent**: Reddit accounts for 6.6% overall, 46.7% of top-10 sources
- **Content structure matters**: Bullet points, numbered steps, comparison tables, semantic HTML improve extraction efficiency
- **Quality over backlinks**: Emphasizes content quality and topical relevance over traditional backlink profiles
- Transparent citations -- every response includes numbered citations with actual URLs

### Google AI Overviews

**Process:** Powered by Gemini 2.0, appears in 25.11% of Google searches (up from 13.14% in March 2025). Now serves 2 billion monthly users globally.

**Source selection factors:**

- **E-E-A-T signals** form the core evaluation framework
- **Multimodal content**: Pages combining text + images + video + structured data see 156% higher selection rates; full multimodal + schema = up to 317% more citations
- **Semantic completeness**: Content scoring 8.5/10+ is 4.2x more likely to appear
- **Factual verification**: Content with verifiable facts shows 89% higher selection probability
- **Query fan-out**: In 2026, only ~38% of cited pages also rank in top-10 organic (down from 76% in mid-2025) due to Gemini 3's more aggressive query expansion

**Zero-click rates:**

- Standard AI Overviews: 43% zero-click
- AI Mode: **93% zero-click** (only 6-8% of sessions result in external visits)

### Bing Copilot (Microsoft)

**Process:** Pulls from Bing search index and live web results, ranks for relevance and credibility, synthesizes with LLM.

**Key factors:**

- Prefers recent, authoritative, clearly structured, factual content
- Typically cites 3-8 sources per response with footnote-style citations
- Schema markup (particularly FAQ and HowTo) receives preferential treatment
- Evaluates Entity Authority, Real-time Relevance, Structured Data Quality, Content Comprehensiveness

### What Makes Content "Citable" vs "Invisible"

**Citable content:**

- Finding/answer stated first, then supporting evidence
- Each section stands alone as a complete answer
- Critical data in HTML text (not behind JavaScript, PDFs, or graphics)
- Named authors with relevant credentials
- Original content with firsthand data or insights
- Clean semantic HTML with proper headings
- Recently published or updated
- Objective, fact-based statements

**Invisible content:**

- Hidden behind JavaScript widgets or click-to-reveal sections
- Content that loads only after user interaction
- Missing structural markup (no clear H1-H3 hierarchy)
- Overly promotional language ("world's best," "revolutionary")
- Generic content restating commonly available information
- Content buried in academic convention format (background -> lit review -> methodology -> findings)

### Platform Citation Pattern Differences (680M citations analyzed)

| Platform            | Top Source                    | Source Preference                   |
| ------------------- | ----------------------------- | ----------------------------------- |
| ChatGPT             | Wikipedia (7.8%)              | Encyclopedic, factual content       |
| Google AI Overviews | Reddit (2.2%), YouTube (1.9%) | Balanced social-professional mix    |
| Perplexity          | Reddit (6.6%)                 | Community discussions, peer-to-peer |

**.com domains dominate with 80%+ of citations** across all platforms. .org sites at ~11%.

---

## 3. llms.txt Deep Dive

### Specification Origin

- **Creator:** Jeremy Howard, co-founder of Answer.AI
- **Date:** September 3, 2024
- **Motivation:** Howard released FastHTML (Python web framework) and developers complained AI coding assistants couldn't help them use it because the documentation wasn't in a format LLMs could consume
- **Spec location:** [llmstxt.org](https://llmstxt.org/)
- **GitHub:** [AnswerDotAI/llms-txt](https://github.com/AnswerDotAI/llms-txt)

### Exact Format and Structure

```markdown
# Project Name <-- REQUIRED: H1 with project/site name

> Brief summary of the project <-- OPTIONAL: Blockquote with key info

Optional detailed paragraphs <-- OPTIONAL: Any markdown except headings

## Section Name <-- OPTIONAL: H2-delimited file lists

- [Link Title](url): Description <-- Markdown list with hyperlinks + optional notes

## Optional <-- SPECIAL: URLs here can be skipped for shorter context

- [Link Title](url)
```

**Rules:**

- Only section is H1 (required)
- Blockquote must come immediately after H1
- No headings allowed in the detail paragraphs section
- File lists use markdown hyperlinks: `[name](url)` with optional `: notes`
- "Optional" is a special H2 section name for lower-priority content

**Companion files:**

- `llms.txt` -- Curated sitemap with links and brief descriptions
- `llms-full.txt` -- Complete content of documentation in single Markdown file
- `llms-small.txt` -- Ultra-compact version with only page structure

### Real Production Examples

**Stripe** (`docs.stripe.com/llms.txt`):

- Comprehensive guide organized by product (Payments, Checkout, Connect, Billing, etc.)
- Includes explicit LLM guidance: "Default to latest API versions," "Use Payment Element instead of legacy Card Element," "Avoid deprecated endpoints: Sources API, Tokens, legacy Charges API"
- Functions as a "guardrail system" ensuring LLM-generated code follows current best practices
- URLs follow pattern: `https://docs.stripe.com/[category]/[topic].md`

**Cursor** (`cursor.com/llms.txt`):

- Three main sections: Docs, CLI Documentation, Help Center
- Supports internationalization via URL prepending (e.g., `cursor.com/es/docs/bugbot.md`)
- URLs follow: `https://cursor.com/[docs|help]/[category]/[page].md`

**Astro** (`docs.astro.build/llms-small.txt`):

- Uses the small variant for concise structure overview

### Do AI Engines Actually Read llms.txt?

**The honest answer: No major AI provider has confirmed it.**

- **Google:** Gary Illyes (July 2025) stated Google doesn't support llms.txt and isn't planning to. John Mueller compared it to the discredited `<meta keywords>` tag.
- **OpenAI, Anthropic, Google:** No LLM provider has confirmed their crawlers consistently read or follow llms.txt instructions.
- **Primary value:** llms.txt is most useful for AI coding assistants (Cursor, Claude Code, Copilot) that can fetch and ingest documentation on-demand, not for search engine crawling.

### Adoption Statistics

- **SE Ranking survey (300K domains):** 10.13% adoption rate
- **NerdyData (July 2025):** Only 951 domains had published llms.txt
- **Mintlify inflection point (November 2024):** Rolled out llms.txt across all hosted docs sites, bringing thousands of docs sites online overnight (including Anthropic, Cursor)
- **Stripe, Anthropic, Cursor, FastHTML** are notable adopters
- Adoption remains concentrated in developer tools and tech documentation

### Integration Tools

- `llms_txt2ctx` (CLI and Python)
- JavaScript implementation
- VitePress and Docusaurus plugins
- WordPress plugins (LLMagnet)
- Astro integrations (`@4hse/astro-llms-txt`, `@waldheimdev/astro-ai-llms-txt`, `astro-llms-generate`)
- Drupal LLM Support module
- PHP library (`llms-txt-php`)
- VS Code PagePilot extension

---

## 4. Complete AI Crawler List (2026)

### Three Categories of AI Crawlers

1. **Training Data Crawlers** -- Collect web content at scale for model training
2. **User-Action Fetchers** -- Retrieve pages in real-time when a user asks for current information
3. **AI Search Crawlers** -- Index content specifically for AI-powered search products

### Complete Crawler Reference

#### OpenAI

| User-Agent      | Purpose                                       | Crawl Rate    |
| --------------- | --------------------------------------------- | ------------- |
| `GPTBot`        | AI training data collection (GPT-4o, GPT-5)   | 100 pages/hr  |
| `ChatGPT-User`  | Real-time web browsing for ChatGPT            | 2400 pages/hr |
| `OAI-SearchBot` | Powers ChatGPT search features (not training) | 150 pages/hr  |

#### Anthropic

| User-Agent         | Purpose                               | Crawl Rate   |
| ------------------ | ------------------------------------- | ------------ |
| `ClaudeBot`        | AI training data collection           | 500 pages/hr |
| `Claude-User`      | Real-time web access for Claude users | <10 pages/hr |
| `Claude-SearchBot` | Search indexing for Claude            | <10 pages/hr |
| `anthropic-ai`     | Legacy training crawler               | Varies       |

#### Google

| User-Agent              | Purpose                                            | Notes                          |
| ----------------------- | -------------------------------------------------- | ------------------------------ |
| `Google-Extended`       | Controls content use for Gemini/Vertex AI training | Does not affect search ranking |
| `GoogleOther`           | Internal R&D crawling                              | Generic fallback               |
| `GoogleOther-Video`     | Video URL fetching                                 |                                |
| `GoogleOther-Image`     | Image URL fetching                                 |                                |
| `Google-CloudVertexBot` | Vertex AI Agent Builder                            | Opt-in only                    |
| `Gemini-Deep-Research`  | Gemini Deep Research feature                       | Uses Googlebot IP ranges       |

#### Microsoft

| User-Agent | Purpose                                   | Crawl Rate    |
| ---------- | ----------------------------------------- | ------------- |
| `Bingbot`  | Powers Bing Search and Copilot AI answers | 1300 pages/hr |

#### Perplexity

| User-Agent        | Purpose                              | Crawl Rate   |
| ----------------- | ------------------------------------ | ------------ |
| `PerplexityBot`   | Search indexing for answer engine    | 150 pages/hr |
| `Perplexity-User` | Real-time browsing for user requests | Minimal      |

#### Meta

| User-Agent            | Purpose                        | Crawl Rate    |
| --------------------- | ------------------------------ | ------------- |
| `Meta-ExternalAgent`  | Training data for Llama models | 1100 pages/hr |
| `Meta-WebIndexer`     | Meta AI search capabilities    | Minimal       |
| `FacebookBot`         | Facebook content indexing      | Varies        |
| `facebookexternalhit` | Link preview generation        | Varies        |

#### Apple

| User-Agent          | Purpose                   | Notes                               |
| ------------------- | ------------------------- | ----------------------------------- |
| `Applebot`          | Siri and Spotlight search | Established crawler                 |
| `Applebot-Extended` | Apple AI model training   | Opt-in only, separate from Applebot |

#### Other Notable Crawlers

| User-Agent                     | Company      | Purpose                                         |
| ------------------------------ | ------------ | ----------------------------------------------- |
| `Amazonbot`                    | Amazon       | Alexa and Amazon AI services (1050 pages/hr)    |
| `Bytespider`                   | ByteDance    | TikTok and ByteDance LLMs                       |
| `DuckAssistBot`                | DuckDuckGo   | DuckDuckGo search (20 pages/hr)                 |
| `CCBot`                        | Common Crawl | Open-source web archive used by multiple AI cos |
| `cohere-training-data-crawler` | Cohere       | AI training data                                |
| `DeepSeekBot`                  | DeepSeek     | DeepSeek model training                         |
| `MistralAI-User`               | Mistral AI   | Citation fetching for Le Chat                   |
| `Diffbot`                      | Diffbot      | Web scraping for multiple clients               |
| `Webz.io`                      | Webz.io      | Data extraction for AI training                 |
| `ICC-Crawler`                  | NICT         | AI/ML data collection                           |

#### 2026 New Entrants

| User-Agent            | Company    | Notes                    |
| --------------------- | ---------- | ------------------------ |
| `GrokBot/1.0`         | xAI        | Grok search indexing     |
| `xAI-Grok/1.0`        | xAI        | Grok model training      |
| `Grok-DeepSearch/1.0` | xAI        | Grok Deep Research       |
| `Cloudflare-AutoRAG`  | Cloudflare | AutoRAG content indexing |
| `Google-Firebase`     | Google     | Firebase AI features     |

#### Unidentifiable (No Distinct User-Agent)

- you.com
- ChatGPT Operator (agentic browser)
- Bing Copilot chat
- Grok (some modes)

### Robots.txt Configuration for Maximum AI Visibility

For a site that **wants** maximum AI discoverability:

```
# === AI Search Crawlers (real-time retrieval for user queries) ===
User-agent: ChatGPT-User
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: Claude-User
Allow: /

User-agent: Claude-SearchBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Perplexity-User
Allow: /

User-agent: DuckAssistBot
Allow: /

User-agent: Bingbot
Allow: /

User-agent: MistralAI-User
Allow: /

# === AI Training Crawlers (opt-in to training for broader model awareness) ===
User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: Applebot-Extended
Allow: /

User-agent: Meta-ExternalAgent
Allow: /

User-agent: Amazonbot
Allow: /

User-agent: CCBot
Allow: /

User-agent: cohere-training-data-crawler
Allow: /

User-agent: DeepSeekBot
Allow: /

User-agent: Bytespider
Allow: /

# === Standard Search ===
User-agent: *
Allow: /

Sitemap: https://yoursite.com/sitemap.xml
```

**Important notes:**

- AI crawlers are NOT blocked by default -- they crawl unless explicitly disallowed
- `robots.txt` is a request, not a firewall -- well-behaved bots respect it, malicious scrapers ignore it
- 5.7% of requests presenting AI crawler user agents are spoofed
- Schedule **quarterly reviews** as new user agents emerge regularly
- If you only want search visibility (not training), block training crawlers (GPTBot, ClaudeBot, Google-Extended) while allowing user-action fetchers (ChatGPT-User, Claude-User)

---

## 5. GEO Techniques That Actually Work

### Content Structure Best Practices

**Lead with the answer:**

- Write a 50-70 word summary at the top of each section that can stand alone as a direct answer
- Structure: Direct 1-3 sentence answer -> Context paragraph -> Supporting evidence
- Each section should be independently citable -- AI extracts individual sections as standalone units
- Pages where each section stands alone consistently outperform every other format

**Heading hierarchy:**

- One clear H1 stating the main topic
- H2s for major sections
- H3s for subsections
- Sequential headings and rich schema correlate with **2.8x higher citation rates**

**Use question-answer format:**

- Match the exact questions users ask AI ("How do I...", "What is...")
- Provide the definitive answer immediately
- Follow with supporting detail

**Content in HTML, not JavaScript:**

- Core content must be in raw HTML (Ctrl+U test)
- Interactive widgets as enhancement only, not replacement
- Server-side render dynamic content
- Critical data in text, not graphics or PDFs

### E-E-A-T Signals for AI Engines

AI engines evaluate the same trust signals Google does:

- **Experience:** First-person accounts, case studies, original data
- **Expertise:** Named authors with credentials, demonstrated knowledge depth
- **Authoritativeness:** Cited by other sources, recognized in the field
- **Trustworthiness:** Transparent sourcing, factual accuracy, verifiable claims

**Specific signals that matter:**

- Author bylines with credentials and bios
- Citations to primary research (3-5 external citations per article minimum)
- Original data and statistics with dates and sample sizes
- Third-party validation: 86% of AI citations come from brand-managed sources, with 44% from first-party websites

### Schema.org Markup Impact

**The reality: Infrastructure, not a magic bullet.**

- A December 2024 study (SearchAtlas) found **no correlation** between schema markup coverage and citation rates in isolation
- However, schema remains one of the few things you can control that platforms explicitly use
- Semrush analysis found schema correlates with a **22% citation lift** as part of a broader strategy
- Structured data + FAQ schemas increase citation probability by **40-60%** within the first quarter

**Most valuable schema types for AI:**

- `FAQPage` -- Question/answer pairs directly matchable to queries
- `HowTo` -- Step-by-step processes
- `Article` / `TechArticle` -- Content classification
- `Organization` / `LocalBusiness` -- Entity recognition (especially for Bing Copilot)
- `Product` / `Review` -- Commercial queries
- `ProfilePage` -- Author/entity identification
- `DefinedTerm` -- Concept definitions

### SpeakableSpecification -- Current Status

- **Status:** Still in beta (since ~2020)
- **Scope:** Only works for U.S. users with Google Home devices set to English
- **Use:** Google Assistant reads marked-up sections aloud for topical news queries
- **SEO impact:** None confirmed while in beta
- **Recommendation:** Low priority. Worth adding if you're already implementing other schema, but don't prioritize it.

### Statistics and Data Citation

From the GEO paper: Statistics Addition delivered **+31.2%** visibility improvement.

**Implementation:**

- Replace vague claims ("significant growth") with specific numbers ("37% increase over 90 days")
- Include dates and sample sizes
- Cite the source of statistics
- Use inline numbers rather than relegating data to tables only
- Combine with Cite Sources for maximum effect (31.4% average combined boost)

### Source Crediting Patterns

From the GEO paper: Cite Sources delivered **+29.6%** visibility improvement.

**Implementation:**

- Add 5-7 inline citations per 1,000 words
- Link to authoritative domains (.edu, .gov, research papers)
- Use proper citation formatting (APA, MLA)
- Link directly to source material, not intermediary pages

### Content Freshness Signals

**This is critically important.** AI-surfaced URLs are **25.7% fresher** than traditional search results.

- Content updated within **30-90 days** is cited significantly more
- **50% of Perplexity's citations** are from the current year alone
- Pages not updated at least quarterly are **3x more likely to lose AI citations**
- Cosmetic updates don't count -- AI evaluates whether updates change substance

**Implementation:**

- Add clear update annotations: "Updated March 2026: New data on AI citation patterns added"
- Schedule quarterly content refresh cycles
- Use `dateModified` in schema markup
- Include timely statistics and current-year references

---

## 6. GEO Monitoring Tools

### Dedicated AI Visibility Platforms

| Tool                      | Platforms Tracked                                                                           | Key Features                                                                              | Data Refresh   |
| ------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------- |
| **Ahrefs Brand Radar**    | ChatGPT, Perplexity, Gemini, Claude, Copilot, DeepSeek, Google AI Overviews, Google AI Mode | 250M+ prompt database, custom prompts, citation gap analysis                              | Varies         |
| **Semrush AI Visibility** | ChatGPT, Google AI, Perplexity, Copilot                                                     | AI Visibility Score, 25-200 prompt monitoring, competitor benchmarking, free checker tool | Varies by tier |
| **Otterly.AI**            | ChatGPT, Perplexity, Google AI Overviews, AI Mode, Gemini, Copilot                          | Automated tracking, geographic simulation                                                 | Weekly         |
| **Scrunch AI**            | Multiple platforms                                                                          | Detailed AI metrics, optimization guidance                                                | Every 3 days   |
| **Peec AI**               | Multiple platforms                                                                          | Near real-time tracking                                                                   | Near real-time |
| **OpenLens**              | ChatGPT, Claude, Google AI, Perplexity, DeepSeek                                            | **Free platform**                                                                         | Varies         |
| **Profound AI**           | Multiple platforms                                                                          | Citation analysis, source breakdown                                                       | Varies         |

### Ahrefs Brand Radar -- Details

- Monitors 6 AI platforms: Google AI Overviews, Google AI Mode, ChatGPT, Perplexity, Gemini, Copilot
- Draws from 250M+ prompts to give comprehensive brand visibility picture
- **Key metrics:** Mentions (AI responses including your brand), Citations (responses citing your URLs), Impressions (mentions weighted by search volume)
- **Cited Domains & Cited Pages reports**: Find pages that mention your brand AND get cited most
- **Data sources:** Google's "People Also Ask" corpus + Ahrefs' 110 billion keyword database, expanded into sub-questions via PAA and Fanout systems
- Free tier available: [ahrefs.com/free-ai-visibility](https://ahrefs.com/free-ai-visibility)

### Semrush AI Visibility -- Details

- Free AI Search Visibility Checker available at [semrush.com/free-tools/ai-search-visibility-checker](https://www.semrush.com/free-tools/ai-search-visibility-checker/)
- Enterprise tier: AI traffic dashboards, share of voice analysis
- Tracks AI Visibility Score benchmarking across platforms

### Manual Monitoring Approach (DIY)

**Step-by-step process:**

1. **Identify key queries**: List 10-20 questions potential customers would ask AI about your product category
2. **Test across platforms**: Run each query on ChatGPT, Perplexity, Gemini, Google AI Overviews, Copilot
3. **Log results in a spreadsheet** with columns:
   - Platform
   - Query (exact prompt)
   - Brand mentioned (yes/no)
   - Sentiment (positive/neutral/negative)
   - Competitors mentioned
   - Sources cited (URLs)
   - Accuracy score (1-5)
   - Action needed

4. **Perplexity is uniquely useful**: Shows numbered citations with actual URLs, letting you reverse-engineer AI visibility transparently
5. **Repeat monthly**: Track trends over time

**Pro tip:** No tool's data is 100% accurate. Even with Ahrefs/Semrush, validate with manual spot-checks.

---

## 7. Traffic from AI Search in 2026

### Current Traffic Volume

| Metric                           | Value                               | Source         |
| -------------------------------- | ----------------------------------- | -------------- |
| AI referral traffic share        | **1.08% of all website traffic**    | Multiple       |
| AI referral growth rate          | ~1% month-over-month                | Superlines     |
| Total AI platform visits (2025)  | 55.2 billion (+81% YoY)             | SimilarWeb     |
| AI referral visits (June 2025)   | 1.13 billion (+357% vs June 2024)   | Exposure Ninja |
| Gen AI traffic growth vs organic | **165x faster** than organic search | Multiple       |

### Platform Market Share

| Platform            | AI Search Share       | Monthly Users                    |
| ------------------- | --------------------- | -------------------------------- |
| ChatGPT             | 60.7-80.5%            | 883M monthly / 810M daily active |
| Microsoft Copilot   | 13.2%                 | --                               |
| Perplexity          | 18-22% (of AI-native) | 22M monthly                      |
| Google Gemini       | 10-14%                | 400M monthly                     |
| DeepSeek            | Emerging              | 125M monthly (+62% YoY)          |
| Google AI Overviews | N/A (integrated)      | 2 billion monthly                |

### Traffic Quality -- Why GEO Matters

| Metric                 | AI Traffic          | Google Organic |
| ---------------------- | ------------------- | -------------- |
| **Conversion rate**    | **14.2-15.9%**      | 1.76-2.8%      |
| Claude conversion rate | **16.8%** (highest) | --             |
| Time on site           | 15 minutes avg      | 8 minutes avg  |
| Pageviews per visit    | 12                  | 9              |
| Lead close speed       | 20-30% faster       | Baseline       |
| Conversion multiplier  | **4.4x to 23x**     | 1x             |

One case study: ChatGPT delivered 12,832 site visits and $66,400 revenue despite being only 0.5% of traffic (but 12.1% of signups -- 24x average conversion).

### Impact on Traditional Search

| Metric                                         | Value                                 |
| ---------------------------------------------- | ------------------------------------- |
| Zero-click Google searches (US)                | 58.5%                                 |
| Zero-click in AI Mode                          | **93%**                               |
| Zero-click in AI Overviews                     | 43%                                   |
| AI Overview click reduction to top pages       | -58%                                  |
| AI Overviews in Google searches                | 25.11% (up from 13.14% in March 2025) |
| AI Overview cited pages also in top-10 organic | 38% (down from 76% in mid-2025)       |

### Growth Projections

- **Gartner prediction:** Traditional search volume drops 25% by 2026 (made Feb 2024; evidence is mixed -- no clear fulfillment yet as of early 2026)
- **GEO market size:** $848M (2025) -> $33.7B by 2034 (50.5% CAGR)
- **AI search ad spend:** $1B (2025) -> $25.9B by 2029 (13.6% of all search ad spend)
- **Projection:** AI search visitors to surpass traditional search visitors by 2028

### Third-Party vs First-Party Citations

- **86% of AI citations** come from brand-managed sources
- **44%** from first-party websites
- **48%** of citations from community platforms (Reddit, YouTube)
- Brands are **6.5x more likely** cited through third-party sources than own domains

### Volatility Warning

- AI Overview content changes **~70% of the time** for identical queries
- Only **30% of brands** remain visible in back-to-back responses
- Brand visibility dropped **35.9%** over 5 weeks in one study
- Citation performance has a roughly 30-day freshness window

### Is GEO Worth Investing In?

**Yes, with caveats:**

**For:**

- 4.4-23x conversion rate advantage over organic
- GEO market growing at 50.5% CAGR
- 38% of business decision-makers have allocated budget
- Low competition (keyword difficulty 15-20 vs 45-60 for SEO terms)
- 54% of US marketers implementing GEO within 3-6 months
- Initial improvements visible within 30-60 days

**Against:**

- ROI is currently impossible to isolate with traditional attribution
- Citation volatility is high (30% persistence rate)
- 93% zero-click in AI Mode means less traffic per citation
- Only 22% of marketers actively track AI visibility
- Primarily a brand awareness and sentiment play

**Verdict:** GEO is a strategic necessity, not optional. The traffic volume is small (~1% of total) but growing 165x faster than organic, with dramatically higher conversion quality. The real risk is in NOT doing it -- competitors who optimize now will establish the citation patterns that AI systems reinforce over time.

---

## 8. Implementation for Static Sites (Astro)

### Build-Time GEO Infrastructure

GEO for static sites should be treated as an **API-driven, build-time concern** rather than runtime optimization. The build process generates bot-friendly artifacts alongside human-facing pages.

#### Architecture Pattern

```
Content Source (CMS/Markdown)
    |
    v
Build Pipeline (Astro)
    |
    +--> Human-facing HTML pages (with schema, semantic HTML)
    +--> /llms.txt (curated index)
    +--> /llms-full.txt (complete content archive)
    +--> /sitemap.xml
    +--> /robots.txt (AI crawler directives)
```

### Generating llms.txt in Astro

#### Option 1: Astro Custom Endpoint

Create `src/pages/llms.txt.ts`:

```typescript
// src/pages/llms.txt.ts
import { getCollection } from 'astro:content'

export async function GET() {
  const pages = await getCollection('pages')
  const posts = await getCollection('blog')

  let body = `# Your Site Name\n\n`
  body += `> Brief description of your site and what it offers.\n\n`

  body += `## Pages\n\n`
  for (const page of pages) {
    body += `- [${page.data.title}](https://yoursite.com/${page.slug}): ${page.data.description}\n`
  }

  body += `\n## Blog\n\n`
  for (const post of posts.sort((a, b) => b.data.date - a.data.date)) {
    body += `- [${post.data.title}](https://yoursite.com/blog/${post.slug}): ${post.data.description}\n`
  }

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
```

#### Option 2: Build Script

Create `scripts/generate-llms.mjs`:

```javascript
import { readdir, readFile, writeFile } from 'fs/promises'
import path from 'path'

const ROOT = process.cwd()
const contentDir = path.join(ROOT, 'src', 'content', 'blog')

async function generate() {
  const files = await readdir(contentDir)
  const mdFiles = files.filter((f) => f.endsWith('.md')).sort()

  let llmsTxt = `# Your Site Name\n\n> Description\n\n## Blog\n\n`
  let llmsFullTxt = `# Your Site Name - Full Content\n\n`

  for (const file of mdFiles) {
    const raw = await readFile(path.join(contentDir, file), 'utf-8')
    const fmMatch = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/)
    let title = file.replace(/\.md$/, '')
    let body = raw

    if (fmMatch) {
      const fm = fmMatch[1]
      const t = fm.match(/title:\s*['"]?(.+?)['"]?\s*$/m)
      if (t) title = t[1]
      body = raw.slice(fmMatch[0].length)
    }

    const slug = file.replace(/\.md$/, '')
    llmsTxt += `- [${title}](https://yoursite.com/blog/${slug})\n`
    llmsFullTxt += `\n---\n\n## ${title}\n\nSlug: ${slug}\n\n${body.trim()}\n`
  }

  await writeFile(path.join(ROOT, 'public', 'llms.txt'), llmsTxt)
  await writeFile(path.join(ROOT, 'public', 'llms-full.txt'), llmsFullTxt)
}

generate()
```

Add to `package.json`:

```json
{
  "scripts": {
    "generate:llms": "node scripts/generate-llms.mjs",
    "prebuild": "npm run generate:llms"
  }
}
```

#### Option 3: Astro Integration Package

```bash
npm install @4hse/astro-llms-txt
```

```javascript
// astro.config.mjs
import { defineConfig } from 'astro/config'
import llmsTxt from '@4hse/astro-llms-txt'

export default defineConfig({
  integrations: [llmsTxt()],
})
```

This automatically generates `/llms.txt`, `/llms-small.txt`, and `/llms-full.txt` during build.

### Schema.org Implementation in Astro

Add JSON-LD to your layout:

```astro
---
// src/layouts/BaseLayout.astro
const { title, description, datePublished, dateModified, author } = Astro.props;
---
<html>
<head>
  <script type="application/ld+json" set:html={JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": title,
    "description": description,
    "datePublished": datePublished,
    "dateModified": dateModified || datePublished,
    "author": {
      "@type": "Person",
      "name": author
    },
    "publisher": {
      "@type": "Organization",
      "name": "Your Site",
      "url": "https://yoursite.com"
    }
  })} />

  <!-- FAQ Schema for pages with Q&A content -->
  {faqs && (
    <script type="application/ld+json" set:html={JSON.stringify({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": faqs.map(faq => ({
        "@type": "Question",
        "name": faq.question,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": faq.answer
        }
      }))
    })} />
  )}
</head>
```

### Content Structure for AI Citation

For each page, follow this pattern:

```markdown
# [Clear, Question-Matching Title]

[50-70 word direct answer summary -- this is what AI will extract]

## What Is [Topic]?

[Topic] is [definitive 1-2 sentence definition]. [Supporting context with specific statistics].

According to [Source], "[direct quotation with attribution]."

## Key Benefits

1. **[Benefit]**: [Specific claim with number]. [Source citation].
2. **[Benefit]**: [Specific claim with number]. [Source citation].

## How [Topic] Works

[Step-by-step explanation with each step as an independently citable unit]

## FAQ

### [Exact question users would ask AI]

[Direct answer in 1-3 sentences with a specific statistic or citation]
```

### robots.txt for Maximum AI Visibility (Static Site)

Place in `public/robots.txt`:

```
# AI Search Crawlers - Allow for citation
User-agent: ChatGPT-User
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: Claude-User
Allow: /

User-agent: Claude-SearchBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Perplexity-User
Allow: /

User-agent: Bingbot
Allow: /

User-agent: DuckAssistBot
Allow: /

# AI Training Crawlers - Allow for model awareness
User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: Applebot-Extended
Allow: /

User-agent: DeepSeekBot
Allow: /

# Standard
User-agent: *
Allow: /

Sitemap: https://yoursite.com/sitemap.xml
```

### Testing GEO in CI/CD

**Build-time validation:**

```javascript
// scripts/validate-geo.mjs
import { readFile, access } from 'fs/promises'
import { constants } from 'fs'

const checks = []

// 1. Verify llms.txt exists and has content
async function checkLlmsTxt() {
  const content = await readFile('dist/llms.txt', 'utf-8')
  if (!content.startsWith('# ')) throw new Error('llms.txt missing H1 header')
  if (content.length < 100) throw new Error('llms.txt suspiciously short')
  console.log('OK: llms.txt valid')
}

// 2. Verify robots.txt allows AI crawlers
async function checkRobotsTxt() {
  const content = await readFile('dist/robots.txt', 'utf-8')
  const required = ['ChatGPT-User', 'ClaudeBot', 'PerplexityBot']
  for (const agent of required) {
    if (!content.includes(agent)) {
      throw new Error(`robots.txt missing ${agent}`)
    }
  }
  console.log('OK: robots.txt has AI crawler directives')
}

// 3. Verify sitemap exists
async function checkSitemap() {
  await access('dist/sitemap-index.xml', constants.F_OK)
  console.log('OK: sitemap exists')
}

// 4. Sample HTML pages for schema markup
async function checkSchema() {
  const html = await readFile('dist/index.html', 'utf-8')
  if (!html.includes('application/ld+json')) {
    throw new Error('Missing JSON-LD schema markup on index page')
  }
  console.log('OK: Schema markup present')
}

// 5. Check that key content is in HTML (not behind JS)
async function checkSSR() {
  const html = await readFile('dist/index.html', 'utf-8')
  // Verify key content sections exist in static HTML
  if (html.includes('Loading...') && !html.includes('<article')) {
    console.warn('WARN: Page may have client-rendered content')
  }
  console.log('OK: Content appears server-rendered')
}

await Promise.all([checkLlmsTxt(), checkRobotsTxt(), checkSitemap(), checkSchema(), checkSSR()])
```

Add to CI pipeline:

```yaml
# In your GitHub Actions workflow
- name: Build
  run: npm run build

- name: Validate GEO artifacts
  run: node scripts/validate-geo.mjs
```

**Manual testing protocol:**

1. Copy llms.txt contents into ChatGPT, Perplexity, Gemini
2. Ask questions requiring data extraction from your content
3. Verify responses accurately reference your content
4. Check if your pages appear when asking platform-specific questions about your domain

### Complete Checklist for Static Site GEO

- [ ] `robots.txt` explicitly allows all AI crawlers
- [ ] `sitemap.xml` generated and referenced in robots.txt
- [ ] `llms.txt` generated at build time with curated page index
- [ ] `llms-full.txt` generated with complete content (optional but recommended)
- [ ] JSON-LD schema on every page (Article, FAQPage, Organization minimum)
- [ ] Every page has semantic HTML (H1, H2, H3 hierarchy)
- [ ] Lead paragraphs contain direct answers (50-70 words)
- [ ] Statistics with sources inline (3-5 citations per 1,000 words)
- [ ] `dateModified` schema updated on content changes
- [ ] Core content renders without JavaScript (SSG/SSR)
- [ ] Page load time under 3 seconds
- [ ] Author information with credentials on content pages
- [ ] FAQ sections with question-answer format
- [ ] Build-time validation script in CI/CD
- [ ] Quarterly content freshness reviews scheduled

---

## Sources

### Academic Papers

- [GEO: Generative Engine Optimization (arXiv)](https://arxiv.org/abs/2311.09735)
- [GEO at KDD 2024 (ACM)](https://dl.acm.org/doi/10.1145/3637528.3671900)
- [GEO Full Paper (arXiv HTML)](https://arxiv.org/html/2311.09735v3)
- [Awesome-GEO Research Repository](https://github.com/DavidHuji/Awesome-GEO)

### AI Platform Citation Analysis

- [AI Platform Citation Patterns (Profound)](https://www.tryprofound.com/blog/ai-platform-citation-patterns)
- [How ChatGPT Sources the Web (Profound)](https://www.tryprofound.com/blog/chatgpt-citation-sources)
- [ChatGPT Citations Favor Small Group of Domains (Search Engine Land)](https://searchengineland.com/chatgpt-citations-domains-study-472349)
- [Only 15% of Pages Retrieved by ChatGPT Appear in Final Answers (Search Engine Land)](https://searchengineland.com/chatgpt-retrieved-vs-citations-study-471606)
- [How Perplexity Selects Sources (Authority Tech)](https://authoritytech.io/blog/how-perplexity-selects-sources-algorithm-2026)
- [Google AI Overviews Ranking Factors (Wellows)](https://wellows.com/blog/google-ai-overviews-ranking-factors/)
- [Google AI Overview Citations Drop (ALM Corp)](https://almcorp.com/blog/google-ai-overview-citations-drop-top-ranking-pages-2026/)

### llms.txt

- [llms.txt Specification (llmstxt.org)](https://llmstxt.org/)
- [Answer.AI Original Proposal](https://www.answer.ai/posts/2024-09-03-llmstxt.html)
- [AnswerDotAI/llms-txt GitHub](https://github.com/AnswerDotAI/llms-txt)
- [Semrush: What Is llms.txt?](https://www.semrush.com/blog/llms-txt/)
- [Mintlify: Breaking Down the Skepticism](https://www.mintlify.com/blog/what-is-llms-txt)
- [Should Websites Implement llms.txt in 2026? (LinkBuildingHQ)](https://www.linkbuildinghq.com/blog/should-websites-implement-llms-txt-in-2026/)

### AI Crawler Lists

- [Complete Crawler List for AI User-Agents (Search Engine Journal)](https://www.searchenginejournal.com/ai-crawler-user-agents-list/558130/)
- [AI Search Crawlers + User Agents (Momentic)](https://momenticmarketing.com/blog/ai-search-crawlers-bots)
- [ai.robots.txt GitHub Repository](https://github.com/ai-robots-txt/ai.robots.txt)
- [Anthropic Claude Bots (ALM Corp)](https://almcorp.com/blog/anthropic-claude-bots-robots-txt-strategy/)

### GEO Techniques

- [GEO Experimental Techniques (MaximusLabs)](https://www.maximuslabs.ai/generative-engine-optimization/geo-experimental-techniques)
- [Why Your Content Is Invisible to AI (Search Engine Land)](https://searchengineland.com/content-invisible-ai-search-engines-456496)
- [Schema Markup and AI Search -- Without the Hype (Search Engine Land)](https://searchengineland.com/schema-markup-ai-search-no-hype-472339)
- [Content Freshness in AI Search (Quattr)](https://www.quattr.com/blog/content-freshness)
- [SpeakableSpecification (Google)](https://developers.google.com/search/docs/appearance/structured-data/speakable)

### Monitoring Tools

- [Ahrefs Brand Radar](https://ahrefs.com/brand-radar)
- [Semrush AI Visibility](https://www.semrush.com/ai-seo/overview/)
- [Free AI Search Visibility Checker (Semrush)](https://www.semrush.com/free-tools/ai-search-visibility-checker/)
- [Ahrefs Free AI Visibility](https://ahrefs.com/free-ai-visibility)
- [AI SEO Tracking Tools 2026 Analysis (Search Influence)](https://www.searchinfluence.com/blog/ai-seo-tracking-tools-2026-analysis-platforms/)

### Traffic & Market Data

- [AI Search Statistics 2026 (Superlines)](https://www.superlines.io/articles/ai-search-statistics/)
- [AI Search Statistics CMO Cheatsheet (Exposure Ninja)](https://exposureninja.com/blog/ai-search-statistics/)
- [100+ AI SEO Statistics 2026 (Position Digital)](https://www.position.digital/blog/ai-seo-statistics/)
- [Gartner Search Volume Prediction](https://www.gartner.com/en/newsroom/press-releases/2024-02-19-gartner-predicts-search-engine-volume-will-drop-25-percent-by-2026-due-to-ai-chatbots-and-other-virtual-agents)
- [GEO Cost Breakdown 2026 (PageTraffic)](https://www.pagetraffic.com/blog/generative-engine-optimization-geo-cost/)
- [ROI of GEO (Foundation Inc)](https://foundationinc.co/lab/roi-of-geo)

### Implementation

- [Build a GEO-Ready Website with Storyblok and Astro](https://www.storyblok.com/tp/geo-ready-website-storyblok-astro)
- [How I Added llms.txt to My Astro Blog](https://amanhimself.dev/blog/add-llms-txt-to-an-astro-blog/)
- [astro-llms-txt Integration](https://github.com/aligundogdu/astro-llms-txt)
- [4hse/astro-llms-txt](https://github.com/4hse/astro-llms-txt)
- [Configure Robots.txt for AI Crawlers (Genrank)](https://genrank.io/blog/configure-robots-txt-for-ai/)
- [AI Crawlers & Technical Optimization Guide (Qwairy)](https://www.qwairy.co/guides/complete-guide-to-robots-txt-and-llms-txt-for-ai-crawlers)
