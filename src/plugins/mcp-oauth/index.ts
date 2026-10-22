import type { CollectionConfig, CollectionSlug, Field } from 'payload'

import { definePlugin } from 'payload'

import { buildOAuthCollections } from './collections'
import { oauthEndpoints } from './endpoints'
import { getAuthorizedMCPWithOAuth } from './server/mcpAuth'
import { deleteOAuthDataForUser } from './server/tokens'

export type MCPOAuthPluginOptions = {
  /** Set to false to switch the OAuth server off without removing the plugin. @default true */
  enabled?: boolean
}

const ADMIN = '@/plugins/mcp-oauth/admin/ConnectedApps'

/** The bookkeeping collections are never exposed to agents, not even read-only */
const noMCPTools = {
  count: false,
  countVersions: false,
  create: false,
  delete: false,
  duplicate: false,
  find: false,
  findDistinct: false,
  findVersionByID: false,
  findVersions: false,
  getCollectionSchema: false,
  getUploadInstructions: false,
  restoreVersion: false,
  update: false,
} as const

/** "Connected apps" with a Revoke button, shown on the user's own account and to admins */
const connectedAppsField: Field = {
  name: 'connectedApps',
  type: 'ui',
  label: 'Connected apps',
  admin: {
    components: { Field: `${ADMIN}#ConnectedAppsField` },
    condition: (data, _siblingData, { user }) => Boolean(user) && Boolean(data?.id),
  },
}

const withConnectedApps = (collection: CollectionConfig): CollectionConfig => ({
  ...collection,
  fields: [...collection.fields, connectedAppsField],
  hooks: {
    ...collection.hooks,
    // A deleted user's connected apps must not keep acting as them
    beforeDelete: [
      ...(collection.hooks?.beforeDelete ?? []),
      async ({ id, req }) => {
        await deleteOAuthDataForUser(req.payload, id, req)
      },
    ],
  },
})

/**
 * Lets ChatGPT and other MCP clients sign in to /api/mcp as a real Payload user through OAuth 2.1.
 *
 * Requires `@payloadcms/plugin-mcp` in the same `plugins` array. This plugin runs first and hands
 * the MCP plugin its authentication, so the MCP plugin's own options stay untouched. Everything
 * else is self-contained: four hidden collections, the OAuth endpoints under /api/oauth, the
 * "Connected apps" field, view and sidebar link, and a cleanup hook on the users collection.
 * Next.js needs five thin route files under src/app for the consent page and the discovery
 * documents; see README.md in this folder.
 */
export const mcpOAuthPlugin = definePlugin<MCPOAuthPluginOptions | undefined>({
  slug: 'mcp-oauth',
  // @payloadcms/plugin-mcp runs at order 10; this must come first to set its auth override
  order: 0,
  plugin: ({ config, options, plugins }) => {
    if (options?.enabled === false) return config

    const mcp = plugins['@payloadcms/plugin-mcp']
    if (!mcp) {
      throw new Error(
        'mcpOAuthPlugin: add @payloadcms/plugin-mcp to `plugins` as well. The OAuth server protects its /api/mcp endpoint.',
      )
    }
    // Bearer tokens from this server, or user API keys as before; anonymous requests get a 401
    mcp.options.overrideGetAuthorizedMCP ??= getAuthorizedMCPWithOAuth
    mcp.options.collections = {
      ...mcp.options.collections,
      'oauth-clients': { tools: noMCPTools },
      'oauth-authorization-codes': { tools: noMCPTools },
      'oauth-grants': { tools: noMCPTools },
      'oauth-tokens': { tools: noMCPTools },
    }

    const userSlug = (config.admin?.user ?? 'users') as CollectionSlug
    const components = config.admin?.components ?? {}

    return {
      ...config,
      admin: {
        ...config.admin,
        components: {
          ...components,
          afterNavLinks: [...(components.afterNavLinks ?? []), `${ADMIN}#ConnectedAppsNavLink`],
          views: {
            ...components.views,
            connectedApps: {
              Component: `${ADMIN}#ConnectedAppsView`,
              exact: true,
              path: '/connected-apps',
            },
          },
        },
      },
      collections: [
        ...(config.collections ?? []).map((collection) =>
          collection.slug === userSlug ? withConnectedApps(collection) : collection,
        ),
        ...buildOAuthCollections(userSlug),
      ],
      endpoints: [...(config.endpoints ?? []), ...oauthEndpoints],
    }
  },
})
