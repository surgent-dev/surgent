import type { Context, Hono } from 'hono'

type RouteParams = Record<string, string>

type LegacyHandler<TParams extends RouteParams = RouteParams> = (
  request: Request,
  context?: { params: Promise<TParams> },
) => Response | Promise<Response>

/**
 * Bridge a legacy route handler to a Hono route.
 * Passes c.req.raw as the Request and wraps c.req.param() as a Promise for params.
 */
function adapt<TParams extends RouteParams>(handler: LegacyHandler<TParams>) {
  return (c: Context) => handler(c.req.raw, { params: Promise.resolve(c.req.param() as TParams) })
}

/**
 * Mount a legacy route module's exported GET/POST/PUT/DELETE handlers onto a Hono app at a path.
 */
export function mount<TParams extends RouteParams = RouteParams>(
  app: Hono,
  path: string,
  mod: {
    GET?: LegacyHandler<TParams>
    POST?: LegacyHandler<TParams>
    PUT?: LegacyHandler<TParams>
    DELETE?: LegacyHandler<TParams>
  },
) {
  if (mod.GET) app.get(path, adapt(mod.GET))
  if (mod.POST) app.post(path, adapt(mod.POST))
  if (mod.PUT) app.put(path, adapt(mod.PUT))
  if (mod.DELETE) app.delete(path, adapt(mod.DELETE))
}
