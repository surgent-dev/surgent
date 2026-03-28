import path from 'node:path'
import type { Hono } from 'hono'
import type { Link, Pixel } from '@/generated/prisma/client'
import { notFound } from '@/lib/response'
import redis from '@/lib/redis'
import { findLink, findPixel } from '@/queries/prisma'
import * as send from '@/server/routes/api/send/route'
import { normalizePath, withBasePath } from './paths'

const pixelImage = Buffer.from(
  'R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw',
  'base64',
)
const projectDir = path.resolve(import.meta.dir, '../..')

function getProjectFile(file: string) {
  return Bun.file(path.resolve(projectDir, file))
}

export function getConfiguredTrackerPaths() {
  const trackerPaths = new Set<string>(['/script.js'])
  const trackerScriptName = process.env.TRACKER_SCRIPT_NAME

  if (!trackerScriptName) {
    return trackerPaths
  }

  for (const name of trackerScriptName
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)) {
    trackerPaths.add(normalizePath(name))
  }

  return trackerPaths
}

export function getConfiguredCollectPath() {
  const collectApiEndpoint = process.env.COLLECT_API_ENDPOINT

  return collectApiEndpoint ? normalizePath(collectApiEndpoint) : null
}

async function getTrackerResponse() {
  const trackerScriptUrl = process.env.TRACKER_SCRIPT_URL
  const collectPath = getConfiguredCollectPath()

  if (trackerScriptUrl) {
    const upstreamResponse = await fetch(trackerScriptUrl)

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: upstreamResponse.headers,
    })
  }

  const trackerFile = getProjectFile('public/script.js')

  if (!(await trackerFile.exists())) {
    return notFound()
  }

  let trackerScript = await trackerFile.text()

  if (collectPath && collectPath !== '/api/send') {
    trackerScript = trackerScript.replace(/\/api\/send/g, collectPath)
  }

  return new Response(trackerScript, {
    headers: {
      'Content-Type': trackerFile.type || 'application/javascript; charset=utf-8',
    },
  })
}

async function getRobotsResponse() {
  const robotsFile = getProjectFile('public/robots.txt')

  if (!(await robotsFile.exists())) {
    return notFound()
  }

  return new Response(robotsFile, {
    headers: {
      'Content-Type': robotsFile.type || 'text/plain; charset=utf-8',
    },
  })
}

async function getPixelBySlug(slug: string) {
  if (redis.enabled) {
    return (await redis.client.fetch(
      `pixel:${slug}`,
      () =>
        findPixel({
          where: {
            slug,
          },
        }),
      86400,
    )) as Pixel | null
  }

  return (await findPixel({
    where: {
      slug,
    },
  })) as Pixel | null
}

async function getLinkBySlug(slug: string) {
  if (redis.enabled) {
    return (await redis.client.fetch(
      `link:${slug}`,
      () =>
        findLink({
          where: {
            slug,
          },
        }),
      86400,
    )) as Link | null
  }

  return (await findLink({
    where: {
      slug,
    },
  })) as Link | null
}

export function registerPublicRoutes(app: Hono, basePath = '') {
  app.get(withBasePath(basePath, '/'), (c) => c.text('Surgent Analytics Backend'))
  app.get(withBasePath(basePath, '/robots.txt'), () => getRobotsResponse())

  for (const trackerPath of getConfiguredTrackerPaths()) {
    app.get(withBasePath(basePath, trackerPath), () => getTrackerResponse())
  }

  app.get(withBasePath(basePath, '/p/:slug'), async (c) => {
    const pixel = await getPixelBySlug(c.req.param('slug'))

    if (!pixel) {
      return notFound()
    }

    const payload = {
      type: 'event',
      payload: {
        pixel: pixel.id,
        url: c.req.url,
        referrer: c.req.header('referer'),
      },
    }

    await send.POST(
      new Request(c.req.url, {
        method: 'POST',
        headers: c.req.raw.headers,
        body: JSON.stringify(payload),
      }),
    )

    return new Response(pixelImage, {
      headers: {
        'Content-Type': 'image/gif',
        'Content-Length': pixelImage.length.toString(),
      },
    })
  })

  app.get(withBasePath(basePath, '/q/:slug'), async (c) => {
    const link = await getLinkBySlug(c.req.param('slug'))

    if (!link) {
      return notFound()
    }

    const payload = {
      type: 'event',
      payload: {
        link: link.id,
        url: c.req.url,
        referrer: c.req.header('referer'),
      },
    }

    await send.POST(
      new Request(c.req.url, {
        method: 'POST',
        headers: c.req.raw.headers,
        body: JSON.stringify(payload),
      }),
    )

    return c.redirect(link.url)
  })
}
