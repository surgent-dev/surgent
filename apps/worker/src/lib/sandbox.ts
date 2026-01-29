import { DaytonaProvider, E2BProvider } from '@/apis/sandbox'
import type { Sandbox, SandboxProvider } from '@/apis/sandbox'
import { config } from '@/lib/config'
import { db } from '@/lib/db'

export type ProviderName = 'e2b' | 'daytona'

export const defaultProviderName: ProviderName =
  config.sandbox.provider === 'daytona' ? 'daytona' : 'e2b'

export function getProvider(providerName?: ProviderName | string | null): SandboxProvider {
  const name = providerName || config.sandbox.provider
  if (name === 'daytona') {
    return new DaytonaProvider(
      config.daytona.apiKey,
      config.daytona.serverUrl,
      config.daytona.snapshot,
    )
  }
  return new E2BProvider(config.e2b.template)
}

export async function resumeSandbox(
  sandboxId: string,
  providerName?: ProviderName | string | null,
): Promise<Sandbox> {
  return getProvider(providerName).resume(sandboxId)
}

export async function getSandboxByProjectId(projectId: string): Promise<Sandbox | null> {
  const row = await db
    .selectFrom('sandbox')
    .select(['id', 'provider'])
    .where('projectId', '=', projectId)
    .executeTakeFirst()

  if (!row?.id) return null

  return resumeSandbox(row.id, row.provider)
}

export function workspacePath(projectId: string): string {
  return `/home/user/workspace/${projectId.replace(/[^a-zA-Z0-9_-]+/g, '-') || 'project'}`
}
