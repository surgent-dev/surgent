import { Hono } from 'hono'
import * as reports from './reports/route'
import * as reportById from './reports/[reportId]/route'
import * as attribution from './reports/attribution/route'
import * as breakdown from './reports/breakdown/route'
import * as funnel from './reports/funnel/route'
import * as goal from './reports/goal/route'
import * as journey from './reports/journey/route'
import * as retention from './reports/retention/route'
import * as revenue from './reports/revenue/route'
import * as utm from './reports/utm/route'
import { mount } from '../mount'

const app = new Hono()

// Static paths before parameterized
mount(app, '/attribution', attribution)
mount(app, '/breakdown', breakdown)
mount(app, '/funnel', funnel)
mount(app, '/goal', goal)
mount(app, '/journey', journey)
mount(app, '/retention', retention)
mount(app, '/revenue', revenue)
mount(app, '/utm', utm)
mount(app, '/', reports)
mount(app, '/:reportId', reportById)

export default app
