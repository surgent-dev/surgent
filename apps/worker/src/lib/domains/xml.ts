/**
 * Thin wrapper around fast-xml-parser for Namecheap API responses.
 *
 * Every Namecheap response has the shape:
 *   <ApiResponse Status="OK|ERROR">
 *     <Errors/>
 *     <CommandResponse>…</CommandResponse>
 *   </ApiResponse>
 *
 * This helper parses the XML, extracts the CommandResponse, and throws on API
 * errors so callers never have to deal with raw XML.
 */

import { XMLParser } from 'fast-xml-parser'

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  // Ensure single-element responses are still arrays where needed
  isArray: (_name, jpath) => {
    const arrayPaths = [
      'ApiResponse.CommandResponse.DomainCheckResult',
      'ApiResponse.CommandResponse.UserGetPricingResult.ProductType.ProductCategory',
      'ApiResponse.CommandResponse.UserGetPricingResult.ProductType.ProductCategory.Product',
      'ApiResponse.CommandResponse.UserGetPricingResult.ProductType.ProductCategory.Product.Price',
      'ApiResponse.Errors.Error',
    ]
    return arrayPaths.includes(jpath)
  },
})

export interface NamecheapApiResponse {
  ApiResponse: {
    '@_Status': 'OK' | 'ERROR'
    Errors?: { Error?: Array<{ '#text': string; '@_Number': string }> }
    CommandResponse: Record<string, unknown>
  }
}

export class NamecheapApiError extends Error {
  constructor(public errors: Array<{ code: string; message: string }>) {
    const msg = errors.map((e) => `[${e.code}] ${e.message}`).join('; ')
    super(`Namecheap API error: ${msg}`)
    this.name = 'NamecheapApiError'
  }
}

/**
 * Parse raw XML from a Namecheap API response.
 * Returns the `CommandResponse` object on success or throws on API-level errors.
 */
export function parseNamecheapResponse(xml: string): Record<string, unknown> {
  const parsed = parser.parse(xml) as NamecheapApiResponse
  const root = parsed.ApiResponse

  if (!root) {
    throw new Error('Invalid Namecheap response: missing ApiResponse root')
  }

  if (root['@_Status'] === 'ERROR') {
    const errors = (root.Errors?.Error ?? []).map((e) => ({
      code: e['@_Number'],
      message: e['#text'],
    }))
    throw new NamecheapApiError(
      errors.length ? errors : [{ code: 'UNKNOWN', message: 'Unknown Namecheap API error' }],
    )
  }

  return root.CommandResponse
}
