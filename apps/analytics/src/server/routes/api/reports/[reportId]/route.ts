import { z } from 'zod'
import { parseRequest } from '@/lib/request'
import { json, notFound, ok } from '@/lib/response'
import { reportSchema } from '@/lib/schema'
import { deleteReport, getReport, resolveReportOwnership, updateReport } from '@/queries/prisma'

const updateReportSchema = reportSchema.extend({
  externalProjectId: z.uuid().nullable().optional(),
  externalOrgId: z.uuid().nullable().optional(),
  externalUserId: z.uuid().nullable().optional(),
})

export async function GET(request: Request, { params }: { params: Promise<{ reportId: string }> }) {
  const { error } = await parseRequest(request)

  if (error) {
    return error()
  }

  const { reportId } = await params
  const report = await getReport(reportId)

  if (!report) {
    return notFound()
  }

  return json(report)
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ reportId: string }> },
) {
  const { body, error } = await parseRequest(request, updateReportSchema)

  if (error) {
    return error()
  }

  const { reportId } = await params
  const {
    websiteId,
    type,
    name,
    description,
    parameters,
    externalProjectId,
    externalOrgId,
    externalUserId,
  } = body
  const report = await getReport(reportId)

  if (!report) {
    return notFound()
  }

  const ownership = await resolveReportOwnership(websiteId, {
    externalProjectId,
    externalOrgId,
    externalUserId,
  })

  if (!ownership) {
    return notFound()
  }

  const result = await updateReport(reportId, {
    websiteId,
    externalProjectId: ownership.externalProjectId,
    externalOrgId: ownership.externalOrgId,
    externalUserId: ownership.externalUserId,
    type,
    name,
    description,
    parameters,
  } as any)

  return json(result)
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ reportId: string }> },
) {
  const { error } = await parseRequest(request)

  if (error) {
    return error()
  }

  const { reportId } = await params
  const report = await getReport(reportId)

  if (!report) {
    return notFound()
  }

  await deleteReport(reportId)

  return ok()
}
