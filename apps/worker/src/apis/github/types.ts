/**
 * GitHub service types and utilities
 * Extends Octokit types where possible to avoid duplication
 */

import { RestEndpointMethodTypes } from '@octokit/rest'

// Use Octokit's built-in repository type
export type GitHubRepository = RestEndpointMethodTypes['repos']['get']['response']['data']

// Service-specific options interface
export interface CreateRepositoryOptions {
  name: string
  description?: string
  private: boolean
  auto_init?: boolean
  token: string
}

export interface CreateOrganizationRepositoryOptions extends CreateRepositoryOptions {
  org: string
}

// Service result interfaces
export interface CreateRepositoryResult {
  success: boolean
  repository?: GitHubRepository
  error?: string
}
