/* eslint-disable no-console */
import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import https from 'node:https'
import { pipeline } from 'node:stream/promises'
import * as tar from 'tar'
import zlib from 'node:zlib'

if (process.env.VERCEL && !process.env.BUILD_GEO) {
  console.log('Vercel environment detected. Skipping geo setup.')
  process.exit(0)
}

const db = 'GeoLite2-City'

let url = process.env.GEO_DATABASE_URL

if (!url && process.env.MAXMIND_LICENSE_KEY) {
  url =
    `https://download.maxmind.com/app/geoip_download` +
    `?edition_id=${db}&license_key=${process.env.MAXMIND_LICENSE_KEY}&suffix=tar.gz`
}

if (!url) {
  if (process.env.REQUIRE_GEO_DATABASE === '1' || process.env.NODE_ENV === 'production') {
    console.error('GeoLite2 source is required. Set GEO_DATABASE_URL or MAXMIND_LICENSE_KEY.')
    process.exit(1)
  }

  console.log('No GeoLite2 source configured. Skipping geo setup.')
  process.exit(0)
}

const dest = path.resolve(process.cwd(), 'geo')

if (!fs.existsSync(dest)) {
  fs.mkdirSync(dest)
}

const isDirectMmdb = url.endsWith('.mmdb')

const downloadCompressed = (url) =>
  new Promise((resolve, reject) => {
    const request = https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Geo database download failed with status ${res.statusCode}`))
        res.resume()
        return
      }

      const writes = []
      let saved = ''
      const extractor = tar.t()

      extractor.on('entry', (entry) => {
        if (!entry.path.endsWith('.mmdb')) {
          entry.resume()
          return
        }

        saved = path.join(dest, path.basename(entry.path))
        writes.push(pipeline(entry, fs.createWriteStream(saved)))
      })

      extractor.on('error', reject)
      extractor.on('finish', async () => {
        try {
          await Promise.all(writes)
          if (!saved) throw new Error('Geo archive did not contain an .mmdb file')
          console.log('Saved geo database:', saved)
          resolve()
        } catch (error) {
          reject(error)
        }
      })

      res.pipe(zlib.createGunzip()).on('error', reject).pipe(extractor)
    })
    request.on('error', reject)
  })

const downloadDirect = (url, originalUrl) =>
  new Promise((resolve, reject) => {
    const request = https.get(url, async (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        if (!res.headers.location) {
          reject(new Error('Geo database redirect missing location header'))
          return
        }
        downloadDirect(res.headers.location, originalUrl || url)
          .then(resolve)
          .catch(reject)
        return
      }

      if (res.statusCode !== 200) {
        reject(new Error(`Geo database download failed with status ${res.statusCode}`))
        res.resume()
        return
      }

      const filename = path.join(dest, path.basename(originalUrl || url))
      try {
        await pipeline(res, fs.createWriteStream(filename))
        console.log('Saved geo database:', filename)
        resolve()
      } catch (error) {
        reject(error)
      }
    })
    request.on('error', reject)
  })

const download = isDirectMmdb ? downloadDirect(url) : downloadCompressed(url)

download.catch((e) => {
  console.error('Failed to download geo database:', e)
  process.exit(1)
})
