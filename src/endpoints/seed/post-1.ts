import type { Media } from '@/payload-types'

import type { PostContent } from './types'
import { a, banner, BOLD, CODE, code, demoDisclaimer, h, media, p, root, t } from './lexical'

const hierarchySnippet = `import type { CollectionConfig } from 'payload'

export const Categories: CollectionConfig = {
  slug: 'categories',
  admin: { useAsTitle: 'title' },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'slug', type: 'slug', useAsSlug: 'title' },
  ],
  // Built-in tree: adds a \`parent\` field and a Categories tab
  // in the admin sidebar where you can browse and rearrange it
  hierarchy: {
    parentFieldName: 'parent',
    slugField: 'slug',
  },
}`

export const post1 = ({
  heroImage,
  blockImage,
}: {
  heroImage: Media
  blockImage: Media
}): PostContent => ({
  slug: 'whats-new-in-payload-4',
  title: "What's New in Payload 4",
  heroImage: heroImage.id,
  content: root([
    h('h2', 'A tour of the Payload 4 features this template puts to work.'),
    demoDisclaimer(),
    banner('warning', [
      p(
        t('Payload 4 is in beta', BOLD),
        t(
          ' at the time of writing. APIs can still change before the stable release, so pin your versions and read the release notes before upgrading.',
        ),
      ),
    ]),
    p(
      t(
        'Payload 4 is the biggest release since Payload moved into Next.js. Many things you used to add with plugins or custom code now ship in the core, and a few defaults changed to be safer. This post walks through what is new, using this template as the example: every feature mentioned here is wired up and ready to try in the ',
      ),
      a('admin panel', '/admin'),
      t('.'),
    ),

    h('h2', 'A redesigned admin panel'),
    p(
      t(
        'The admin UI has been redesigned. SCSS is gone: the admin is styled with plain CSS and design tokens (CSS custom properties), so theming it means overriding a handful of variables instead of fighting compiled styles.',
      ),
    ),
    p(
      t('The dashboard is now '),
      t('modular', BOLD),
      t(
        '. It is built from widgets that each editor can add, move and resize. Projects can register their own widgets, and this template adds a ',
      ),
      t('Pending comments', BOLD),
      t(' widget so moderators see new comments the moment they sign in.'),
    ),

    h('h2', 'Organising content: hierarchy, tags and folders'),
    p(
      t(
        'Nested categories used to need the nested-docs plugin. In Payload 4 any collection can become a tree with the built-in ',
      ),
      t('hierarchy', CODE),
      t(
        ' option. The categories on this site use it: Technology is the parent of Content Management, E-commerce and Self-hosting, and you can rearrange the tree from its own tab in the admin sidebar.',
      ),
    ),
    code('typescript', hierarchySnippet),
    p(
      t('Tags are a first-class concept too. A collection with the '),
      t('tags', CODE),
      t(' option becomes a tag set, and '),
      t('createTagField()', CODE),
      t(
        ' adds the matching field to any collection that should be tagged. Posts in this template use tags alongside categories.',
      ),
    ),
    p(
      t(
        'Uploads get folders and a grid view, so the media library behaves more like a file browser than a long table: sort images into folders and browse them as thumbnails.',
      ),
    ),

    h('h2', 'Built for AI agents'),
    p(
      t('The official '),
      t('MCP plugin', BOLD),
      t(
        ' exposes your collections to AI agents and other MCP clients. Agents authenticate with a user API key and go through exactly the same access control as that user, so an agent can only do what its user is allowed to do. This template exposes posts, pages, categories, tags, media and comments at ',
      ),
      t('/api/mcp', CODE),
      t(', and adds a custom tool for moderating comments.'),
    ),
    p(
      t('Each collection can also carry '),
      t('llmInstructions', CODE),
      t(
        ': plain-language guidance for agents, such as "save posts as drafts unless asked to publish" or "never edit the text of a visitor comment". The instructions live next to the schema, so every MCP client gets the same house rules.',
      ),
    ),

    h('h2', 'Publishing workflow'),
    p(
      t(
        'Scheduled publishing runs on the jobs queue, and the queue can run inside the server itself. On a long-running host like Railway there is no separate worker or external cron to set up: schedule a post, and it goes live on time.',
      ),
    ),
    p(
      t('Versions are on by default, and every document records who created it and who last changed it ('),
      t('createdBy', CODE),
      t(' and '),
      t('updatedBy', CODE),
      t('). Combined with drafts and live preview, editors can always see what changed, when, and by whom.'),
    ),

    h('h2', 'Safer by default'),
    p(
      t('The Local API now enforces access control by default: '),
      t('overrideAccess', CODE),
      t(' defaults to '),
      t('false', CODE),
      t(
        '. Server code that should bypass access control has to say so explicitly, which removes a whole class of accidental data leaks. The seed script that created this post passes ',
      ),
      t('overrideAccess: true', CODE),
      t(' on purpose, for exactly that reason.'),
    ),

    media(blockImage),

    h('h2', 'Images and storage'),
    p(
      t('Image processing moved out of the core into '),
      t('@payloadcms/transformer-sharp', CODE),
      t(', and resized versions of an image are now called '),
      t('variants', BOLD),
      t('. Storage adapters are configured under a new top-level '),
      t('storage', CODE),
      t(
        ' key instead of as plugins. This template writes uploads to local disk by default, and switches to any S3-compatible bucket (such as a Railway Bucket) when the S3 variables are set.',
      ),
    ),

    h('h2', 'New requirements, and a second framework'),
    p(
      t(
        'Payload 4 requires Node.js 24, Next.js 16.4 and TypeScript 6. Next.js is no longer the only option either: the new TanStack Start adapter lets you run Payload inside a TanStack Start app instead. This template stays on Next.js.',
      ),
    ),

    h('h2', 'Try it yourself'),
    p(
      t('Everything above is live on this site. Open the '),
      a('admin panel', '/admin'),
      t(
        ', browse the category tree, approve a comment from the dashboard widget, or connect an MCP client. The full source is ',
      ),
      a('on GitHub', 'https://github.com/rpuls/payload-4-boilerplate'),
      t('.'),
    ),
  ]),
  meta: {
    title: "What's New in Payload 4",
    description:
      'A practical tour of Payload 4: the redesigned admin, dashboard widgets, nested categories, tags, folders, MCP for AI agents, scheduled publishing and safer defaults.',
    image: heroImage.id,
  },
})
