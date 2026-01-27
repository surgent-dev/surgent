/**
 * Shared GitHub types for worker routes
 */

export interface ProjectGitHub {
  installationId: number
  repoOwner: string
  repoName: string
  repoId: number
  defaultBranch?: string
  lastPushedSha?: string
  lastPushAt?: string
}
