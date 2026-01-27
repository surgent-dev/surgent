#!/usr/bin/env bun
/**
 * Cloudflare Tunnel script for local development
 * Exposes worker, gateway, and pay services with public URLs
 * Auto-injects URLs into .env files
 */

interface EnvInjection {
  key: string
  file: string
  suffix?: string
}

interface TunnelConfig {
  name: string
  port: number
  envInjections: EnvInjection[]
}

const TUNNELS: TunnelConfig[] = [
  {
    name: 'worker',
    port: 4000,
    envInjections: [
      { key: 'SURGENT_BASE_URL', file: 'apps/worker/.env.local' },
      { key: 'OPENCODE_BASE_URL', file: 'apps/worker/.env.local', suffix: '/zen/v1' },
    ],
  },
]

async function checkCloudflared(): Promise<boolean> {
  const proc = Bun.spawn(['which', 'cloudflared'], { stdout: 'pipe', stderr: 'pipe' })
  await proc.exited
  return proc.exitCode === 0
}

async function startTunnel(config: TunnelConfig): Promise<{ url: string; proc: ReturnType<typeof Bun.spawn> } | null> {
  console.log(`🚇 Starting tunnel for ${config.name} on port ${config.port}...`)

  const proc = Bun.spawn(['cloudflared', 'tunnel', '--url', `http://localhost:${config.port}`], {
    stdout: 'pipe',
    stderr: 'pipe',
  })

  // cloudflared outputs the URL to stderr
  const reader = proc.stderr.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  const timeout = setTimeout(() => {
    console.error(`⏰ Timeout waiting for ${config.name} tunnel URL`)
  }, 30000)

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    // Look for the trycloudflare.com URL
    const match = buffer.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/)
    if (match) {
      clearTimeout(timeout)
      reader.releaseLock()
      console.log(`✅ ${config.name}: ${match[0]}`)
      return { url: match[0], proc }
    }
  }

  clearTimeout(timeout)
  return null
}

async function updateEnvFile(filepath: string, key: string, value: string) {
  const file = Bun.file(filepath)
  let content = ''

  if (await file.exists()) {
    content = await file.text()
  }

  const lines = content.split('\n')
  let found = false

  const updated = lines.map((line) => {
    if (line.startsWith(`${key}=`)) {
      found = true
      return `${key}=${value}`
    }
    return line
  })

  if (!found) {
    updated.push(`${key}=${value}`)
  }

  await Bun.write(filepath, updated.join('\n'))
  console.log(`📝 Updated ${filepath}: ${key}=${value}`)
}

async function main() {
  console.log('🔌 Surgent Tunnel Manager\n')

  // Check if cloudflared is installed
  const hasCloudflared = await checkCloudflared()
  if (!hasCloudflared) {
    console.error('❌ cloudflared not found!')
    console.error('\nInstall it with:')
    console.error('  brew install cloudflared     # macOS')
    console.error('  sudo apt install cloudflared # Ubuntu/Debian')
    console.error('  winget install Cloudflare.cloudflared # Windows')
    console.error(
      '\nOr download from: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/',
    )
    process.exit(1)
  }

  // Parse args to filter which tunnels to start
  const args = process.argv.slice(2)
  const selectedTunnels = args.length > 0 ? TUNNELS.filter((t) => args.includes(t.name)) : TUNNELS

  if (selectedTunnels.length === 0) {
    console.error(`❌ No matching tunnels found. Available: ${TUNNELS.map((t) => t.name).join(', ')}`)
    process.exit(1)
  }

  console.log(`Starting tunnels: ${selectedTunnels.map((t) => t.name).join(', ')}\n`)

  const results: Array<{ config: TunnelConfig; url: string; proc: ReturnType<typeof Bun.spawn> }> = []

  // Start tunnels in parallel
  const tunnelPromises = selectedTunnels.map(async (config) => {
    const result = await startTunnel(config)
    if (result) {
      results.push({ config, ...result })

      // Update env files
      for (const injection of config.envInjections) {
        const value = result.url + (injection.suffix || '')
        await updateEnvFile(injection.file, injection.key, value)
      }
    }
  })

  await Promise.all(tunnelPromises)

  if (results.length === 0) {
    console.error('❌ No tunnels started successfully')
    process.exit(1)
  }

  console.log('\n🎉 Tunnels are running! Press Ctrl+C to stop.\n')
  console.log('Public URLs:')
  results.forEach(({ config, url }) => {
    console.log(`  ${config.name.padEnd(10)} → ${url}`)
  })
  console.log('')

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down tunnels...')
    results.forEach(({ config, proc }) => {
      proc.kill()
      console.log(`  Stopped ${config.name}`)
    })
    process.exit(0)
  })

  // Keep process alive
  await new Promise(() => {})
}

main().catch(console.error)
