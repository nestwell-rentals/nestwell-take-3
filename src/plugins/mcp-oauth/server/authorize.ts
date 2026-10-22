import type { Payload } from 'payload'

import type { OauthClient } from '@/payload-types'

import { getClientRedirectUris, resolveClient } from './clients'
import {
  AUTHORIZATION_CODE_LIFETIME,
  CONSENT_REQUEST_LIFETIME,
  MAX_SCOPE_LENGTH,
  MAX_STATE_LENGTH,
} from './constants'
import { isValidCodeChallenge, randomToken, sha256, signPayload, verifyPayload } from './crypto'
import { redirectUriMatches } from './redirectUris'
import { getIssuer, getMCPResourceURL, isThisMCPResource, oauthPaths } from './urls'

/** A validated authorization request, as shown on the consent page and signed into its form */
export type AuthorizationRequest = {
  clientId: string
  codeChallenge: string
  codeChallengeMethod: 'S256'
  redirectUri: string
  resource: string
  scope?: string
  state?: string
}

export type SearchParams = Record<string, string | string[] | undefined>

export type ParsedAuthorizationRequest =
  /** The client or redirect URI is bad: show an error, never redirect (OAuth 2.1 §4.1.2.1) */
  | { description: string; error: string; kind: 'invalid' }
  /** Something else is wrong: tell the client through its registered redirect URI */
  | { kind: 'redirect'; url: string }
  | { client: OauthClient; kind: 'ok'; request: AuthorizationRequest }

/**
 * Appends response parameters to a registered redirect URI, keeping any query the client
 * registered, and adds `iss` so clients can detect mix-up attacks (RFC 9207).
 */
export const buildRedirectURL = (
  redirectUri: string,
  params: Record<string, string | undefined>,
): string => {
  const url = new URL(redirectUri)
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, value)
  }
  url.searchParams.set('iss', getIssuer())
  return url.toString()
}

// Scope tokens are printable ASCII without quotes or backslashes (RFC 6749 §3.3)
const cleanScope = (value: string): string =>
  value
    .replace(/[^\x21\x23-\x5b\x5d-\x7e ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

export const parseAuthorizationRequest = async ({
  params,
  payload,
}: {
  params: SearchParams
  payload: Payload
}): Promise<ParsedAuthorizationRequest> => {
  const duplicates: string[] = []
  const read = (key: string): string | undefined => {
    const value = params[key]
    if (Array.isArray(value)) {
      duplicates.push(key)
      return value[0]
    }
    return value
  }

  const clientId = read('client_id')
  if (!clientId) {
    return { kind: 'invalid', description: 'The request has no client_id.', error: 'invalid_request' }
  }
  const resolved = await resolveClient({ allowFetch: true, clientId, payload })
  if (!resolved.ok) return { kind: 'invalid', description: resolved.description, error: 'invalid_client' }
  const { client } = resolved
  const registered = getClientRedirectUris(client)

  let redirectUri = read('redirect_uri')
  if (!redirectUri) {
    if (registered.length !== 1) {
      return { kind: 'invalid', description: 'The request has no redirect_uri.', error: 'invalid_request' }
    }
    redirectUri = registered[0]!
  }
  if (!redirectUriMatches(registered, redirectUri)) {
    return {
      kind: 'invalid',
      description: 'The redirect_uri is not registered for this client.',
      error: 'invalid_request',
    }
  }

  // From here on the redirect URI is trusted, so errors can be delivered to the client
  const rawState = read('state')
  const state = rawState !== undefined && rawState.length <= MAX_STATE_LENGTH ? rawState : undefined
  const failWithRedirect = (error: string, description: string): ParsedAuthorizationRequest => ({
    kind: 'redirect',
    url: buildRedirectURL(redirectUri!, { error, error_description: description, state }),
  })
  if (rawState !== undefined && state === undefined) {
    return failWithRedirect('invalid_request', 'state is too long')
  }

  const responseType = read('response_type')
  const responseMode = read('response_mode')
  const codeChallenge = read('code_challenge')
  const codeChallengeMethod = read('code_challenge_method')
  const rawScope = read('scope')
  const rawResource = read('resource')

  if (duplicates.length > 0) {
    return failWithRedirect('invalid_request', `Duplicate parameter: ${duplicates[0]}`)
  }
  if (responseType !== 'code') {
    return failWithRedirect('unsupported_response_type', 'Only response_type=code is supported')
  }
  if (responseMode !== undefined && responseMode !== 'query') {
    return failWithRedirect('invalid_request', 'Only response_mode=query is supported')
  }
  if (!codeChallenge) return failWithRedirect('invalid_request', 'code_challenge is required (PKCE)')
  if (codeChallengeMethod !== 'S256') {
    return failWithRedirect('invalid_request', 'code_challenge_method must be S256')
  }
  if (!isValidCodeChallenge(codeChallenge)) {
    return failWithRedirect('invalid_request', 'code_challenge is not a valid S256 challenge')
  }

  const scope = rawScope === undefined ? undefined : cleanScope(rawScope)
  if (scope !== undefined && scope.length > MAX_SCOPE_LENGTH) {
    return failWithRedirect('invalid_scope', 'scope is too long')
  }

  // RFC 8707: tokens are only ever issued for this site's MCP server
  if (rawResource !== undefined && !isThisMCPResource(rawResource)) {
    return failWithRedirect(
      'invalid_target',
      `This authorization server only issues tokens for ${getMCPResourceURL()}`,
    )
  }

  return {
    kind: 'ok',
    client,
    request: {
      clientId,
      codeChallenge,
      codeChallengeMethod: 'S256',
      redirectUri,
      resource: getMCPResourceURL(),
      scope: scope || undefined,
      state,
    },
  }
}

/** The consent page URL (path and query) for a request, e.g. to come back to after logging in */
export const buildAuthorizeURL = (request: AuthorizationRequest): string => {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: request.clientId,
    code_challenge: request.codeChallenge,
    code_challenge_method: 'S256',
    redirect_uri: request.redirectUri,
    resource: request.resource,
  })
  if (request.scope) params.set('scope', request.scope)
  if (request.state !== undefined) params.set('state', request.state)
  return `${oauthPaths.authorize}?${params.toString()}`
}

/**
 * What the consent form posts back. Signed with the Payload secret and bound to the user who saw
 * the page, so a submission cannot be forged for another user or altered in transit.
 */
type ConsentToken = {
  cid: number | string
  exp: number
  n: string
  req: AuthorizationRequest
  uid: number | string
  v: 1
}

export const createConsentToken = ({
  clientRecordId,
  request,
  secret,
  userId,
}: {
  clientRecordId: number | string
  request: AuthorizationRequest
  secret: string
  userId: number | string
}): string =>
  signPayload(secret, {
    cid: clientRecordId,
    exp: Date.now() + CONSENT_REQUEST_LIFETIME,
    n: randomToken(8),
    req: request,
    uid: userId,
    v: 1,
  } satisfies ConsentToken)

export const readConsentToken = (secret: string, token: unknown): ConsentToken | null => {
  const parsed = verifyPayload<ConsentToken>(secret, token)
  if (!parsed || parsed.v !== 1 || typeof parsed.exp !== 'number' || parsed.exp < Date.now()) {
    return null
  }
  const request = parsed.req
  if (
    !request ||
    typeof request !== 'object' ||
    typeof request.clientId !== 'string' ||
    typeof request.redirectUri !== 'string' ||
    typeof request.codeChallenge !== 'string' ||
    request.codeChallengeMethod !== 'S256' ||
    typeof request.resource !== 'string'
  ) {
    return null
  }
  if (parsed.uid === undefined || parsed.cid === undefined) return null
  return parsed
}

/** Creates a single-use authorization code and returns the plain value for the redirect */
export const issueAuthorizationCode = async ({
  client,
  payload,
  request,
  userId,
}: {
  client: OauthClient
  payload: Payload
  request: AuthorizationRequest
  userId: number
}): Promise<string> => {
  const code = randomToken(32)

  await payload.create({
    collection: 'oauth-authorization-codes',
    data: {
      client: client.id,
      codeChallenge: request.codeChallenge,
      codeChallengeMethod: 'S256',
      codeHash: sha256(code),
      expiresAt: new Date(Date.now() + AUTHORIZATION_CODE_LIFETIME).toISOString(),
      redirectUri: request.redirectUri,
      resource: request.resource,
      scope: request.scope ?? null,
      user: userId,
    },
    depth: 0,
    overrideAccess: true,
  })

  return code
}
