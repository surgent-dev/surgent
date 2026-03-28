import { Hono } from 'hono'
import * as realtime from './realtime/[websiteId]/route'
import { mount } from '../mount'

const app = new Hono()

mount(app, '/:websiteId', realtime)

export default app
