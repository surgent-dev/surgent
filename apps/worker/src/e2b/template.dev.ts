import { Template, waitForTimeout } from 'e2b'

const token = process.env.GITHUB_TOKEN
const repoUrl = token
  ? `https://${token}@github.com/surgent-dev/surgent.git`
  : 'https://github.com/surgent-dev/surgent.git'

export const devTemplate = Template()
  .fromNodeImage('lts-slim')
  .setUser('root')
  .runCmd([
    'apt-get update',
    'apt-get install -y --no-install-recommends git ca-certificates curl jq unzip ripgrep fd-find postgresql postgresql-contrib',
    'apt-get clean',
    'rm -rf /var/lib/apt/lists/*',
  ])
  .runCmd(
    'service postgresql start && su - postgres -c "psql -c \\"CREATE USER devuser WITH SUPERUSER PASSWORD \'devpass\';\\"" && su - postgres -c "createdb -O devuser devdb" && service postgresql stop',
  )
  .runCmd('ln -s $(which fdfind) /usr/local/bin/fd')
  .runCmd('curl -fsSL https://bun.sh/install | bash')
  .setEnvs({
    BUN_INSTALL: '/root/.bun',
    PATH: '/root/.bun/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
    DATABASE_URL: 'postgresql://devuser:devpass@localhost:5432/devdb',
  })
  .runCmd('/root/.bun/bin/bun add -g @ast-grep/cli @anthropic-ai/claude-code opencode-ai pm2')
  .runCmd('git config --global user.name "Surgent Dev" && git config --global user.email "bot@surgent.dev"')
  .runCmd(`git clone --depth 1 ${repoUrl} /home/user/surgent`)
  .runCmd('cd /home/user/surgent && /root/.bun/bin/bun install')
  .setWorkdir('/home/user/surgent')
  .setStartCmd('service postgresql start && sleep infinity', waitForTimeout(5000))
