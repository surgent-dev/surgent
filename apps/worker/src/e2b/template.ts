import { Template, waitForTimeout } from "e2b"

export const templateName = "surgent-sandbox"

export const template = Template()
  .fromNodeImage("lts-slim")
  .setUser("root")
  .runCmd([
    "apt-get update",
    "apt-get install -y --no-install-recommends git ca-certificates curl jq unzip ripgrep fd-find",
    "apt-get clean",
    "rm -rf /var/lib/apt/lists/*",
  ])
  .runCmd("ln -s $(which fdfind) /usr/local/bin/fd")
  .runCmd("curl -fsSL https://bun.sh/install | bash")
  .setEnvs({
    BUN_INSTALL: "/root/.bun",
    PATH: "/root/.bun/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
  })
  .runCmd("/root/.bun/bin/bun add -g @ast-grep/cli @anthropic-ai/claude-code pm2")
  .runCmd([
    'git config --global user.name "Surgent Dev"',
    'git config --global user.email "bot@surgent.dev"',
  ])
  .runCmd("mkdir -p /home/user/workspace")
  .setWorkdir("/home/user/workspace")
  .setStartCmd("sleep infinity", waitForTimeout(100))
