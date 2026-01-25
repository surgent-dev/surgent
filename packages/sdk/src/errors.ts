/**
 * Surpay SDK Error Types
 *
 * Follows the Autumn pattern: structured errors with code, message, statusCode.
 */

export class SurpayError extends Error {
  readonly code: string
  readonly statusCode: number

  constructor({ message, code, statusCode = 400 }: { message: string; code: string; statusCode?: number }) {
    super(message)
    this.name = 'SurpayError'
    this.code = code
    this.statusCode = statusCode

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SurpayError)
    }
  }

  toString(): string {
    return `SurpayError: ${this.message} (code: ${this.code}, status: ${this.statusCode})`
  }
}

export const isSurpayError = (error: unknown): error is SurpayError => {
  return error instanceof SurpayError
}
