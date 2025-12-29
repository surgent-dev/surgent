/**
 * GitHub Service - Provides secure API-based GitHub repository operations
 * Handles repository creation, file management, and commit synchronization
 */

import { Octokit, RestEndpointMethodTypes } from '@octokit/rest';
import {
    GitHubRepository,
    CreateRepositoryOptions,
    CreateOrganizationRepositoryOptions,
    CreateRepositoryResult,
    GitHubServiceError,
} from './types';
import { GitHubPushRequest, GitHubPushResponse } from './types';

interface FileContent {
    filePath: string;
    fileContents: string;
    isBinary?: boolean;
}

interface LocalCommit {
    hash: string;
    message: string;
    timestamp: string;
}

interface GitContext {
    localCommits: LocalCommit[];
    hasUncommittedChanges: boolean;
}

interface RemoteCommit {
    sha: string;
    message: string;
    date: string;
}

type GitHubTree = NonNullable<RestEndpointMethodTypes['git']['createTree']['parameters']['tree']>[number];

const log = (msg: string, data?: unknown) => console.log(`[GitHubService] ${msg}`, data ?? '')

export class GitHubService {
    private static readonly DEFAULT_BOT_NAME = 'surgent-bot';
    private static readonly DEFAULT_BOT_EMAIL = 'noreply@surgent.dev';
    private static readonly README_CONTENT = '# Generated App\n\nGenerated with Surgent';

    private static createAuthorInfo(request: GitHubPushRequest, timestamp?: string) {
        return {
            name: request.username || GitHubService.DEFAULT_BOT_NAME,
            email: request.email || GitHubService.DEFAULT_BOT_EMAIL,
            ...(timestamp ? { date: timestamp } : {})
        };
    }

    private static createHeaders(token: string, includeContentType = false): Record<string, string> {
        const headers: Record<string, string> = {
            Authorization: `token ${token}`,
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'vibesdk/1.0',
        };

        if (includeContentType) {
            headers['Content-Type'] = 'application/json';
        }

        return headers;
    }

    private static createOctokit(token: string): Octokit {
        if (!token?.trim()) {
            throw new GitHubServiceError('No GitHub token provided', 'NO_TOKEN');
        }
        return new Octokit({ auth: token });
    }
    /**
     * Creates a new GitHub repository with optional auto-initialization
     */
    static async createUserRepository(
        options: CreateRepositoryOptions
    ): Promise<CreateRepositoryResult> {
        const autoInit = options.auto_init ?? true;
        
        log('Creating GitHub repository', {
            name: options.name,
            private: options.private,
            auto_init: autoInit,
            description: options.description ? 'provided' : 'none'
        });
        
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
            });

            if (!response.ok) {
                const error = await response.text();
                log('Repository creation failed', {
                    status: response.status,
                    statusText: response.statusText,
                    error: error,
                    endpoint: 'https://api.github.com/user/repos'
                });
                
                if (response.status === 403) {
                    return {
                        success: false,
                        error: 'GitHub App user authorization required. Please authorize the GitHub App and try again.'
                    };
                }
                
                return {
                    success: false,
                    error: `Failed to create repository: ${error}`
                };
            }

            const repository = (await response.json()) as GitHubRepository;
            log(`Successfully created repository: ${repository.html_url}`);

            return {
                success: true,
                repository
            };
        } catch (error) {
            log('Failed to create user repository', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Creates a new GitHub repository under an organization
     */
    static async createOrganizationRepository(
        options: CreateOrganizationRepositoryOptions
    ): Promise<CreateRepositoryResult> {
        const autoInit = options.auto_init ?? true;

        log('Creating GitHub organization repository', {
            org: options.org,
            name: options.name,
            private: options.private,
            auto_init: autoInit,
            description: options.description ? 'provided' : 'none'
        });

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
            });

            if (!response.ok) {
                const error = await response.text();
                log('Organization repository creation failed', {
                    status: response.status,
                    statusText: response.statusText,
                    error: error,
                    endpoint: `https://api.github.com/orgs/${options.org}/repos`
                });

                if (response.status === 403) {
                    return {
                        success: false,
                        error: 'GitHub App authorization or org permission required. Please authorize and try again.'
                    };
                }

                return {
                    success: false,
                    error: `Failed to create repository: ${error}`
                };
            }

            const repository = (await response.json()) as GitHubRepository;
            log(`Successfully created repository: ${repository.html_url}`);

            return {
                success: true,
                repository
            };
        } catch (error) {
            log('Failed to create organization repository', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Pushes files to GitHub repository with intelligent commit strategy based on local and remote state
     */
    static async pushFilesToRepository(
        files: FileContent[],
        request: GitHubPushRequest,
        gitContext?: GitContext
    ): Promise<GitHubPushResponse> {
        try {
            log('Initiating GitHub push operation', {
                repositoryUrl: request.repositoryHtmlUrl,
                fileCount: files.length,
                localCommitCount: gitContext?.localCommits?.length || 0,
                hasUncommittedChanges: gitContext?.hasUncommittedChanges || false
            });

            const octokit = GitHubService.createOctokit(request.token);
            
            // Parse repository info from URL
            const repoInfo = GitHubService.extractRepoInfo(request.cloneUrl || request.repositoryHtmlUrl);
            if (!repoInfo) {
                throw new GitHubServiceError('Invalid repository URL format', 'INVALID_REPO_URL');
            }

            const { owner, repo } = repoInfo;

            // Get repository metadata
            const { data: repository } = await octokit.rest.repos.get({ owner, repo });
            const defaultBranch = repository.default_branch || 'main';

            // Fetch remote commit history
            const remoteCommits = await GitHubService.fetchRemoteCommits(octokit, owner, repo, defaultBranch);
            
            // Determine base commit SHA - handle both auto-initialized and empty repositories
            const parentCommitSha = remoteCommits.length > 0 ? remoteCommits[0].sha : '';
            
            log('Repository state analyzed', {
                defaultBranch,
                remoteCommitCount: remoteCommits.length,
                hasParentCommit: !!parentCommitSha,
                repositoryEmpty: remoteCommits.length === 0
            });

            // Plan commit strategy
            const commitStrategy = GitHubService.planCommitStrategy(gitContext, remoteCommits, files);
            
            log('Commit strategy planned', {
                strategy: commitStrategy.type,
                commitsToCreate: commitStrategy.commits.length,
                remoteCommitCount: remoteCommits.length
            });
            
            if (files.length === 0) {
                log('No files to commit');
                return { success: true, commitSha: parentCommitSha };
            }

            if (commitStrategy.commits.length === 0) {
                log('No commits needed - repository is already in sync');
                return { success: true, commitSha: parentCommitSha };
            }

            // Execute commit strategy
            const finalCommitSha = await GitHubService.executeCommitStrategy(
                octokit, owner, repo, defaultBranch, commitStrategy, parentCommitSha, request
            );

            log('GitHub push completed', {
                repositoryUrl: request.repositoryHtmlUrl,
                finalCommitSha,
                strategy: commitStrategy.type,
                commitsCreated: commitStrategy.commits.length
            });

            return {
                success: true,
                commitSha: finalCommitSha
            };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const githubError = error as { status?: number };
            log('Failed to push files to GitHub', {
                error: errorMessage,
                repositoryUrl: request.repositoryHtmlUrl,
                fileCount: files.length
            });

            return {
                success: false,
                error: `GitHub push failed: ${errorMessage}`,
                status: githubError.status,
                details: {
                    operation: 'intelligent_push',
                    stderr: errorMessage
                }
            };
        }
    }

    /**
     * Fetches commit history from remote GitHub repository
     */
    private static async fetchRemoteCommits(
        octokit: Octokit, 
        owner: string, 
        repo: string, 
        branch: string
    ): Promise<RemoteCommit[]> {
        try {
            const { data: commits } = await octokit.rest.repos.listCommits({
                owner,
                repo,
                sha: branch,
                per_page: 100 // Get recent history
            });

            return commits.map(commit => ({
                sha: commit.sha,
                message: commit.commit.message,
                date: commit.commit.author?.date || new Date().toISOString()
            }));
        } catch (error) {
            const githubError = error as { status?: number };
            if (githubError.status === 409 || githubError.status === 404) {
                // Empty repository or branch doesn't exist
                log('Remote repository is empty or branch does not exist');
                return [];
            }
            throw error;
        }
    }

    /**
     * Determines optimal commit strategy based on local and remote repository state
     */
    private static planCommitStrategy(
        gitContext: GitContext | undefined,
        remoteCommits: RemoteCommit[],
        files: FileContent[]
    ): {
        type: 'single_commit' | 'multi_commit' | 'incremental';
        commits: Array<{
            message: string;
            timestamp: string;
            files: FileContent[];
        }>;
    } {
        const localCommits = gitContext?.localCommits || [];
        
        // Strategy 1: No local history - single commit
        if (localCommits.length === 0) {
            return {
                type: 'single_commit',
                commits: [{
                    message: 'Generated app',
                    timestamp: new Date().toISOString(),
                    files
                }]
            };
        }

        // Strategy 2: Remote is empty - push all local commits
        if (remoteCommits.length === 0) {
            return {
                type: 'multi_commit',
                commits: localCommits.map(commit => ({
                    message: commit.message,
                    timestamp: commit.timestamp,
                    files // All files in final commit (simplified)
                }))
            };
        }

        // Strategy 3: Both exist - find what's new and create incremental commits
        const newLocalCommits = localCommits.filter(local => 
            !remoteCommits.some(remote => remote.message === local.message)
        );

        if (newLocalCommits.length > 0) {
            return {
                type: 'incremental',
                commits: newLocalCommits.map(commit => ({
                    message: commit.message,
                    timestamp: commit.timestamp,
                    files
                }))
            };
        }

        // Strategy 4: Everything is in sync - only commit if there are uncommitted changes
        if (gitContext?.hasUncommittedChanges) {
            return {
                type: 'single_commit',
                commits: [{
                    message: 'Update generated app',
                    timestamp: new Date().toISOString(),
                    files
                }]
            };
        }

        // Strategy 5: Everything is perfectly in sync - no commit needed
        return {
            type: 'single_commit',
            commits: []
        };
    }

    /**
     * Executes the planned commit strategy for the given repository
     */
    private static async executeCommitStrategy(
        octokit: Octokit,
        owner: string,
        repo: string,
        branch: string,
        strategy: ReturnType<typeof GitHubService.planCommitStrategy>,
        initialParentSha: string,
        request: GitHubPushRequest
    ): Promise<string> {
        let parentCommitSha = initialParentSha;

        for (const commitPlan of strategy.commits) {
            if (!parentCommitSha) {
                // Empty repository - create README to bootstrap, then use normal flow
                log('Bootstrapping empty repository with README', { 
                    owner, repo, branch
                });
                
                const { data: readmeCommit } = await octokit.rest.repos.createOrUpdateFileContents({
                    owner,
                    repo,
                    path: 'README.md',
                    message: 'Initial commit',
                    content: Buffer.from(GitHubService.README_CONTENT, 'utf8').toString('base64'),
                    branch,
                    author: GitHubService.createAuthorInfo(request),
                    committer: GitHubService.createAuthorInfo(request)
                });

                if (!readmeCommit.commit.sha) {
                    throw new GitHubServiceError('Failed to get commit SHA from README creation', 'COMMIT_SHA_MISSING');
                }
                parentCommitSha = readmeCommit.commit.sha;
                
                log('Repository bootstrapped successfully', { 
                    owner, repo,
                    bootstrapCommitSha: parentCommitSha 
                });
                
                // Now fall through to use the normal tree-based approach below
            }
            
            // Repository has commits (either existing or just bootstrapped) - use tree-based approach
            let baseTreeSha: string | undefined;
            if (parentCommitSha) {
                const { data: parentCommit } = await octokit.rest.git.getCommit({
                    owner,
                    repo,
                    commit_sha: parentCommitSha
                });
                baseTreeSha = parentCommit.tree.sha;
            }
            log('Creating tree-based commit', { 
                owner, repo, 
                baseTreeSha,
                fileCount: commitPlan.files.length 
            });
            
            // Create tree entries for all files
            const treeEntries: GitHubTree[] = [];
            for (const file of commitPlan.files) {
                if (file.isBinary) {
                    const { data } = await octokit.rest.git.createBlob({
                        owner,
                        repo,
                        content: file.fileContents,
                        encoding: 'base64'
                    });
                    treeEntries.push({
                        path: file.filePath,
                        mode: '100644',
                        type: 'blob',
                        sha: data.sha
                    });
                    continue;
                }

                treeEntries.push({
                    path: file.filePath,
                    mode: '100644',
                    type: 'blob',
                    content: file.fileContents
                });
            }

            const { data: tree } = await octokit.rest.git.createTree({
                owner,
                repo,
                tree: treeEntries,
                base_tree: baseTreeSha
            });

            const { data: commit } = await octokit.rest.git.createCommit({
                owner,
                repo,
                message: commitPlan.message,
                tree: tree.sha,
                parents: [parentCommitSha],
                author: GitHubService.createAuthorInfo(request, commitPlan.timestamp),
                committer: GitHubService.createAuthorInfo(request, commitPlan.timestamp)
            });

            parentCommitSha = commit.sha;

            // Update branch reference
            await octokit.rest.git.updateRef({
                owner,
                repo,
                ref: `heads/${branch}`,
                sha: parentCommitSha,
                force: true
            });
        }

        return parentCommitSha;
    }

    /**
     * Extracts owner and repository name from GitHub URL
     */
    private static extractRepoInfo(url: string): { owner: string; repo: string } | null {
        try {
            // Normalize SSH format to HTTPS
            let cleanUrl = url;
            
            if (url.startsWith('git@github.com:')) {
                cleanUrl = url.replace('git@github.com:', 'https://github.com/');
            }
            
            const urlObj = new URL(cleanUrl);
            const pathParts = urlObj.pathname.split('/').filter(part => part);
            
            if (pathParts.length >= 2) {
                const owner = pathParts[0];
                const repo = pathParts[1].replace('.git', '');
                return { owner, repo };
            }
            
            return null;
        } catch (error) {
            log('Failed to parse repository URL', { url, error });
            return null;
        }
    }


}
