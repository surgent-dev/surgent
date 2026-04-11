export type ProviderModel = {
  id: string
  name: string
  providerId: string
  providerName: string
  byokProvider?: 'openai' | 'anthropic' | 'google'
  maxVariant?: string
  limit: { context: number }
  icon: string
  badge: string
  badgeColor: string
  free?: boolean
}

export const MODELS: ProviderModel[] = [
  {
    id: 'glm-5.1',
    name: 'GLM 5.1',
    providerId: 'opencode',
    providerName: 'OpenCode',
    maxVariant: 'max',
    limit: { context: 200000 },
    icon: '/zai-logo.svg',
    badge: 'Latest',
    badgeColor: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
  },
  {
    id: 'claude-opus-4-6',
    name: 'Claude Opus 4.6',
    providerId: 'opencode',
    providerName: 'OpenCode',
    byokProvider: 'anthropic',
    maxVariant: 'max',
    limit: { context: 200000 },
    icon: '/claude-logo.svg',
    badge: 'Latest',
    badgeColor: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  },
  {
    id: 'gpt-5.4',
    name: 'GPT-5.4',
    providerId: 'opencode',
    providerName: 'OpenCode',
    byokProvider: 'openai',
    maxVariant: 'high',
    limit: { context: 1000000 },
    icon: '/OpenAI-logo.svg',
    badge: 'Latest',
    badgeColor: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  },
  {
    id: 'glm-5',
    name: 'GLM 5',
    providerId: 'opencode',
    providerName: 'OpenCode',
    limit: { context: 200000 },
    icon: '/zai-logo.svg',
    badge: 'Pro',
    badgeColor: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
  },
  {
    id: 'gemini-3-pro',
    name: 'Gemini 3 Pro',
    providerId: 'opencode',
    providerName: 'OpenCode',
    byokProvider: 'google',
    limit: { context: 1048576 },
    icon: '/google-gemini.svg',
    badge: 'Pro',
    badgeColor: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  },
  {
    id: 'gemini-3-flash',
    name: 'Gemini 3 Flash',
    providerId: 'opencode',
    providerName: 'OpenCode',
    byokProvider: 'google',
    limit: { context: 1048576 },
    icon: '/google-gemini.svg',
    badge: 'Fast',
    badgeColor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  },
]

export function getModel(id: string) {
  return MODELS.find((m) => m.id === id)
}
