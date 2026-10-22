import type { CollectionConfig, CollectionSlug } from 'payload'

const deny = () => false

/**
 * The OAuth collections are internal bookkeeping: hidden from the admin, unreachable over REST,
 * GraphQL and MCP, and only ever read or written by the plugin's own code through the Local API
 * with `overrideAccess: true`. Users manage what they need through "Connected apps" instead.
 */
const bookkeeping = {
  access: {
    admin: deny,
    create: deny,
    delete: deny,
    read: deny,
    readVersions: deny,
    unlock: deny,
    update: deny,
  },
  admin: {
    group: false,
    hidden: true,
  },
  authorship: false,
  endpoints: false,
  graphQL: false,
  timestamps: true,
  versions: false,
} satisfies Partial<CollectionConfig>

export const oauthCollectionSlugs = [
  'oauth-clients',
  'oauth-authorization-codes',
  'oauth-grants',
  'oauth-tokens',
] as const

export type OAuthCollectionSlug = (typeof oauthCollectionSlugs)[number]

/** The four bookkeeping collections. `userSlug` is the auth collection the tokens act as. */
export const buildOAuthCollections = (userSlug: CollectionSlug): CollectionConfig[] => [
  {
    // OAuth clients that may ask users for access: registered dynamically (RFC 7591, e.g. the MCP
    // Inspector) or identified by the HTTPS URL of their client ID metadata document (ChatGPT),
    // in which case the row caches that document.
    slug: 'oauth-clients',
    ...bookkeeping,
    admin: { ...bookkeeping.admin, useAsTitle: 'clientName' },
    fields: [
      // Random `mcp_...` id for dynamic clients, or the metadata document URL
      { name: 'clientId', type: 'text', required: true, unique: true, index: true },
      { name: 'clientName', type: 'text', required: true },
      {
        name: 'registrationType',
        type: 'select',
        required: true,
        options: [
          { label: 'Dynamic client registration', value: 'dynamic' },
          { label: 'Client ID metadata document', value: 'metadata_document' },
        ],
      },
      {
        name: 'tokenEndpointAuthMethod',
        type: 'select',
        required: true,
        options: ['none', 'client_secret_basic', 'client_secret_post'],
      },
      // SHA-256 of the secret handed out at registration; only confidential clients have one
      { name: 'clientSecretHash', type: 'text' },
      {
        name: 'redirectUris',
        type: 'json',
        required: true,
        jsonSchema: {
          uri: 'payload://oauth-redirect-uris.json',
          fileMatch: ['payload://oauth-redirect-uris.json'],
          schema: { type: 'array', items: { type: 'string' } },
        },
      },
      { name: 'clientUri', type: 'text' },
      { name: 'logoUri', type: 'text' },
      // The metadata as registered or fetched, for reference and debugging
      { name: 'metadata', type: 'json' },
      // Client ID metadata documents are cached until this moment, then fetched again
      { name: 'metadataExpiresAt', type: 'date' },
      { name: 'lastUsedAt', type: 'date' },
    ],
  },
  {
    // Single-use authorization codes, alive for a few minutes between the consent page and the
    // token endpoint. The code itself is never stored, only its hash.
    slug: 'oauth-authorization-codes',
    ...bookkeeping,
    fields: [
      { name: 'codeHash', type: 'text', required: true, unique: true, index: true },
      { name: 'client', type: 'relationship', relationTo: 'oauth-clients', required: true, index: true },
      { name: 'user', type: 'relationship', relationTo: userSlug, required: true, index: true },
      // Set when the code is exchanged, so a replayed code can revoke what it produced
      { name: 'grant', type: 'relationship', relationTo: 'oauth-grants' },
      { name: 'redirectUri', type: 'text', required: true },
      { name: 'codeChallenge', type: 'text', required: true },
      { name: 'codeChallengeMethod', type: 'select', required: true, options: ['S256'] },
      // The MCP server URL the token will be bound to (RFC 8707)
      { name: 'resource', type: 'text', required: true },
      { name: 'scope', type: 'text' },
      { name: 'expiresAt', type: 'date', required: true, index: true },
      { name: 'usedAt', type: 'date' },
    ],
  },
  {
    // One grant per client and user: "ChatGPT may act as Maria". This is what "Connected apps"
    // lists and what gets revoked; tokens hang off it, so revoking kills every token at once.
    slug: 'oauth-grants',
    ...bookkeeping,
    fields: [
      { name: 'client', type: 'relationship', relationTo: 'oauth-clients', required: true, index: true },
      { name: 'user', type: 'relationship', relationTo: userSlug, required: true, index: true },
      { name: 'resource', type: 'text', required: true },
      { name: 'scope', type: 'text' },
      { name: 'lastUsedAt', type: 'date' },
      { name: 'revokedAt', type: 'date', index: true },
    ],
  },
  {
    // Access and refresh tokens, stored as hashes. Refresh tokens rotate: each is valid for one
    // refresh, after which a new pair is issued. Reusing a spent one revokes the whole grant.
    slug: 'oauth-tokens',
    ...bookkeeping,
    fields: [
      { name: 'type', type: 'select', required: true, index: true, options: ['access', 'refresh'] },
      { name: 'tokenHash', type: 'text', required: true, unique: true, index: true },
      { name: 'grant', type: 'relationship', relationTo: 'oauth-grants', required: true, index: true },
      { name: 'client', type: 'relationship', relationTo: 'oauth-clients', required: true },
      { name: 'user', type: 'relationship', relationTo: userSlug, required: true },
      { name: 'resource', type: 'text', required: true },
      { name: 'scope', type: 'text' },
      { name: 'expiresAt', type: 'date', required: true, index: true },
      // Refresh tokens only: set when the token was exchanged for a new pair
      { name: 'usedAt', type: 'date' },
    ],
  },
]
