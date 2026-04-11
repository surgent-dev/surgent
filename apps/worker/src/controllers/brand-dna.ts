import type { BrandDna, ProjectOnboardingMetadata } from '@repo/db'
import { z } from 'zod'
import { generateJson } from '@/lib/ai'

const SYSTEM_PROMPT = `You are a world-class brand strategist, copywriter, market researcher, and creative director who has worked with hundreds of startups. Given a business profile from an entrepreneur, generate a comprehensive Brand DNA report that feels like they just hired a $10,000 agency.

Everything you write should be SPECIFIC to their business - no generic filler. Write copy they can literally paste and use TODAY.

Your output must be a single JSON object with this exact structure:

{
  "brand": {
    "tagline": "A memorable, punchy tagline (max 10 words)",
    "mission": "A clear 1-2 sentence mission statement",
    "voice": "Description of the brand's tone and communication style (1-2 sentences)",
    "personality": ["Trait1", "Trait2", "Trait3", "Trait4"]
  },
  "colors": {
    "primary": "#hex",
    "secondary": "#hex",
    "accent": "#hex",
    "background": "#hex",
    "text": "#hex"
  },
  "typography": {
    "heading": "Google Font name",
    "body": "Google Font name"
  },
  "style": ["keyword1", "keyword2", "keyword3"],

  "websiteCopy": {
    "heroHeadline": "The main headline for their homepage - punchy, benefit-driven, max 8 words",
    "heroSubheadline": "Supporting line that adds context (1-2 sentences)",
    "ctaButton": "Primary CTA button text (2-4 words, action-oriented)",
    "aboutBio": "A 2-3 paragraph about page bio they can paste directly. Write in first person if solopreneur, 'we' if agency/team. Make it human and compelling.",
    "metaDescription": "SEO meta description, 150-160 characters, includes target keyword",
    "valuePropositions": ["Value prop 1 (1 sentence)", "Value prop 2", "Value prop 3"]
  },

  "socialProfiles": {
    "instagram": "Ready-to-paste Instagram bio (max 150 chars, include emoji, line breaks as \\n)",
    "twitter": "Ready-to-paste Twitter/X bio (max 160 chars)",
    "linkedin": "Ready-to-paste LinkedIn headline + summary (2-3 sentences)",
    "tiktok": "Ready-to-paste TikTok bio (max 80 chars, catchy)",
    "hashtags": ["hashtag1", "hashtag2", "..."] (10 niche-specific hashtags without the # symbol)
  },

  "elevatorPitch": {
    "thirtySeconds": "A natural, conversational 30-second elevator pitch they can memorize and say out loud. Written as spoken words, not marketing copy.",
    "sixtySeconds": "A 60-second version with more detail about the problem, solution, and why them."
  },

  "idealCustomer": {
    "name": "A realistic first name",
    "age": 32,
    "location": "City, State or region",
    "occupation": "Their job title or role",
    "story": "2-3 sentences painting a picture of their daily life and the problem they face. Make it vivid and specific.",
    "frustrations": ["Frustration 1", "Frustration 2", "Frustration 3"],
    "goals": ["Goal 1", "Goal 2", "Goal 3"],
    "objections": ["Reason they might not buy 1", "Reason 2", "Reason 3"]
  },

  "pricing": {
    "strategy": "1-2 sentences explaining the recommended pricing approach and why (e.g., 'Start with a free tier to build trust, then convert to a mid-range monthly plan. Your market is price-sensitive but values quality.')",
    "tiers": [
      {
        "name": "Tier name",
        "price": "$XX/mo or $XX one-time",
        "description": "One line describing who this is for",
        "features": ["Feature 1", "Feature 2", "Feature 3", "Feature 4"]
      }
    ] (2-3 tiers)
  },

  "seoKeywords": [
    { "keyword": "exact keyword phrase", "intent": "informational|commercial|transactional|navigational", "difficulty": "low|medium|high" }
  ] (10 keywords - mix of low and medium difficulty, focus on long-tail),

  "contentCalendar": [
    {
      "day": "Day 1",
      "platform": "Instagram|TikTok|LinkedIn|Twitter",
      "format": "carousel|reel|story|text post|thread|video",
      "topic": "What the post is about (1 sentence)",
      "caption": "The actual ready-to-post caption with emoji and hashtags. Make it authentic, not corporate."
    }
  ] (14 posts - first 2 weeks, mix of platforms and formats),

  "adCopy": [
    {
      "platform": "Meta|Google|TikTok",
      "headline": "Ad headline (max 40 chars)",
      "body": "Ad body copy (2-3 sentences, benefit-focused, creates urgency)",
      "cta": "CTA button text"
    }
  ] (3 ad variations),

  "marketResearch": {
    "targetAudience": {
      "demographics": "Age range, income level, location type, education (1-2 sentences)",
      "psychographics": "Values, lifestyle, interests, behaviors (1-2 sentences)",
      "painPoints": ["Pain 1", "Pain 2", "Pain 3", "Pain 4"],
      "desires": ["Desire 1", "Desire 2", "Desire 3", "Desire 4"]
    },
    "competitors": [
      { "name": "Real Company Name", "strengths": ["S1", "S2"], "weaknesses": ["W1", "W2"] }
    ] (exactly 3 real competitors),
    "positioning": "For [audience] who [need], [business] is the [category] that [key benefit].",
    "differentiators": ["D1", "D2", "D3"],
    "trends": ["Trend 1", "Trend 2", "Trend 3"]
  },

  "mvpStrategy": {
    "coreFeatures": [
      { "name": "Feature name", "description": "Why this matters (1 sentence)", "priority": "must-have|nice-to-have" }
    ] (6-8 features, at least 4 must-have),
    "contentPriorities": ["Content type 1", "Content type 2", "Content type 3", "Content type 4"],
    "marketingChannels": [
      { "channel": "Specific channel", "reason": "Why (1 sentence)" }
    ] (4 channels),
    "quickWins": ["Win 1", "Win 2", "Win 3", "Win 4"],
    "keyMetrics": ["Metric 1", "Metric 2", "Metric 3", "Metric 4"],
    "milestones": {
      "thirtyDays": ["M1", "M2", "M3"],
      "sixtyDays": ["M1", "M2", "M3"],
      "ninetyDays": ["M1", "M2", "M3"]
    }
  }
}

CRITICAL GUIDELINES:
- ALL copy must be specific to this exact business. Never use "[Business Name]" placeholders - use their actual name.
- Colors must be valid hex codes that work beautifully together. Consider industry norms but don't be generic.
- If reference websites are provided, draw heavy design inspiration from their aesthetic.
- Competitors must be REAL companies. If the niche is small, include adjacent/indirect competitors.
- Social bios must fit platform character limits exactly.
- Content calendar captions should sound human and authentic, not like a marketing textbook.
- Pricing tiers should be realistic for the industry and stage.
- SEO keywords should be things real people actually search for.
- Ad copy should be scroll-stopping, not generic.
- Return ONLY the JSON object, no markdown or extra text.`

function buildUserPrompt(onboarding: ProjectOnboardingMetadata): string {
  const parts: string[] = ['Here is the business profile:']

  if (onboarding.identity) parts.push(`- Who they are: ${onboarding.identity}`)
  if (onboarding.industry) parts.push(`- Industry: ${onboarding.industry}`)
  if (onboarding.businessName) parts.push(`- Business name: ${onboarding.businessName}`)
  if (onboarding.location) parts.push(`- Location: ${onboarding.location}`)
  if (onboarding.goal) parts.push(`- Primary goal: ${onboarding.goal}`)
  if (onboarding.audience) parts.push(`- Target customers: ${onboarding.audience}`)
  if (onboarding.stage) parts.push(`- Current stage: ${onboarding.stage}`)
  if (onboarding.referenceUrls?.length) {
    parts.push(
      `- Reference websites for design inspiration: ${onboarding.referenceUrls.join(', ')}`,
    )
  }
  if (onboarding.prompt) parts.push(`\nAdditional context from the user:\n${onboarding.prompt}`)

  parts.push('\nGenerate the complete Brand DNA report as JSON.')
  return parts.join('\n')
}

export async function generateBrandDna(onboarding: ProjectOnboardingMetadata): Promise<BrandDna> {
  const result = await generateJson<Omit<BrandDna, 'generatedAt'>>(
    [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(onboarding) },
    ],
    z.object({
      brand: z.object({
        tagline: z.string(),
        mission: z.string(),
        voice: z.string(),
        personality: z.array(z.string()),
      }),
      colors: z.object({
        primary: z.string(),
        secondary: z.string(),
        accent: z.string(),
        background: z.string(),
        text: z.string(),
      }),
      typography: z.object({ heading: z.string(), body: z.string() }),
      style: z.array(z.string()),
      websiteCopy: z.object({
        heroHeadline: z.string(),
        heroSubheadline: z.string(),
        ctaButton: z.string(),
        aboutBio: z.string(),
        metaDescription: z.string(),
        valuePropositions: z.array(z.string()),
      }),
      socialProfiles: z.object({
        instagram: z.string(),
        twitter: z.string(),
        linkedin: z.string(),
        tiktok: z.string(),
        hashtags: z.array(z.string()),
      }),
      elevatorPitch: z.object({ thirtySeconds: z.string(), sixtySeconds: z.string() }),
      idealCustomer: z.object({
        name: z.string(),
        age: z.number(),
        location: z.string(),
        occupation: z.string(),
        story: z.string(),
        frustrations: z.array(z.string()),
        goals: z.array(z.string()),
        objections: z.array(z.string()),
      }),
      pricing: z.object({
        strategy: z.string(),
        tiers: z.array(
          z.object({
            name: z.string(),
            price: z.string(),
            description: z.string(),
            features: z.array(z.string()),
          }),
        ),
      }),
      seoKeywords: z.array(
        z.object({
          keyword: z.string(),
          intent: z.enum(['informational', 'commercial', 'transactional', 'navigational']),
          difficulty: z.enum(['low', 'medium', 'high']),
        }),
      ),
      contentCalendar: z.array(
        z.object({
          day: z.string(),
          platform: z.string(),
          format: z.string(),
          topic: z.string(),
          caption: z.string(),
        }),
      ),
      adCopy: z.array(
        z.object({ platform: z.string(), headline: z.string(), body: z.string(), cta: z.string() }),
      ),
      marketResearch: z.object({
        targetAudience: z.object({
          demographics: z.string(),
          psychographics: z.string(),
          painPoints: z.array(z.string()),
          desires: z.array(z.string()),
        }),
        competitors: z.array(
          z.object({
            name: z.string(),
            strengths: z.array(z.string()),
            weaknesses: z.array(z.string()),
          }),
        ),
        positioning: z.string(),
        differentiators: z.array(z.string()),
        trends: z.array(z.string()),
      }),
      mvpStrategy: z.object({
        coreFeatures: z.array(
          z.object({
            name: z.string(),
            description: z.string(),
            priority: z.enum(['must-have', 'nice-to-have']),
          }),
        ),
        contentPriorities: z.array(z.string()),
        marketingChannels: z.array(z.object({ channel: z.string(), reason: z.string() })),
        quickWins: z.array(z.string()),
        keyMetrics: z.array(z.string()),
        milestones: z.object({
          thirtyDays: z.array(z.string()),
          sixtyDays: z.array(z.string()),
          ninetyDays: z.array(z.string()),
        }),
      }),
    }),
  )

  return {
    ...result,
    generatedAt: new Date().toISOString(),
  }
}
