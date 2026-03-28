import type { Hono } from 'hono'
import { withBasePath } from '../../paths'
import core from './core'
import links from './links'
import pixels from './pixels'
import realtime from './realtime'
import reports from './reports'
import websites from './websites'

export function registerApiRoutes(app: Hono, basePath = '') {
  app.route(withBasePath(basePath, '/api'), core)
  app.route(withBasePath(basePath, '/api/links'), links)
  app.route(withBasePath(basePath, '/api/pixels'), pixels)
  app.route(withBasePath(basePath, '/api/realtime'), realtime)
  app.route(withBasePath(basePath, '/api/reports'), reports)
  app.route(withBasePath(basePath, '/api/websites'), websites)
}
