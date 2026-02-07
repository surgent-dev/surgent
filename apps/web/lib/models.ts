export type ProviderModel = {
  id: string
  name: string
  providerId: string
  providerName: string
  limit: { context: number }
  icon: string
  badge: string
  badgeColor: string
}

export const MODELS: ProviderModel[] = [
  {
    id: 'gpt-5.2-codex',
    name: 'GPT-5.2 Codex',
    providerId: 'opencode',
    providerName: 'OpenCode',
    limit: { context: 400000 },
    icon: '/OpenAI-logo.svg',
    badge: 'Best',
    badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  },
  {
    id: 'claude-opus-4-6',
    name: 'Claude Code',
    providerId: 'opencode',
    providerName: 'OpenCode',
    limit: { context: 200000 },
    icon: '/claude-logo.svg',
    badge: 'Smart',
    badgeColor: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  },
  {
    id: 'gemini-3-flash',
    name: 'Gemini 3 Flash',
    providerId: 'opencode',
    providerName: 'OpenCode',
    limit: { context: 1048576 },
    icon: '/google-gemini.svg',
    badge: 'Fast',
    badgeColor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  },
  {
    id: 'gemini-3-pro',
    name: 'Gemini 3 Pro',
    providerId: 'opencode',
    providerName: 'OpenCode',
    limit: { context: 1048576 },
    icon: '/google-gemini.svg',
    badge: 'Pro',
    badgeColor: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  },
]

export const FLASH_MODEL = MODELS.find((m) => m.id === 'gemini-3-flash')!

export function getModel(id: string) {
  return MODELS.find((m) => m.id === id)
}
