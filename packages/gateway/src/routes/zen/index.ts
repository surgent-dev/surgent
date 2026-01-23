import { Hono } from 'hono'
import type { AppContext } from '../../types'
import { handleChatCompletions } from './v1/chat/completions'
import { handleMessages } from './v1/messages'
import { handleResponses } from './v1/responses'
import { handleGoogleModel } from './v1/models/[model]'
import { handleModelsList, handleModelsOptions } from './v1/models'

const zen = new Hono<AppContext>()

zen.post('/v1/chat/completions', handleChatCompletions)
zen.post('/v1/messages', handleMessages)
zen.post('/v1/responses', handleResponses)
zen.post('/v1/models/:model', handleGoogleModel)
zen.get('/v1/models', handleModelsList)
zen.options('/v1/models', handleModelsOptions)

export default zen
