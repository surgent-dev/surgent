import { Hono } from 'hono'
import * as batch from './batch/route'
import * as config from './config/route'
import * as heartbeat from './heartbeat/route'
import * as send from './send/route'
import { mount } from '../mount'

const app = new Hono()

mount(app, '/batch', batch)
mount(app, '/config', config)
mount(app, '/heartbeat', heartbeat)
mount(app, '/send', send)

export default app
