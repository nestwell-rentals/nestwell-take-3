import type { PayloadRequest } from 'payload'

import { getIssuer } from './urls'

/**
 * Request and response helpers shared by the OAuth endpoints and discovery documents.
 *
 * Token-style endpoints are called by other servers and by browser-based clients such as the
 * MCP Inspector, so they answer with permissive CORS; they never rely on cookies. Browser-facing
 * endpoints (consent, revocation from the admin) do the opposite and insist on same-origin.
 */

export const publicCORSHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, MCP-Protocol-Version',
  'Access-Control-Max-Age': '86400',
}

const noStoreHeaders: Record<string, string> = {
  'Cache-Control': 'no-store',
  Pragma: 'no-cache',
}

export const oauthJSON = (
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response =>
  Response.json(body, { status, headers: { ...publicCORSHeaders, ...noStoreHeaders, ...headers } })

/** RFC 6749 §5.2 error body */
export const oauthError = (
  error: string,
  description: string,
  status = 400,
  headers: Record<string, string> = {},
): Response => oauthJSON({ error, error_description: description }, status, headers)

export const preflight = (): Response => new Response(null, { status: 204, headers: publicCORSHeaders })

export const rateLimited = (retryAfterSeconds: number): Response =>
  oauthError('too_many_requests', 'Too many requests. Try again later.', 429, {
    'Retry-After': String(retryAfterSeconds),
  })

/** 303 so a POSTed form never gets re-posted to the client's redirect URI */
export const seeOther = (location: string): Response =>
  new Response(null, { status: 303, headers: { Location: location, ...noStoreHeaders } })

/**
 * Discovery documents are public and change only with NEXT_PUBLIC_SERVER_URL. Browser-based MCP
 * clients fetch them cross-origin with an `MCP-Protocol-Version` header, which needs a preflight.
 */
export const metadataResponse = (document: Record<string, unknown>): Response =>
  Response.json(document, {
    headers: {
      ...publicCORSHeaders,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Cache-Control': 'public, max-age=300',
    },
  })

export const metadataPreflight = (): Response =>
  new Response(null, {
    status: 204,
    headers: { ...publicCORSHeaders, 'Access-Control-Allow-Methods': 'GET, OPTIONS' },
  })

/** The raw request body. Payload types the body readers as optional, so guard the call. */
export const readBodyText = async (req: PayloadRequest): Promise<string> =>
  typeof req.text === 'function' ? req.text() : ''

/**
 * Reads `application/x-www-form-urlencoded` (what OAuth specifies) or JSON bodies into one
 * shape. Returns null when the body cannot be parsed.
 */
export const readParams = async (req: PayloadRequest): Promise<null | URLSearchParams> => {
  const contentType = req.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? ''
  try {
    const text = await readBodyText(req)
    if (contentType === 'application/json') {
      const parsed: unknown = JSON.parse(text)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
      const params = new URLSearchParams()
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === 'string') params.set(key, value)
        else if (typeof value === 'number' || typeof value === 'boolean') params.set(key, String(value))
      }
      return params
    }
    return new URLSearchParams(text)
  } catch {
    return null
  }
}

/**
 * Browser-facing endpoints only accept requests that the browser marks as coming from this site.
 * Payload's cookie handling allows any Origin when `serverURL` is unset, so this is checked here.
 */
export const isSameOriginRequest = (req: PayloadRequest): boolean => {
  const origin = req.headers.get('origin')
  if (origin && origin !== getIssuer()) return false
  const site = req.headers.get('sec-fetch-site')
  if (site && site !== 'same-origin' && site !== 'none') return false
  return true
}

/**
 * A small fixed-window rate limiter for the registration and token endpoints. State lives in
 * process memory, which fits the single Railway instance this template deploys to; several
 * replicas multiply the effective limit. Move the counters to Postgres or Redis if that matters.
 */
type Bucket = { count: number; resetAt: number }
type Limit = { limit: number; windowMs: number }

const buckets = new Map<string, Bucket>()
const MAX_BUCKETS = 10_000
let lastPrune = 0

const prune = (now: number) => {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
  // A flood of distinct keys must not grow memory without bound
  if (buckets.size > MAX_BUCKETS) buckets.clear()
}

export const checkRateLimit = (
  key: string,
  { limit, windowMs }: Limit,
  now = Date.now(),
): { allowed: boolean; retryAfterSeconds: number } => {
  if (now - lastPrune > 60_000) {
    prune(now)
    lastPrune = now
  }

  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, retryAfterSeconds: 0 }
  }

  bucket.count += 1
  if (bucket.count > limit) {
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) }
  }
  return { allowed: true, retryAfterSeconds: 0 }
}

/** The caller's address as seen through Railway's proxy, or "unknown" */
export const getClientIP = (headers: Headers): string => {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || headers.get('x-real-ip')?.trim() || 'unknown'
}
