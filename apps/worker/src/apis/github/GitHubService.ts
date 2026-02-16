/**
 * GitHub Service - Provides GitHub repository creation operations
 */

import {
  GitHubRepository,
  CreateRepositoryOptions,
  CreateOrganizationRepositoryOptions,
  CreateRepositoryResult,
} from './types'
import { createLogger } from '@/lib/logger'

const log = createLogger('github-service')

export class GitHubService {
  private static createHeaders(token: string, includeContentType = false): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'vibesdk/1.0',
    }

    if (includeContentType) {
      headers['Content-Type'] = 'application/json'
    }

    return headers
  }

  /**
   * Creates a new GitHub repository with optional auto-initialization
   */
  static async createUserRepository(
    options: CreateRepositoryOptions,
  ): Promise<CreateRepositoryResult> {
    const autoInit = options.auto_init ?? false

    log.info(
      {
        name: options.name,
        private: options.private,
        auto_init: autoInit,
        description: options.description ? 'provided' : 'none',
      },
      'creating user repository',
    )

    try {
      const response = await fetch('https://api.github.com/user/repos', {
        method: 'POST',
        headers: GitHubService.createHeaders(options.token, true),
        body: JSON.stringify({
          name: options.name,
          description: options.description,
          private: options.private,
          auto_init: autoInit,
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        log.error(
          {
            status: response.status,
            statusText: response.statusText,
            error: error,
            endpoint: 'https://api.github.com/user/repos',
          },
          'repository creation failed',
        )

        if (response.status === 403) {
          return {
            success: false,
            error:
              'GitHub App user authorization required. Please authorize the GitHub App and try again.',
          }
        }

        return {
          success: false,
          error: `Failed to create repository: ${error}`,
        }
      }

      const repository = (await response.json()) as GitHubRepository
      log.info({ url: repository.html_url }, 'user repository created')

      return {
        success: true,
        repository,
      }
    } catch (error) {
      log.error({ err: error }, 'failed to create user repository')
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Creates a new GitHub repository under an organization
   */
  static async createOrganizationRepository(
    options: CreateOrganizationRepositoryOptions,
  ): Promise<CreateRepositoryResult> {
    const autoInit = options.auto_init ?? false

    log.info(
      {
        org: options.org,
        name: options.name,
        private: options.private,
        auto_init: autoInit,
        description: options.description ? 'provided' : 'none',
      },
      'creating organization repository',
    )

    try {
      const response = await fetch(`https://api.github.com/orgs/${options.org}/repos`, {
        method: 'POST',
        headers: GitHubService.createHeaders(options.token, true),
        body: JSON.stringify({
          name: options.name,
          description: options.description,
          private: options.private,
          auto_init: autoInit,
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        log.error(
          {
            status: response.status,
            statusText: response.statusText,
            error: error,
            endpoint: `https://api.github.com/orgs/${options.org}/repos`,
          },
          'organization repository creation failed',
        )

        if (response.status === 403) {
          return {
            success: false,
            error:
              'GitHub App authorization or org permission required. Please authorize and try again.',
          }
        }

        return {
          success: false,
          error: `Failed to create repository: ${error}`,
        }
      }

      const repository = (await response.json()) as GitHubRepository
      log.info({ url: repository.html_url }, 'organization repository created')

      return {
        success: true,
        repository,
      }
    } catch (error) {
      log.error({ err: error }, 'failed to create organization repository')
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }
}
