import { Hono } from 'hono'
import * as pixels from './pixels/route'
import * as pixelById from './pixels/[pixelId]/route'
import { mount } from '../mount'

const app = new Hono()

mount(app, '/', pixels)
mount(app, '/:pixelId', pixelById)

export default app
