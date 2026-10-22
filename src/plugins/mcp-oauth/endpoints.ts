import type { Endpoint, Payload } from 'payload'

import { generateExpiredPayloadCookie } from 'payload'

import type { OauthClient } from '@/payload-types'

import {
  buildAuthorizeURL,
  buildRedirectURL,
  issueAuthorizationCode,
  readConsentToken,
} from './server/authorize'
import { validateClientMetadata } from './server/clientMetadata'
import { authenticateClient, getClientRedirectUris, registerDynamicClient } from './server/clients'
import { RATE_LIMITS } from './server/constants'
import { verifyPKCE } from './server/crypto'
import { isAdminUser } from './server/grants'
import {
  checkRateLimit,
  getClientIP,
  isSameOriginRequest,
  oauthError,
  oauthJSON,
  preflight,
  publicCORSHeaders,
  rateLimited,
  readBodyText,
  readParams,
  seeOther,
} from './server/http'
import { redirectUriMatches } from './server/redirectUris'
import {
  claimSingleUse,
  cleanupExpired,
  findAuthorizationCode,
  findOrCreateGrant,
  findToken,
  issueTokens,
  relationId,
  revokeGrant,
  sameId,
} from './server/tokens'
import { isThisMCPResource, oauthPaths } from './server/urls'

/**
 * The OAuth authorization server's HTTP surface, mounted under Payload's REST prefix:
 * /api/oauth/register, /api/oauth/token and /api/oauth/revoke for clients, plus the consent
 * decision, "Not you?" and the admin's revocation action for browsers. Discovery documents live
 * under /.well-known and the consent page at /oauth/authorize (see ./next).
 */

/** Dynamic client registration (RFC 7591). Open to anyone, like every registration endpoint. */
const registerEndpoint: Endpoint = {
  handler: async (req) => {
    const limit = checkRateLimit(`register:${getClientIP(req.headers)}`, RATE_LIMITS.register)
    if (!limit.allowed) return rateLimited(limit.retryAfterSeconds)

    let body: unknown
    try {
      body = JSON.parse(await readBodyText(req))
    } catch {
      return oauthError('invalid_client_metadata', 'The request body must be a JSON object')
    }

    const validated = validateClientMetadata(body, 'dynamic')
    if (!validated.ok) return oauthError(validated.error, validated.description)

    const { client, clientSecret } = await registerDynamicClient({
      metadata: validated.metadata,
      payload: req.payload,
    })
    req.payload.logger.info({
      clientId: client.clientId,
      clientName: client.clientName,
      msg: 'OAuth client registered',
      redirectUris: validated.metadata.redirectUris,
    })

    return oauthJSON(
      {
        client_id: client.clientId,
        client_id_issued_at: Math.floor(new Date(client.createdAt).getTime() / 1000),
        ...(clientSecret ? { client_secret: clientSecret, client_secret_expires_at: 0 } : {}),
        ...validated.metadata.registered,
      },
      201,
    )
  },
  method: 'post',
  path: '/oauth/register',
}

const invalidGrant = (description: string) => oauthError('invalid_grant', description)

const exchangeAuthorizationCode = async ({
  client,
  params,
  payload,
}: {
  client: OauthClient
  params: URLSearchParams
  payload: Payload
}): Promise<Response> => {
  const code = params.get('code')
  const codeVerifier = params.get('code_verifier')
  const redirectUri = params.get('redirect_uri')
  const resource = params.get('resource')

  if (!code) return oauthError('invalid_request', 'code is required')
  if (!codeVerifier) return oauthError('invalid_request', 'code_verifier is required')

  const record = await findAuthorizationCode(payload, code)
  if (!record) return invalidGrant('Unknown authorization code')

  if (record.usedAt) {
    // OAuth 2.1 §4.1.3: a replayed code revokes what the first exchange produced
    const grantId = relationId(record.grant)
    if (grantId !== null) await revokeGrant(payload, grantId)
    payload.logger.warn({ clientId: client.clientId, msg: 'OAuth: authorization code replayed' })
    return invalidGrant('Authorization code was already used')
  }
  if (new Date(record.expiresAt).getTime() <= Date.now()) {
    return invalidGrant('Authorization code has expired')
  }
  if (!sameId(relationId(record.client), client.id)) {
    return invalidGrant('Authorization code was issued to another client')
  }
  if (redirectUri !== null && redirectUri !== record.redirectUri) {
    return invalidGrant('redirect_uri does not match the authorization request')
  }
  if (!verifyPKCE(codeVerifier, record.codeChallenge)) {
    return invalidGrant('code_verifier does not match code_challenge')
  }
  if (resource !== null && !isThisMCPResource(resource)) {
    return oauthError('invalid_target', 'The token can only be issued for this MCP server')
  }

  const userId = relationId(record.user)
  if (userId === null) return invalidGrant('Authorization code has no user')

  // Claim the code before issuing anything, so a concurrent duplicate request gets nothing
  if (!(await claimSingleUse(payload, 'oauth-authorization-codes', record.id))) {
    return invalidGrant('Authorization code was already used')
  }

  const grant = await findOrCreateGrant({
    clientRecordId: client.id,
    payload,
    resource: record.resource,
    scope: record.scope,
    userId,
  })
  // Remember what the code produced, so a later replay can revoke it
  await payload.update({
    id: record.id,
    collection: 'oauth-authorization-codes',
    data: { grant: grant.id },
    depth: 0,
    overrideAccess: true,
  })

  const tokens = await issueTokens({ grant, payload })
  payload.logger.info({
    clientId: client.clientId,
    msg: 'OAuth: issued tokens for authorization code',
    userId,
  })
  return oauthJSON(tokens)
}

const refreshAccessToken = async ({
  client,
  params,
  payload,
}: {
  client: OauthClient
  params: URLSearchParams
  payload: Payload
}): Promise<Response> => {
  const refreshToken = params.get('refresh_token')
  const resource = params.get('resource')
  const requestedScope = params.get('scope')

  if (!refreshToken) return oauthError('invalid_request', 'refresh_token is required')

  const record = await findToken(payload, 'refresh', refreshToken)
  if (!record) return invalidGrant('Unknown refresh token')
  if (!sameId(relationId(record.client), client.id)) {
    return invalidGrant('Refresh token was issued to another client')
  }

  const grantId = relationId(record.grant)
  if (record.usedAt) {
    // OAuth 2.1 §4.3.1: a spent refresh token showing up again means it leaked. Revoke everything.
    if (grantId !== null) await revokeGrant(payload, grantId)
    payload.logger.warn({ clientId: client.clientId, msg: 'OAuth: refresh token reuse detected' })
    return invalidGrant('Refresh token was already used')
  }
  if (new Date(record.expiresAt).getTime() <= Date.now()) {
    return invalidGrant('Refresh token has expired')
  }
  if (resource !== null && !isThisMCPResource(resource)) {
    return oauthError('invalid_target', 'The token can only be issued for this MCP server')
  }

  const grant =
    grantId === null
      ? null
      : await payload.findByID({
          id: grantId,
          collection: 'oauth-grants',
          depth: 0,
          disableErrors: true,
          overrideAccess: true,
        })
  if (!grant || grant.revokedAt) return invalidGrant('Access has been revoked')

  if (requestedScope !== null) {
    const granted = new Set((grant.scope ?? '').split(' ').filter(Boolean))
    const requested = requestedScope.split(' ').filter(Boolean)
    if (requested.some((scope) => !granted.has(scope))) {
      return oauthError('invalid_scope', 'Requested scope exceeds the original grant')
    }
  }

  if (!(await claimSingleUse(payload, 'oauth-tokens', record.id))) {
    return invalidGrant('Refresh token was already used')
  }

  return oauthJSON(await issueTokens({ grant, payload }))
}

/** The token endpoint (OAuth 2.1 §3.2): authorization codes in, access and refresh tokens out */
const tokenEndpoint: Endpoint = {
  handler: async (req) => {
    const limit = checkRateLimit(`token:${getClientIP(req.headers)}`, RATE_LIMITS.token)
    if (!limit.allowed) return rateLimited(limit.retryAfterSeconds)

    const params = await readParams(req)
    if (!params) return oauthError('invalid_request', 'The request body could not be parsed')

    const auth = await authenticateClient({ params, payload: req.payload, req })
    if (!auth.ok) {
      return oauthError(
        'invalid_client',
        auth.description,
        401,
        auth.usedBasicAuth ? { 'WWW-Authenticate': 'Basic realm="OAuth"' } : {},
      )
    }

    const grantType = params.get('grant_type')
    let response: Response
    if (grantType === 'authorization_code') {
      response = await exchangeAuthorizationCode({ client: auth.client, params, payload: req.payload })
    } else if (grantType === 'refresh_token') {
      response = await refreshAccessToken({ client: auth.client, params, payload: req.payload })
    } else {
      response = oauthError(
        'unsupported_grant_type',
        'Supported grant types: authorization_code, refresh_token',
      )
    }

    // Housekeeping rides along with real traffic, so no scheduler is needed
    await cleanupExpired(req.payload)

    return response
  },
  method: 'post',
  path: '/oauth/token',
}

/**
 * Token revocation (RFC 7009), for clients that offer a "disconnect" action. Revoking either an
 * access or a refresh token revokes the whole grant, since the client is walking away from it.
 * Tokens that do not belong to the calling client are ignored silently, as the RFC requires.
 */
const revokeEndpoint: Endpoint = {
  handler: async (req) => {
    const limit = checkRateLimit(`revoke:${getClientIP(req.headers)}`, RATE_LIMITS.revoke)
    if (!limit.allowed) return rateLimited(limit.retryAfterSeconds)

    const params = await readParams(req)
    if (!params) return oauthError('invalid_request', 'The request body could not be parsed')

    const auth = await authenticateClient({ params, payload: req.payload, req })
    if (!auth.ok) {
      return oauthError(
        'invalid_client',
        auth.description,
        401,
        auth.usedBasicAuth ? { 'WWW-Authenticate': 'Basic realm="OAuth"' } : {},
      )
    }

    const token = params.get('token')
    if (!token) return oauthError('invalid_request', 'token is required')

    const record = await findToken(req.payload, undefined, token)
    if (record && sameId(relationId(record.client), auth.client.id)) {
      const grantId = relationId(record.grant)
      if (grantId !== null) await revokeGrant(req.payload, grantId)
      req.payload.logger.info({ clientId: auth.client.clientId, msg: 'OAuth: client revoked its grant' })
    }

    return new Response(null, {
      headers: { ...publicCORSHeaders, 'Cache-Control': 'no-store' },
      status: 200,
    })
  },
  method: 'post',
  path: '/oauth/revoke',
}

/**
 * Receives the consent form. The signed request token carries the full authorization request
 * and the id of the user who saw the page; the submission must come from that same, still
 * signed-in user. On "allow" an authorization code is issued and the browser is sent to the
 * client's redirect URI; on "deny" the client learns `access_denied`. The redirect URI is
 * checked against the client's registration once more, so a stale token can never redirect
 * anywhere the client no longer owns.
 */
const consentDecisionEndpoint: Endpoint = {
  handler: async (req) => {
    if (!isSameOriginRequest(req)) {
      return Response.json({ error: 'Cross-site form submissions are not accepted' }, { status: 403 })
    }

    const form = await readParams(req)
    const consent = readConsentToken(req.payload.secret, form?.get('request'))
    if (!consent) return seeOther(`${oauthPaths.authorize}?reason=expired`)

    const authorizeURL = buildAuthorizeURL(consent.req)
    // Not signed in, or signed in as someone else since the page was rendered: start over there
    if (!req.user || String(req.user.id) !== String(consent.uid)) return seeOther(authorizeURL)

    const client = await req.payload.findByID({
      id: consent.cid,
      collection: 'oauth-clients',
      depth: 0,
      disableErrors: true,
      overrideAccess: true,
    })
    if (!client || client.clientId !== consent.req.clientId) {
      return seeOther(`${oauthPaths.authorize}?reason=unknown_client`)
    }
    if (!redirectUriMatches(getClientRedirectUris(client), consent.req.redirectUri)) {
      return Response.json(
        { error: 'The redirect URI is no longer registered for this client' },
        { status: 400 },
      )
    }

    const { redirectUri, state } = consent.req

    if (form?.get('decision') !== 'allow') {
      req.payload.logger.info({
        clientId: client.clientId,
        msg: 'OAuth: user denied the authorization request',
        userId: req.user.id,
      })
      return seeOther(
        buildRedirectURL(redirectUri, {
          error: 'access_denied',
          error_description: 'The user denied the request',
          state,
        }),
      )
    }

    const code = await issueAuthorizationCode({
      client,
      payload: req.payload,
      request: consent.req,
      userId: req.user.id,
    })
    req.payload.logger.info({
      clientId: client.clientId,
      msg: 'OAuth: user allowed the authorization request',
      userId: req.user.id,
    })

    return seeOther(buildRedirectURL(redirectUri, { code, state }))
  },
  method: 'post',
  path: '/oauth/authorize',
}

/**
 * "Not you?" on the consent page: signs the browser out and returns to the admin login with the
 * authorization request preserved, so the right person can sign in and continue.
 */
const switchAccountEndpoint: Endpoint = {
  handler: (req) => {
    if (!isSameOriginRequest(req)) {
      return Response.json({ error: 'Cross-site requests are not accepted' }, { status: 403 })
    }

    const { admin: adminRoute } = req.payload.config.routes
    const consent = readConsentToken(req.payload.secret, req.searchParams.get('request'))
    const location = consent
      ? `${adminRoute}/login?redirect=${encodeURIComponent(buildAuthorizeURL(consent.req))}`
      : `${adminRoute}/login`

    const userSlug = req.payload.config.admin.user as 'users'
    const expiredCookie = generateExpiredPayloadCookie({
      collectionAuthConfig: req.payload.collections[userSlug].config.auth,
      cookiePrefix: req.payload.config.cookiePrefix,
    })

    return new Response(null, {
      headers: { 'Cache-Control': 'no-store', Location: location, 'Set-Cookie': expiredCookie },
      status: 303,
    })
  },
  method: 'get',
  path: '/oauth/switch-account',
}

/**
 * Revocation from the admin's "Connected apps" views. Users may revoke their own grants, admins
 * anyone's. Cookie-authenticated, so only same-origin requests are accepted.
 */
const revokeGrantEndpoint: Endpoint = {
  handler: async (req) => {
    if (!isSameOriginRequest(req)) {
      return Response.json({ error: 'Cross-site requests are not accepted' }, { status: 403 })
    }
    if (!req.user) return Response.json({ error: 'Not signed in' }, { status: 401 })

    const id = req.routeParams?.id
    if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
      return Response.json({ error: 'Invalid grant id' }, { status: 400 })
    }

    const grant = await req.payload.findByID({
      id,
      collection: 'oauth-grants',
      depth: 0,
      disableErrors: true,
      overrideAccess: true,
    })
    if (!grant) return Response.json({ error: 'Not found' }, { status: 404 })

    const isOwner = sameId(relationId(grant.user), req.user.id)
    if (!isOwner && !isAdminUser(req.user)) {
      return Response.json({ error: 'You can only revoke your own connected apps' }, { status: 403 })
    }

    await revokeGrant(req.payload, grant.id)
    req.payload.logger.info({
      grantId: grant.id,
      msg: 'OAuth: grant revoked from the admin',
      revokedBy: req.user.id,
    })

    return Response.json({ revoked: true }, { headers: { 'Cache-Control': 'no-store' } })
  },
  method: 'delete',
  path: '/oauth/grants/:id',
}

// Browser-based MCP clients (the MCP Inspector) call these cross-origin, so answer preflights
const preflightFor = (path: string): Endpoint => ({ handler: preflight, method: 'options', path })

export const oauthEndpoints: Endpoint[] = [
  registerEndpoint,
  tokenEndpoint,
  revokeEndpoint,
  preflightFor('/oauth/register'),
  preflightFor('/oauth/token'),
  preflightFor('/oauth/revoke'),
  consentDecisionEndpoint,
  switchAccountEndpoint,
  revokeGrantEndpoint,
]
