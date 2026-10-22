import type { AuthenticatedUser, Payload, PayloadRequest } from 'payload'

import type { OauthAuthorizationCode, OauthGrant, OauthToken } from '@/payload-types'

import {
  ACCESS_TOKEN_LIFETIME,
  CLEANUP_INTERVAL,
  LAST_USED_WRITE_INTERVAL,
  REFRESH_TOKEN_LIFETIME,
} from './constants'
import { randomToken, sha256 } from './crypto'
import { isThisMCPResource } from './urls'

/** Relationship values arrive as an id or a populated document; this returns the id either way */
export const relationId = <T extends number | string>(
  value: null | T | undefined | { id: T },
): null | T => {
  if (value === null || value === undefined) return null
  return typeof value === 'object' ? value.id : value
}

export const sameId = (a: unknown, b: unknown): boolean =>
  a !== null && a !== undefined && b !== null && b !== undefined && String(a) === String(b)

/** The auth collection the tokens act as (`admin.user` in the Payload config) */
const userCollection = (payload: Payload) => payload.config.admin.user as 'users'

export type TokenResponse = {
  access_token: string
  expires_in: number
  refresh_token: string
  scope?: string
  token_type: 'Bearer'
}

export const findAuthorizationCode = async (
  payload: Payload,
  code: string,
): Promise<null | OauthAuthorizationCode> => {
  const { docs } = await payload.find({
    collection: 'oauth-authorization-codes',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    where: { codeHash: { equals: sha256(code) } },
  })
  return docs[0] ?? null
}

export const findToken = async (
  payload: Payload,
  type: 'access' | 'refresh' | undefined,
  token: string,
): Promise<null | OauthToken> => {
  const { docs } = await payload.find({
    collection: 'oauth-tokens',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    where: {
      and: [{ tokenHash: { equals: sha256(token) } }, ...(type ? [{ type: { equals: type } }] : [])],
    },
  })
  return docs[0] ?? null
}

/**
 * Marks a code or refresh token as used, but only if nobody did so first. With `atomic` the
 * adapter runs a single conditional UPDATE and returns null when no row matched, which keeps
 * codes and refresh tokens single-use even when two exchanges race each other.
 */
export const claimSingleUse = async (
  payload: Payload,
  collection: 'oauth-authorization-codes' | 'oauth-tokens',
  id: number | string,
): Promise<boolean> => {
  const updated = await payload.db.updateOne({
    collection,
    data: { usedAt: new Date().toISOString() },
    options: { atomic: true },
    returning: true,
    where: { and: [{ id: { equals: id } }, { usedAt: { exists: false } }] },
  })
  return Boolean(updated)
}

export const findActiveGrant = async ({
  clientRecordId,
  payload,
  userId,
}: {
  clientRecordId: number | string
  payload: Payload
  userId: number | string
}): Promise<null | OauthGrant> => {
  const { docs } = await payload.find({
    collection: 'oauth-grants',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    where: {
      and: [
        { client: { equals: clientRecordId } },
        { user: { equals: userId } },
        { revokedAt: { exists: false } },
      ],
    },
  })
  return docs[0] ?? null
}

/** One grant per client and user: re-authorizing refreshes it instead of adding a duplicate */
export const findOrCreateGrant = async ({
  clientRecordId,
  payload,
  resource,
  scope,
  userId,
}: {
  clientRecordId: number
  payload: Payload
  resource: string
  scope: null | string | undefined
  userId: number
}): Promise<OauthGrant> => {
  const existing = await findActiveGrant({ clientRecordId, payload, userId })
  if (existing) {
    if (scope && scope !== existing.scope) {
      return payload.update({
        id: existing.id,
        collection: 'oauth-grants',
        data: { scope },
        depth: 0,
        overrideAccess: true,
      })
    }
    return existing
  }

  return payload.create({
    collection: 'oauth-grants',
    data: { client: clientRecordId, resource, scope: scope ?? null, user: userId },
    depth: 0,
    overrideAccess: true,
  })
}

/** Issues a fresh access token and a fresh refresh token for a grant */
export const issueTokens = async ({
  grant,
  payload,
}: {
  grant: OauthGrant
  payload: Payload
}): Promise<TokenResponse> => {
  const accessToken = randomToken(32)
  const refreshToken = randomToken(32)
  const now = Date.now()
  const clientId = relationId(grant.client)
  const userId = relationId(grant.user)
  if (clientId === null || userId === null) throw new Error('Grant is missing its client or user')

  const shared = {
    client: clientId,
    grant: grant.id,
    resource: grant.resource,
    scope: grant.scope ?? null,
    user: userId,
  }
  await payload.create({
    collection: 'oauth-tokens',
    data: {
      ...shared,
      type: 'access',
      expiresAt: new Date(now + ACCESS_TOKEN_LIFETIME).toISOString(),
      tokenHash: sha256(accessToken),
    },
    depth: 0,
    overrideAccess: true,
  })
  await payload.create({
    collection: 'oauth-tokens',
    data: {
      ...shared,
      type: 'refresh',
      expiresAt: new Date(now + REFRESH_TOKEN_LIFETIME).toISOString(),
      tokenHash: sha256(refreshToken),
    },
    depth: 0,
    overrideAccess: true,
  })

  return {
    access_token: accessToken,
    expires_in: Math.floor(ACCESS_TOKEN_LIFETIME / 1000),
    refresh_token: refreshToken,
    token_type: 'Bearer',
    ...(grant.scope ? { scope: grant.scope } : {}),
  }
}

/** Revokes a grant and deletes every token issued under it. Idempotent. */
export const revokeGrant = async (payload: Payload, grantId: number | string): Promise<void> => {
  await payload.update({
    id: grantId,
    collection: 'oauth-grants',
    data: { revokedAt: new Date().toISOString() },
    depth: 0,
    overrideAccess: true,
  })
  await payload.delete({
    collection: 'oauth-tokens',
    depth: 0,
    overrideAccess: true,
    where: { grant: { equals: grantId } },
  })
}

/**
 * Runs before a user is deleted: nothing may keep acting as them, and the rows must go because
 * they reference the user with NOT NULL columns. `req` keeps this in the delete's transaction.
 */
export const deleteOAuthDataForUser = async (
  payload: Payload,
  userId: number | string,
  req?: PayloadRequest,
): Promise<void> => {
  for (const collection of ['oauth-tokens', 'oauth-authorization-codes', 'oauth-grants'] as const) {
    await payload.delete({
      collection,
      depth: 0,
      overrideAccess: true,
      req,
      where: { user: { equals: userId } },
    })
  }
}

export type AccessTokenAuthentication =
  | { ok: false; reason: string }
  | { ok: true; user: AuthenticatedUser }

/**
 * Resolves a bearer token presented to /api/mcp to its user. Rejects unknown, expired and
 * revoked tokens and tokens issued for any other resource.
 */
export const authenticateAccessToken = async ({
  payload,
  token,
}: {
  payload: Payload
  token: string
}): Promise<AccessTokenAuthentication> => {
  if (!token || token.length > 512) return { ok: false, reason: 'The access token is malformed' }

  const record = await findToken(payload, 'access', token)
  if (!record) return { ok: false, reason: 'The access token is unknown or has been revoked' }
  if (new Date(record.expiresAt).getTime() <= Date.now()) {
    return { ok: false, reason: 'The access token has expired' }
  }
  if (!isThisMCPResource(record.resource)) {
    return { ok: false, reason: 'The access token was issued for another resource' }
  }

  const grantId = relationId(record.grant)
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
  if (!grant || grant.revokedAt) return { ok: false, reason: 'Access has been revoked' }

  const users = userCollection(payload)
  const userId = relationId(record.user)
  const user =
    userId === null
      ? null
      : await payload.findByID({
          id: userId,
          collection: users,
          depth: payload.collections[users]?.config.auth.depth ?? 0,
          disableErrors: true,
          overrideAccess: true,
        })
  if (!user) return { ok: false, reason: 'The user no longer exists' }

  // Keep "last used" roughly current without a write on every single MCP call
  const lastUsed = grant.lastUsedAt ? new Date(grant.lastUsedAt).getTime() : 0
  if (Date.now() - lastUsed > LAST_USED_WRITE_INTERVAL) {
    payload
      .update({
        id: grant.id,
        collection: 'oauth-grants',
        data: { lastUsedAt: new Date().toISOString() },
        depth: 0,
        overrideAccess: true,
      })
      .catch((err: unknown) => payload.logger.warn({ err, msg: 'OAuth: could not update lastUsedAt' }))
  }

  return { ok: true, user: { ...user, _strategy: 'oauth', collection: users } }
}

let lastCleanup = 0

/** Deletes long-expired codes and tokens. Called from the token endpoint, throttled. */
export const cleanupExpired = async (payload: Payload): Promise<void> => {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now

  try {
    await payload.delete({
      collection: 'oauth-authorization-codes',
      depth: 0,
      overrideAccess: true,
      where: { expiresAt: { less_than: new Date(now - 60 * 60 * 1000).toISOString() } },
    })
    await payload.delete({
      collection: 'oauth-tokens',
      depth: 0,
      overrideAccess: true,
      where: { expiresAt: { less_than: new Date(now - 24 * 60 * 60 * 1000).toISOString() } },
    })
  } catch (err) {
    payload.logger.warn({ err, msg: 'OAuth: cleanup of expired codes and tokens failed' })
  }
}
