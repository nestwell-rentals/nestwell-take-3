import { defineCollectionTool, defineTool, mcpPlugin } from '@payloadcms/plugin-mcp'

/**
 * Exposes the CMS to AI agents over MCP at /api/mcp.
 *
 * Agents authenticate as a real user with an API key (Users > your account > Enable API key) and
 * send it as `Authorization: users API-Key <key>`. Everything they do goes through the same
 * access control as that user, and each collection's `llmInstructions` tell them how to behave.
 */
export const mcp = mcpPlugin({
  collections: {
    posts: {
      description: 'Blog posts shown on /posts',
      // Agents can draft and edit, but deleting content stays a human decision
      tools: { delete: false },
    },
    pages: {
      description: 'Website pages built from layout blocks',
      tools: { delete: false },
    },
    categories: { description: 'Nested post categories' },
    tags: { description: 'Post tags' },
    media: { description: 'Images and other uploads', tools: { delete: false } },
    comments: {
      description: 'Visitor comments on posts. New comments are pending until approved.',
      tools: {
        create: false,
        delete: false,
        moderateComment: defineCollectionTool({
          description: 'Approve a pending comment or mark it as spam.',
          input: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'The comment ID' },
              status: { type: 'string', enum: ['approved', 'spam'] },
            },
            required: ['id', 'status'],
          },
        }).handler(async ({ authorizedMCP, input, req }) => {
          const comment = await req.payload.update({
            collection: 'comments',
            id: String(input.id),
            data: { status: input.status as 'approved' | 'spam' },
            overrideAccess: authorizedMCP.overrideAccess,
            req,
          })

          return {
            content: [{ type: 'text', text: `Comment ${comment.id} is now ${comment.status}.` }],
          }
        }),
      },
    },
    users: {
      description: 'Admin users (read-only over MCP)',
      tools: {
        create: false,
        update: false,
        delete: false,
        duplicate: false,
      },
    },
    'form-submissions': { tools: { create: false, update: false, delete: false } },
  },
  tools: {
    siteOverview: defineTool({
      description:
        'Quick overview of the site: how many posts, pages and pending comments exist. Good first call.',
      access: ({ req }) => Boolean(req.user),
    }).handler(async ({ authorizedMCP, req }) => {
      const overrideAccess = authorizedMCP.overrideAccess
      const [posts, drafts, pages, pending] = await Promise.all([
        req.payload.count({ collection: 'posts', overrideAccess, req, where: { _status: { equals: 'published' } } }),
        req.payload.count({ collection: 'posts', overrideAccess, req, where: { _status: { equals: 'draft' } } }),
        req.payload.count({ collection: 'pages', overrideAccess, req }),
        req.payload.count({ collection: 'comments', overrideAccess, req, where: { status: { equals: 'pending' } } }),
      ])

      return {
        content: [
          {
            type: 'text',
            text: [
              `Published posts: ${posts.totalDocs}`,
              `Draft posts: ${drafts.totalDocs}`,
              `Pages: ${pages.totalDocs}`,
              `Comments waiting for moderation: ${pending.totalDocs}`,
            ].join('\n'),
          },
        ],
      }
    }),
  },
})
