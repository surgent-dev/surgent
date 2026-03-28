import { Hono } from 'hono'
import * as websites from './websites/route'
import * as websiteById from './websites/[websiteId]/route'
import * as active from './websites/[websiteId]/active/route'
import * as daterange from './websites/[websiteId]/daterange/route'
import * as eventDataEvents from './websites/[websiteId]/event-data/events/route'
import * as eventDataFields from './websites/[websiteId]/event-data/fields/route'
import * as eventDataProperties from './websites/[websiteId]/event-data/properties/route'
import * as eventDataStats from './websites/[websiteId]/event-data/stats/route'
import * as eventDataValues from './websites/[websiteId]/event-data/values/route'
import * as eventDataById from './websites/[websiteId]/event-data/[eventId]/route'
import * as events from './websites/[websiteId]/events/route'
import * as eventSeries from './websites/[websiteId]/events/series/route'
import * as exportData from './websites/[websiteId]/export/route'
import * as expandedMetrics from './websites/[websiteId]/metrics/expanded/route'
import * as metrics from './websites/[websiteId]/metrics/route'
import * as pageviews from './websites/[websiteId]/pageviews/route'
import * as websiteReports from './websites/[websiteId]/reports/route'
import * as reset from './websites/[websiteId]/reset/route'
import * as segments from './websites/[websiteId]/segments/route'
import * as segmentById from './websites/[websiteId]/segments/[segmentId]/route'
import * as sessionDataProperties from './websites/[websiteId]/session-data/properties/route'
import * as sessionDataValues from './websites/[websiteId]/session-data/values/route'
import * as sessions from './websites/[websiteId]/sessions/route'
import * as sessionStats from './websites/[websiteId]/sessions/stats/route'
import * as sessionWeekly from './websites/[websiteId]/sessions/weekly/route'
import * as sessionById from './websites/[websiteId]/sessions/[sessionId]/route'
import * as sessionActivity from './websites/[websiteId]/sessions/[sessionId]/activity/route'
import * as sessionProperties from './websites/[websiteId]/sessions/[sessionId]/properties/route'
import * as stats from './websites/[websiteId]/stats/route'
import * as values from './websites/[websiteId]/values/route'
import { mount } from '../mount'

const app = new Hono()

// Collection root
mount(app, '/', websites)

// Static sub-paths on :websiteId (before the catch-all param route)
mount(app, '/:websiteId/active', active)
mount(app, '/:websiteId/daterange', daterange)
mount(app, '/:websiteId/export', exportData)
mount(app, '/:websiteId/pageviews', pageviews)
mount(app, '/:websiteId/reports', websiteReports)
mount(app, '/:websiteId/reset', reset)
mount(app, '/:websiteId/stats', stats)
mount(app, '/:websiteId/values', values)

// Events
mount(app, '/:websiteId/events/series', eventSeries)
mount(app, '/:websiteId/events', events)

// Event data — static paths before :eventId
mount(app, '/:websiteId/event-data/events', eventDataEvents)
mount(app, '/:websiteId/event-data/fields', eventDataFields)
mount(app, '/:websiteId/event-data/properties', eventDataProperties)
mount(app, '/:websiteId/event-data/stats', eventDataStats)
mount(app, '/:websiteId/event-data/values', eventDataValues)
mount(app, '/:websiteId/event-data/:eventId', eventDataById)

// Metrics
mount(app, '/:websiteId/metrics/expanded', expandedMetrics)
mount(app, '/:websiteId/metrics', metrics)

// Segments — static before :segmentId
mount(app, '/:websiteId/segments', segments)
mount(app, '/:websiteId/segments/:segmentId', segmentById)

// Session data
mount(app, '/:websiteId/session-data/properties', sessionDataProperties)
mount(app, '/:websiteId/session-data/values', sessionDataValues)

// Sessions — static paths before :sessionId
mount(app, '/:websiteId/sessions/stats', sessionStats)
mount(app, '/:websiteId/sessions/weekly', sessionWeekly)
mount(app, '/:websiteId/sessions', sessions)
mount(app, '/:websiteId/sessions/:sessionId/activity', sessionActivity)
mount(app, '/:websiteId/sessions/:sessionId/properties', sessionProperties)
mount(app, '/:websiteId/sessions/:sessionId', sessionById)

// Catch-all website by ID (must be last)
mount(app, '/:websiteId', websiteById)

export default app
