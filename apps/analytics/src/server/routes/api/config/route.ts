import { parseRequest } from '@/lib/request'
import { json } from '@/lib/response'

export async function GET(request: Request) {
  const { error } = await parseRequest(request)

  if (error) {
    return error()
  }

  return json({
    privateMode: !!process.env.PRIVATE_MODE,
    trackerScriptName: process.env.TRACKER_SCRIPT_NAME,
  })
}
