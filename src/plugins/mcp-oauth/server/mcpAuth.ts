import type { MCPPluginConfig } from '@payloadcms/plugin-mcp'
import type { PayloadRequest } from 'payload'

import { filterMCPItems } from '@payloadcms/plugin-mcp/internal'
import { mergeHeaders, UnauthorizedError } from 'payload'

import { authenticateAccessToken } from './tokens'
import { buildBearerChallenge } from './urls'

type GetAuthorizedMCP = NonNullable<MCPPluginConfig['overrideGetAuthorizedMCP']>

/**
 * Payload merges `req.responseHeaders` into error responses, so the 401 that the thrown error
 * turns into carries the `WWW-Authenticate` challenge MCP clients need for discovery.
 */
const unauthorized = (
  req: PayloadRequest,
  challenge?: { error?: string; errorDescription?: string },
): UnauthorizedError => {
  req.responseHeaders = mergeHeaders(
    req.responseHeaders ?? new Headers(),
    new Headers({ 'WWW-Authenticate': buildBearerChallenge(challenge) }),
  )
  return new UnauthorizedError(req.t)
}

/**
 * Authentication for /api/mcp. Two ways in:
 *
 * - `Authorization: Bearer <token>`: an OAuth access token issued by this site after the user
 *   signed in and allowed the client. The AI acts as that user, with that user's permissions.
 * - `Authorization: users API-Key <key>`: a Payload user API key, exactly as before.
 *
 * Anonymous requests get a 401 with a `WWW-Authenticate` challenge, which is how MCP clients
 * such as ChatGPT learn that they should start the OAuth flow.
 */
export const getAuthorizedMCPWithOAuth: GetAuthorizedMCP = async ({
  overrideAccess,
  pluginConfig,
  req,
}) => {
  const authorization = req.headers.get('authorization')

  if (!authorization) {
    // RFC 6750 §3.1: no error code when the request carried no credentials at all
    throw unauthorized(req)
  }

  if (/^bearer\s/i.test(authorization)) {
    const result = await authenticateAccessToken({
      payload: req.payload,
      token: authorization.slice('bearer '.length).trim(),
    })
    if (!result.ok) {
      throw unauthorized(req, { error: 'invalid_token', errorDescription: result.reason })
    }
    req.user = result.user
  } else {
    const headers = new Headers(req.headers)
    headers.set('DisableAutologin', 'true')
    const { user } = await req.payload.auth({ headers, req })
    if (!user) {
      throw unauthorized(req, { error: 'invalid_token', errorDescription: 'The API key is not valid' })
    }
    req.user = user
  }

  return {
    items: await filterMCPItems({ items: pluginConfig.items, overrideAccess, req }),
    overrideAccess,
  }
}
