import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import type { AppContext } from '@/types/application'
import type { ProjectGitHub } from '@/types/github'
import { db } from '@/lib/db'
import { getSandboxByProjectId, workspacePath } from '@/lib/sandbox'
import { getProjectWithAuth } from '@/services/projects'
import { createGitHubApp } from '@/apis/github'

const git = new Hono<AppContext>()
const idParam = z.object({ id: z.string().uuid() })

interface Commit {
  hash: string
  shortHash: string
  message: string
  author: string
  date: string
  pushed: boolean
}

interface GitLogResult {
  initialized: boolean
  commits: Commit[]
  branch: string
  ahead: number
  behind: number
}

// Auth
git.use('*', async (c, next) => {
  if (!c.get('user')) return c.json({ error: 'Unauthorized' }, 401)
  return next()
})

// === Routes ===

// GET /:id/git/log - Get git log (add ?fetch=true to sync with remote)
git.get('/:id/git/log', zValidator('param', idParam), async (c) => {
  const { id } = c.req.valid('param')
  const userId = c.get('user')!.id
  const shouldFetch = c.req.query('fetch') === 'true'

  const project = await getProjectWithAuth(id, c.get('user')!)

  const emptyResult: GitLogResult = {
    initialized: false,
    commits: [],
    branch: '',
    ahead: 0,
    behind: 0,
  }

  const sandbox = await getSandboxByProjectId(id)
  if (!sandbox) return c.json(emptyResult)

  const cwd = workspacePath(id)
  const gh = project.github as ProjectGitHub | null
  const defaultBranch = gh?.defaultBranch || 'main'

  // Build auth URL if connected and fetching
  let authUrl = ''
  let cleanUrl = ''
  if (shouldFetch && gh?.repoOwner && gh.repoName) {
    cleanUrl = `https://github.com/${gh.repoOwner}/${gh.repoName}.git`
    const githubApp = createGitHubApp()
    if (githubApp) {
      try {
        const { token } = await githubApp.getInstallationToken(gh.installationId)
        authUrl = `https://x-access-token:${token}@github.com/${gh.repoOwner}/${gh.repoName}.git`
      } catch (err) {
        console.warn('[git/log] Failed to get token:', err)
      }
    }
  }

  const script = `
set -e
cd '${cwd}' 2>/dev/null || exit 1

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "NOT_INITIALIZED"
  exit 0
fi

BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "${defaultBranch}")
[ "$BRANCH" = "HEAD" ] && BRANCH="${defaultBranch}"
echo "BRANCH:$BRANCH"

echo "COMMITS_START"
git log --format='%H%x1f%h%x1f%s%x1f%an%x1f%ai%x1e' -30 2>/dev/null || true
echo "COMMITS_END"

AHEAD=0
BEHIND=0
PUSHED_HASHES=""
${
  authUrl
    ? `
git remote set-url origin '${authUrl}' 2>/dev/null || git remote add origin '${authUrl}' 2>/dev/null || true
git fetch origin $BRANCH 2>/dev/null || true
git remote set-url origin '${cleanUrl}' 2>/dev/null || true
AHEAD=$(git rev-list origin/$BRANCH..HEAD --count 2>/dev/null || echo 0)
BEHIND=$(git rev-list HEAD..origin/$BRANCH --count 2>/dev/null || echo 0)
PUSHED_HASHES=$(git rev-list origin/$BRANCH 2>/dev/null || echo "")
`
    : `
AHEAD=$(git rev-list origin/${defaultBranch}..HEAD --count 2>/dev/null || echo 0)
BEHIND=$(git rev-list HEAD..origin/${defaultBranch} --count 2>/dev/null || echo 0)
PUSHED_HASHES=$(git rev-list origin/${defaultBranch} 2>/dev/null || echo "")
`
}

echo "AHEAD:$AHEAD"
echo "BEHIND:$BEHIND"
echo "PUSHED_START"
echo "$PUSHED_HASHES"
echo "PUSHED_END"
`

  try {
    const res = await sandbox.exec(script, { cwd: '/', timeout: 30000 })
    const output = res.output || ''

    if (output.includes('NOT_INITIALIZED')) {
      return c.json(emptyResult)
    }

    // Parse output
    const branchMatch = output.match(/BRANCH:(.+)/)
    const branch = branchMatch?.[1]?.trim() || defaultBranch

    const aheadMatch = output.match(/AHEAD:(\d+)/)
    const behindMatch = output.match(/BEHIND:(\d+)/)
    const ahead = parseInt(aheadMatch?.[1] || '0', 10)
    const behind = parseInt(behindMatch?.[1] || '0', 10)

    // Parse commits
    const commitsSection = output.match(/COMMITS_START\n([\s\S]*?)\nCOMMITS_END/)
    const commitsRaw = commitsSection?.[1] || ''

    // Parse pushed hashes
    const pushedSection = output.match(/PUSHED_START\n([\s\S]*?)\nPUSHED_END/)
    const pushedHashes = new Set((pushedSection?.[1]?.trim() || '').split('\n').filter(Boolean))

    const commits: Commit[] = commitsRaw
      .split('\x1e')
      .map((r) => r.trim())
      .filter(Boolean)
      .map((r) => {
        const [hash, shortHash = '', message = '', author = '', date = ''] = r.split('\x1f')
        return {
          hash: hash || '',
          shortHash,
          message,
          author,
          date,
          pushed: pushedHashes.has(hash),
        }
      })
      .filter((c) => c.hash)

    return c.json<GitLogResult>({ initialized: true, commits, branch, ahead, behind })
  } catch (err) {
    console.error('[git/log] error:', err)
    return c.json(emptyResult)
  }
})

// GET /:id/git/status - Single call
git.get('/:id/git/status', zValidator('param', idParam), async (c) => {
  const { id } = c.req.valid('param')
  const userId = c.get('user')!.id

  const project = await getProjectWithAuth(id, c.get('user')!)

  const sandbox = await getSandboxByProjectId(id)
  if (!sandbox) return c.json({ initialized: false })

  const cwd = workspacePath(id)
  const gh = project.github as ProjectGitHub | null
  const defaultBranch = gh?.defaultBranch || 'main'

  const script = `
cd '${cwd}' 2>/dev/null || exit 1
if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "NOT_INITIALIZED"
  exit 0
fi
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "${defaultBranch}")
[ "$BRANCH" = "HEAD" ] && BRANCH="${defaultBranch}"
echo "BRANCH:$BRANCH"
echo "STATUS_START"
git status --porcelain 2>/dev/null || true
echo "STATUS_END"
`

  try {
    const res = await sandbox.exec(script, { cwd: '/' })
    const output = res.output || ''

    if (output.includes('NOT_INITIALIZED')) {
      return c.json({ initialized: false })
    }

    const branchMatch = output.match(/BRANCH:(.+)/)
    const branch = branchMatch?.[1]?.trim() || defaultBranch

    const statusSection = output.match(/STATUS_START\n([\s\S]*?)\nSTATUS_END/)
    const lines = (statusSection?.[1]?.trim() || '').split('\n').filter(Boolean)

    const staged: string[] = []
    const unstaged: string[] = []
    const untracked: string[] = []

    for (const line of lines) {
      const x = line[0] // staged status
      const y = line[1] // unstaged status
      const file = line.slice(3)

      if (x === '?' && y === '?') {
        untracked.push(file)
      } else {
        if (x !== ' ' && x !== '?') staged.push(file)
        if (y !== ' ' && y !== '?') unstaged.push(file)
      }
    }

    return c.json({
      initialized: true,
      branch,
      clean: lines.length === 0,
      staged,
      unstaged,
      untracked,
      // Backwards compat
      modified: [...new Set([...staged, ...unstaged])],
    })
  } catch (err) {
    console.error('[git/status] error:', err)
    return c.json({ initialized: false })
  }
})

// POST /:id/git/commit - Commit changes
git.post(
  '/:id/git/commit',
  zValidator('param', idParam),
  zValidator('json', z.object({ message: z.string().min(1).max(500) })),
  async (c) => {
    const { id } = c.req.valid('param')
    const { message } = c.req.valid('json')
    const userId = c.get('user')!.id

    await getProjectWithAuth(id, c.get('user')!)

    const sandbox = await getSandboxByProjectId(id)
    if (!sandbox) return c.json({ error: 'Sandbox not running' }, 400)

    const cwd = workspacePath(id)

    try {
      const script = `
cd '${cwd}'
git add -A
git diff --cached --quiet && echo "NOTHING_TO_COMMIT" && exit 0
git commit -m '${message.replace(/'/g, "'\"'\"'")}'
echo "SHA:$(git rev-parse HEAD)"
`
      const res = await sandbox.exec(script, { cwd: '/', timeout: 30000 })

      if (res.output?.includes('NOTHING_TO_COMMIT')) {
        return c.json({ success: true, message: 'Nothing to commit' })
      }

      if (res.code !== 0) {
        return c.json({ success: false, error: res.output || 'Commit failed' }, 500)
      }

      const shaMatch = res.output?.match(/SHA:([a-f0-9]+)/)
      return c.json({ success: true, sha: shaMatch?.[1] })
    } catch (err) {
      console.error('[git/commit]', err)
      return c.json(
        { success: false, error: err instanceof Error ? err.message : 'Commit failed' },
        500,
      )
    }
  },
)

// POST /:id/git/push - Single call
git.post('/:id/git/push', zValidator('param', idParam), async (c) => {
  const { id } = c.req.valid('param')
  const userId = c.get('user')!.id

  const project = await getProjectWithAuth(id, c.get('user')!)

  const gh = project.github as ProjectGitHub | null
  if (!gh?.repoOwner) return c.json({ error: 'No GitHub repo connected' }, 400)

  const githubApp = createGitHubApp()
  if (!githubApp) return c.json({ error: 'GitHub not configured' }, 500)

  const sandbox = await getSandboxByProjectId(id)
  if (!sandbox) return c.json({ error: 'Sandbox not running' }, 400)

  const cwd = workspacePath(id)
  const branch = gh.defaultBranch || 'main'

  try {
    const { token } = await githubApp.getInstallationToken(gh.installationId)
    const authUrl = `https://x-access-token:${token}@github.com/${gh.repoOwner}/${gh.repoName}.git`
    const cleanUrl = `https://github.com/${gh.repoOwner}/${gh.repoName}.git`

    const script = `
cd '${cwd}'
# Ensure remote
git remote get-url origin >/dev/null 2>&1 || git remote add origin '${cleanUrl}'
# Set auth, push, clean
git remote set-url origin '${authUrl}'
git push origin ${branch} 2>&1
EXIT_CODE=$?
git remote set-url origin '${cleanUrl}'
if [ $EXIT_CODE -eq 0 ]; then
  echo "SHA:$(git rev-parse HEAD)"
fi
exit $EXIT_CODE
`

    const res = await sandbox.exec(script, { cwd: '/', timeout: 60000 })

    if (res.code !== 0) {
      const out = res.output || ''
      if (out.includes('non-fast-forward') || out.includes('rejected')) {
        return c.json(
          { success: false, error: 'Push rejected. Pull first or resolve conflicts.' },
          409,
        )
      }
      return c.json({ success: false, error: out || 'Push failed' }, 500)
    }

    const shaMatch = res.output?.match(/SHA:([a-f0-9]+)/)
    const sha = shaMatch?.[1]

    if (sha) {
      await db
        .updateTable('project')
        .set({
          github: { ...gh, lastPushedSha: sha, lastPushAt: new Date().toISOString() },
          updatedAt: new Date(),
        })
        .where('id', '=', id)
        .execute()
    }

    return c.json({ success: true, sha })
  } catch (err) {
    console.error('[git/push]', err)
    return c.json(
      { success: false, error: err instanceof Error ? err.message : 'Push failed' },
      500,
    )
  }
})

// POST /:id/git/pull - Single call
git.post('/:id/git/pull', zValidator('param', idParam), async (c) => {
  const { id } = c.req.valid('param')
  const userId = c.get('user')!.id

  const project = await getProjectWithAuth(id, c.get('user')!)

  const gh = project.github as ProjectGitHub | null
  if (!gh?.repoOwner) return c.json({ error: 'No GitHub repo connected' }, 400)

  const githubApp = createGitHubApp()
  if (!githubApp) return c.json({ error: 'GitHub not configured' }, 500)

  const sandbox = await getSandboxByProjectId(id)
  if (!sandbox) return c.json({ error: 'Sandbox not running' }, 400)

  const cwd = workspacePath(id)
  const branch = gh.defaultBranch || 'main'

  try {
    const { token } = await githubApp.getInstallationToken(gh.installationId)
    const authUrl = `https://x-access-token:${token}@github.com/${gh.repoOwner}/${gh.repoName}.git`
    const cleanUrl = `https://github.com/${gh.repoOwner}/${gh.repoName}.git`

    const script = `
cd '${cwd}'
git remote get-url origin >/dev/null 2>&1 || git remote add origin '${cleanUrl}'
git remote set-url origin '${authUrl}'
git pull origin ${branch} --ff-only 2>&1
EXIT_CODE=$?
git remote set-url origin '${cleanUrl}'
if [ $EXIT_CODE -eq 0 ]; then
  echo "SHA:$(git rev-parse HEAD)"
fi
exit $EXIT_CODE
`

    const res = await sandbox.exec(script, { cwd: '/', timeout: 60000 })

    if (res.code !== 0) {
      const out = res.output || ''
      if (out.includes('Not possible to fast-forward') || out.includes('divergent')) {
        return c.json(
          { success: false, error: 'Cannot fast-forward. Histories have diverged.' },
          409,
        )
      }
      return c.json({ success: false, error: out || 'Pull failed' }, 500)
    }

    const shaMatch = res.output?.match(/SHA:([a-f0-9]+)/)
    return c.json({ success: true, sha: shaMatch?.[1] })
  } catch (err) {
    console.error('[git/pull]', err)
    return c.json(
      { success: false, error: err instanceof Error ? err.message : 'Pull failed' },
      500,
    )
  }
})

export default git
