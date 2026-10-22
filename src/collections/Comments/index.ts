import type { Access, CollectionConfig, FieldAccess } from 'payload'

import { anyone } from '../../access/anyone'
import { authenticated } from '../../access/authenticated'
import { revalidateComment, revalidateCommentDelete } from './hooks/revalidateComment'

const authenticatedFieldLevel: FieldAccess = ({ req: { user } }) => Boolean(user)

/** Staff see every comment; visitors only see approved ones. */
const readApprovedOrAuthenticated: Access = ({ req: { user } }) => {
  if (user) return true

  return { status: { equals: 'approved' } }
}

/**
 * Visitors leave comments on posts from the website. New comments start as "pending" and only
 * appear on the site after someone approves them in the admin (or through the MCP `moderateComment` tool).
 */
export const Comments: CollectionConfig = {
  slug: 'comments',
  access: {
    create: anyone,
    delete: authenticated,
    read: readApprovedOrAuthenticated,
    update: authenticated,
  },
  admin: {
    defaultColumns: ['content', 'status', 'post', 'createdAt'],
    description: 'Comments from website visitors. Approve them to make them visible on the post.',
    group: 'Community',
    listSearchableFields: ['content', 'author.name'],
    useAsTitle: 'content',
  },
  defaultSort: '-createdAt',
  llmInstructions: [
    'Comments are written by anonymous website visitors.',
    'When moderating: approve comments that are on-topic and respectful, mark link spam and advertising as "spam".',
    'Never edit the content or author of a comment, only its status.',
  ].join('\n'),
  fields: [
    {
      name: 'content',
      type: 'textarea',
      required: true,
      maxLength: 2000,
    },
    {
      name: 'author',
      type: 'group',
      fields: [
        {
          name: 'name',
          type: 'text',
          required: true,
          maxLength: 100,
        },
        {
          name: 'email',
          type: 'email',
          required: true,
          // Visitors never see each other's email addresses
          access: {
            read: authenticatedFieldLevel,
          },
        },
      ],
    },
    {
      name: 'post',
      type: 'relationship',
      relationTo: 'posts',
      required: true,
      index: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      index: true,
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Approved', value: 'approved' },
        { label: 'Spam', value: 'spam' },
      ],
      // Visitors cannot approve their own comments
      access: {
        create: authenticatedFieldLevel,
        update: authenticatedFieldLevel,
      },
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'publishedAt',
      type: 'date',
      access: {
        create: authenticatedFieldLevel,
        update: authenticatedFieldLevel,
      },
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'Set automatically when the comment is approved.',
      },
      hooks: {
        beforeChange: [
          ({ siblingData, value }) => {
            if (siblingData.status === 'approved' && !value) return new Date()
            return value
          },
        ],
      },
    },
    {
      // Honeypot: hidden from people, but naive bots fill in every field they find
      name: 'website',
      type: 'text',
      access: {
        read: () => false,
      },
      admin: {
        hidden: true,
      },
      validate: (value: string | null | undefined) =>
        value ? 'Your comment could not be submitted.' : true,
    },
  ],
  hooks: {
    afterChange: [revalidateComment],
    afterDelete: [revalidateCommentDelete],
  },
  versions: false,
}
