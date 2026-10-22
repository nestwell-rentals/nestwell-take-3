import type { CollectionBeforeChangeHook, CollectionConfig } from 'payload'

import { authenticated } from '../../access/authenticated'
import { isAdmin, isAdminFieldLevel, isAdminOrSelf } from '../../access/roles'

/**
 * The very first account (created on /admin/create-first-user) always becomes an admin.
 * Everyone created after that defaults to editor unless an admin picks another role.
 */
const makeFirstUserAdmin: CollectionBeforeChangeHook = async ({ data, operation, req }) => {
  if (operation !== 'create') return data

  const { totalDocs } = await req.payload.count({ collection: 'users', overrideAccess: true, req })

  if (totalDocs === 0) {
    return { ...data, roles: ['admin'] }
  }

  return data
}

export const Users: CollectionConfig = {
  slug: 'users',
  access: {
    // Every signed-in user can open the admin panel; what they can do there depends on their role
    admin: authenticated,
    create: isAdmin,
    delete: isAdmin,
    read: authenticated,
    update: isAdminOrSelf,
  },
  admin: {
    defaultColumns: ['name', 'email', 'roles'],
    useAsTitle: 'name',
  },
  // API keys let AI agents and other machines act as a user, e.g. through the MCP endpoint at /api/mcp
  auth: {
    useAPIKey: true,
  },
  fields: [
    // Payload renders the API key inputs on /admin/create-first-user too, where they make no sense.
    // These entries only add a display condition; Payload merges them into its own API key fields.
    { name: 'apiKey', type: 'text', admin: { condition: (_data, _siblingData, { user }) => Boolean(user) } },
    { name: 'apiKeyLast4', type: 'text', admin: { condition: (_data, _siblingData, { user }) => Boolean(user) } },
    {
      name: 'name',
      type: 'text',
    },
    {
      name: 'roles',
      type: 'select',
      hasMany: true,
      defaultValue: ['editor'],
      saveToJWT: true,
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'Editor', value: 'editor' },
      ],
      access: {
        create: isAdminFieldLevel,
        update: isAdminFieldLevel,
      },
      admin: {
        // Hidden on /admin/create-first-user: the first account always becomes an admin
        condition: (_data, _siblingData, { user }) => Boolean(user),
        description: 'Admins manage users and site setup. Editors manage content.',
        position: 'sidebar',
      },
    },
  ],
  hooks: {
    beforeChange: [makeFirstUserAdmin],
  },
  // Tracking which user created which user adds nothing here
  authorship: false,
  timestamps: true,
  versions: false,
}
