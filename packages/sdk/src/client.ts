/**
 * Base HTTP client for Surpay SDK.
 *
 * Provides core HTTP methods with Result pattern error handling.
 */

import { toResult } from './utils/result.js'
import { SurpayError } from './errors.js'
import type { Result } from './types.js'

const DEFAULT_BASE_URL = 'https://api.surgent.dev'

export class SurpayClient {
  protected readonly baseUrl: string
  protected readonly headers: Record<string, string>

  constructor(options: { apiKey: string; baseUrl?: string }) {
    this.baseUrl = options.baseUrl || DEFAULT_BASE_URL
    this.headers = {
      Authorization: `Bearer ${options.apiKey}`,
      'Content-Type': 'application/json',
    }
  }

  protected async get<T>(path: string): Promise<Result<T, SurpayError>> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: this.headers,
    })
    return toResult<T>(response)
  }

  protected async post<T>(path: string, body?: unknown): Promise<Result<T, SurpayError>> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: this.headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    return toResult<T>(response)
  }

  protected async put<T>(path: string, body: unknown): Promise<Result<T, SurpayError>> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'PUT',
      headers: this.headers,
      body: JSON.stringify(body),
    })
    return toResult<T>(response)
  }

  protected async delete<T>(path: string): Promise<Result<T, SurpayError>> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'DELETE',
      headers: this.headers,
    })
    return toResult<T>(response)
  }
}
