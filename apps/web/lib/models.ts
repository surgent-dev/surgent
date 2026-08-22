export type ProviderModel = {
  id: string
  name: string
  providerId: string
  providerName: string
  byokProvider?: 'openai' | 'anthropic' | 'google'
  defaultVariant?: string
  maxVariant?: string
  limit: { context: number }
  icon: string
  badge: string
  badgeColor: string
  free?: boolean
}

export const MODELS: ProviderModel[] = [
  {
    id: 'deepseek-v4-flash-0731',
    name: 'DeepSeek V4 Flash',
    providerId: 'opencode',
    providerName: 'OpenCode',
    limit: { context: 1048576 },
    icon: '/surgent-logo.svg',
    badge: 'Best value',
    badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  },
  {
    id: 'gpt-5.5',
    name: 'GPT-5.5 Fast',
    providerId: 'opencode',
    providerName: 'OpenCode',
    byokProvider: 'openai',
    defaultVariant: 'medium',
    maxVariant: 'high',
    limit: { context: 1050000 },
    icon: '/OpenAI-logo.svg',
    badge: 'Latest',
    badgeColor: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
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
