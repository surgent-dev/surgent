import { SurpayError } from '../errors.js'
import type { Result } from '../types.js'

/**
 * Converts a fetch Response into a Result container.
 *
 * - Success (2xx): { data: T, error: null, statusCode }
 * - Failure (non-2xx): { data: null, error: SurpayError, statusCode }
 */
export const toResult = async <T>(response: Response): Promise<Result<T, SurpayError>> => {
  const statusCode = response.status

  if (statusCode < 200 || statusCode >= 300) {
    let errorData: { message?: string; code?: string } = {}
    try {
      errorData = await response.json()
    } catch {
      // Failed to parse error body
    }

    return {
      data: null,
      error: new SurpayError({
        message: errorData?.message || `Request failed with status ${statusCode}`,
        code: errorData?.code || statusToCode(statusCode),
        statusCode,
      }),
      statusCode,
    }
  }

  // Handle 204 No Content
  if (statusCode === 204) {
    return { data: {} as T, error: null, statusCode }
  }

  // Parse successful response
  const text = await response.text()
  if (!text) {
    return { data: {} as T, error: null, statusCode }
  }

  const data = JSON.parse(text) as T
  return { data, error: null, statusCode }
}

const statusToCode = (status: number): string => {
  switch (status) {
    case 400:
      return 'bad_request'
    case 401:
      return 'unauthorized'
    case 403:
      return 'forbidden'
    case 404:
      return 'not_found'
    case 409:
      return 'conflict'
    case 422:
      return 'validation_error'
    case 429:
      return 'rate_limit_exceeded'
    case 500:
      return 'internal_error'
    default:
      return 'unknown_error'
  }
}
