import type { CollectionConfig } from 'payload'

import { anyone } from '../access/anyone'
import { authenticated } from '../access/authenticated'

/**
 * Categories form a tree using Payload 4's built-in hierarchy
 * (this replaces the nested-docs plugin from Payload 3).
 * Browse and rearrange the tree from the Categories tab in the admin sidebar.
 */
export const Categories: CollectionConfig = {
  slug: 'categories',
  access: {
    create: authenticated,
    delete: authenticated,
    read: anyone,
    update: authenticated,
  },
  admin: {
    useAsTitle: 'title',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'slug',
      useAsSlug: 'title',
    },
  ],
  hierarchy: {
    parentFieldName: 'parent',
    slugField: 'slug',
  },
  versions: false,
}
