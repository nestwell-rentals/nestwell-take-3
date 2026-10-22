import type { Payload, PayloadRequest } from 'payload'

import type { OauthClient } from '@/payload-types'

import { fetchClientMetadataDocument } from './cimd'
import { type ClientMetadata } from './clientMetadata'
import { randomToken, safeEqual, sha256 } from './crypto'

/** Client IDs that are URLs point at a client ID metadata document (ChatGPT does this) */
export const isMetadataDocumentClientId = (clientId: string): boolean => clientId.startsWith('https://')

export const getClientRedirectUris = (client: OauthClient): string[] =>
  Array.isArray(client.redirectUris)
    ? client.redirectUris.filter((uri): uri is string => typeof uri === 'string')
    : []

export const findClientByClientId = async (
  payload: Payload,
  clientId: string,
): Promise<null | OauthClient> => {
  const { docs } = await payload.find({
    collection: 'oauth-clients',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    where: { clientId: { equals: clientId } },
  })
  return docs[0] ?? null
}

export type ResolvedClient = { client: OauthClient; ok: true } | { description: string; ok: false }

/**
 * Finds the client for a `client_id`. Dynamically registered clients are plain lookups. For a
 * metadata document URL, the document is fetched (and cached in the clients collection) when
 * `allowFetch` is set and the cached copy is missing or stale. The token endpoint passes
 * `allowFetch: false`: a client that never went through the consent page has nothing to exchange.
 */
export const resolveClient = async ({
  allowFetch,
  clientId,
  payload,
}: {
  allowFetch: boolean
  clientId: unknown
  payload: Payload
}): Promise<ResolvedClient> => {
  if (typeof clientId !== 'string' || clientId.length === 0) {
    return { ok: false, description: 'client_id is required' }
  }

  const existing = await findClientByClientId(payload, clientId)

  if (!isMetadataDocumentClientId(clientId)) {
    return existing ? { ok: true, client: existing } : { ok: false, description: 'Unknown client_id' }
  }

  const stillFresh = existing?.metadataExpiresAt
    ? new Date(existing.metadataExpiresAt).getTime() > Date.now()
    : false
  if (existing && (stillFresh || !allowFetch)) return { ok: true, client: existing }

  const fetched = await fetchClientMetadataDocument(clientId)
  if (!fetched.ok) {
    if (existing) {
      payload.logger.warn({
        clientId,
        msg: 'OAuth: could not refresh the client ID metadata document, using the cached copy',
        reason: fetched.description,
      })
      return { ok: true, client: existing }
    }
    return { ok: false, description: fetched.description }
  }

  const data = {
    clientId,
    clientName: fetched.metadata.clientName,
    clientUri: fetched.metadata.clientUri ?? null,
    logoUri: fetched.metadata.logoUri ?? null,
    metadata: fetched.raw,
    metadataExpiresAt: fetched.expiresAt.toISOString(),
    redirectUris: fetched.metadata.redirectUris,
    registrationType: 'metadata_document' as const,
    tokenEndpointAuthMethod: 'none' as const,
  }
  const client = existing
    ? await payload.update({
        id: existing.id,
        collection: 'oauth-clients',
        data,
        depth: 0,
        overrideAccess: true,
      })
    : await payload.create({ collection: 'oauth-clients', data, depth: 0, overrideAccess: true })

  return { ok: true, client }
}

/** RFC 7591 registration: mints a client id (and a secret for confidential clients) */
export const registerDynamicClient = async ({
  metadata,
  payload,
}: {
  metadata: ClientMetadata
  payload: Payload
}): Promise<{ client: OauthClient; clientSecret: null | string }> => {
  const clientId = `mcp_${randomToken(16)}`
  const clientSecret = metadata.tokenEndpointAuthMethod === 'none' ? null : randomToken(32)

  const client = await payload.create({
    collection: 'oauth-clients',
    data: {
      clientId,
      clientName: metadata.clientName,
      clientSecretHash: clientSecret ? sha256(clientSecret) : null,
      clientUri: metadata.clientUri ?? null,
      logoUri: metadata.logoUri ?? null,
      metadata: metadata.registered,
      redirectUris: metadata.redirectUris,
      registrationType: 'dynamic',
      tokenEndpointAuthMethod: metadata.tokenEndpointAuthMethod,
    },
    depth: 0,
    overrideAccess: true,
  })

  return { client, clientSecret }
}

export type ClientAuthentication =
  | { client: OauthClient; ok: true; usedBasicAuth: boolean }
  | { description: string; ok: false; usedBasicAuth: boolean }

/**
 * Client authentication at the token and revocation endpoints (RFC 6749 §2.3). Public clients
 * only name themselves; PKCE is their proof. Confidential clients present their secret, either
 * as HTTP Basic credentials or in the body, and it is compared in constant time against the hash.
 */
export const authenticateClient = async ({
  params,
  payload,
  req,
}: {
  params: URLSearchParams
  payload: Payload
  req: PayloadRequest
}): Promise<ClientAuthentication> => {
  const authorization = req.headers.get('authorization')
  const usedBasicAuth = Boolean(authorization && /^basic\s/i.test(authorization))
  const fail = (description: string): ClientAuthentication => ({ ok: false, description, usedBasicAuth })

  let basicId: string | undefined
  let basicSecret: string | undefined
  if (authorization && usedBasicAuth) {
    try {
      const decoded = Buffer.from(authorization.slice(6).trim(), 'base64').toString('utf8')
      const separator = decoded.indexOf(':')
      if (separator === -1) return fail('Malformed Basic authorization header')
      // RFC 6749 §2.3.1: both values are form-urlencoded before being base64 encoded
      basicId = decodeURIComponent(decoded.slice(0, separator))
      basicSecret = decodeURIComponent(decoded.slice(separator + 1))
    } catch {
      return fail('Malformed Basic authorization header')
    }
  }

  const bodyId = params.get('client_id') ?? undefined
  if (basicId && bodyId && basicId !== bodyId) {
    return fail('client_id in the Authorization header and in the body differ')
  }
  const clientId = basicId ?? bodyId
  if (!clientId) return fail('client_id is required')

  const resolved = await resolveClient({ allowFetch: false, clientId, payload })
  if (!resolved.ok) return fail('Unknown client')
  const { client } = resolved

  if (client.tokenEndpointAuthMethod === 'none') return { ok: true, client, usedBasicAuth }

  const secret = basicSecret ?? params.get('client_secret') ?? undefined
  if (!secret || !client.clientSecretHash || !safeEqual(sha256(secret), client.clientSecretHash)) {
    return fail('Invalid client credentials')
  }
  return { ok: true, client, usedBasicAuth }
}
