import { Hono } from 'hono'
import * as links from './links/route'
import * as linkById from './links/[linkId]/route'
import { mount } from '../mount'

const app = new Hono()

mount(app, '/', links)
mount(app, '/:linkId', linkById)

export default app
