import type { CollectionSlug, File, Payload, PayloadRequest } from 'payload'

import { randomBytes } from 'crypto'
import { promises as fs } from 'fs'
import path from 'path'

import type { Media, Post } from '@/payload-types'

import { contactForm as contactFormData } from './contact-form'
import { contact as contactPageData } from './contact-page'
import { home } from './home'
import { images, type SeedImageKey } from './media'
import { post1 } from './post-1'
import { post2 } from './post-2'
import { post3 } from './post-3'
import { post4 } from './post-4'
import { post5 } from './post-5'
import { post6 } from './post-6'
import type { PostContent } from './types'

// Resolved from the working directory, not import.meta.url: in production the seed runs from
// the compiled .next bundle, while `next start` (locally and on Railway) runs from the repo root.
const assetsDir = path.resolve(process.cwd(), 'src/endpoints/seed/assets')

// Cleared with the database adapter directly (fast, no hooks). Comments go first because they
// reference posts. Media is handled separately below, and redirects are left untouched.
const collections: CollectionSlug[] = [
  'comments',
  'posts',
  'pages',
  'categories',
  'tags',
  'forms',
  'form-submissions',
  'search',
]

const globals = ['header', 'footer'] as const

const demoAuthorEmail = 'demo-author@example.com'

const categoryTree = {
  Technology: ['Content Management', 'E-commerce', 'Self-hosting'],
  News: [],
} as const satisfies Record<string, readonly string[]>

type ParentCategory = keyof typeof categoryTree
type CategoryTitle = ParentCategory | (typeof categoryTree)[ParentCategory][number]

const tagTitles = [
  'Payload',
  'Next.js',
  'Railway',
  'Open Source',
  'E-commerce',
  'Self-hosting',
  'Privacy',
  'Tutorial',
] as const

type TagTitle = (typeof tagTitles)[number]

const slugify = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

async function loadAsset(filename: string): Promise<File> {
  const data = await fs.readFile(path.join(assetsDir, filename))

  return {
    name: filename,
    data,
    mimetype: 'image/webp',
    size: data.byteLength,
  }
}

type SeedComment = {
  post: Post
  name: string
  content: string
  status: 'approved' | 'pending'
  publishedDaysAgo?: number
}

// Next.js revalidation errors are normal when seeding the database without a server running
// i.e. calling `seed` from a script instead of using the admin UI within an active app.
// These error messages can be ignored: `Error hitting revalidate route for...`
export const seed = async ({
  payload,
  req,
}: {
  payload: Payload
  req: PayloadRequest
}): Promise<void> => {
  payload.logger.info('Seeding database...')

  // Every Local API call below shares `req` (and with it any transaction), so the calls run
  // one after another instead of in parallel.

  payload.logger.info(`— Clearing collections and globals...`)

  for (const global of globals) {
    await payload.updateGlobal({
      slug: global,
      data: { navItems: [] },
      depth: 0,
      context: { disableRevalidate: true },
      overrideAccess: true,
      req,
    })
  }

  for (const collection of collections) {
    await payload.db.deleteMany({ collection, req, where: {} })

    if (payload.collections[collection].config.versions) {
      await payload.db.deleteVersions({ collection, req, where: {} })
    }
  }

  // Media goes through the Local API so the stored files (local disk or S3) are removed too
  const deletedMedia = await payload.delete({
    collection: 'media',
    where: { id: { exists: true } },
    depth: 0,
    overrideAccess: true,
    req,
  })

  if (deletedMedia.errors.length > 0) {
    payload.logger.warn(
      `— Could not delete ${deletedMedia.errors.length} media file(s), removing their database records only`,
    )
    await payload.db.deleteMany({ collection: 'media', req, where: {} })
  }

  payload.logger.info(`— Seeding demo author...`)

  await payload.delete({
    collection: 'users',
    depth: 0,
    where: { email: { equals: demoAuthorEmail } },
    overrideAccess: true,
    req,
  })

  // The demo author only exists to be credited on posts. Its password is random and never
  // stored or shown anywhere, so nobody can sign in as it.
  const demoAuthor = await payload.create({
    collection: 'users',
    depth: 0,
    data: {
      name: 'Demo Author',
      email: demoAuthorEmail,
      password: randomBytes(24).toString('base64url'),
      roles: ['editor'],
    },
    overrideAccess: true,
    req,
  })

  payload.logger.info(`— Seeding media...`)

  const media = {} as Record<SeedImageKey, Media>

  for (const key of Object.keys(images) as SeedImageKey[]) {
    media[key] = await payload.create({
      collection: 'media',
      depth: 0,
      data: images[key].data,
      file: await loadAsset(images[key].file),
      overrideAccess: true,
      req,
    })
  }

  payload.logger.info(`— Seeding categories and tags...`)

  const categories = {} as Record<CategoryTitle, number>

  // Parents first, so the children can point at them
  for (const parentTitle of Object.keys(categoryTree) as ParentCategory[]) {
    const parent = await payload.create({
      collection: 'categories',
      depth: 0,
      data: { title: parentTitle, slug: slugify(parentTitle) },
      overrideAccess: true,
      req,
    })
    categories[parentTitle] = parent.id

    for (const childTitle of categoryTree[parentTitle]) {
      const child = await payload.create({
        collection: 'categories',
        depth: 0,
        data: { title: childTitle, slug: slugify(childTitle), parent: parent.id },
        overrideAccess: true,
        req,
      })
      categories[childTitle] = child.id
    }
  }

  const tags = {} as Record<TagTitle, number>

  for (const title of tagTitles) {
    const tag = await payload.create({
      collection: 'tags',
      depth: 0,
      data: { title, slug: slugify(title) },
      overrideAccess: true,
      req,
    })
    tags[title] = tag.id
  }

  payload.logger.info(`— Seeding posts...`)

  const createPost = (
    content: PostContent,
    taxonomy: { categories: CategoryTitle[]; tags: TagTitle[]; publishedDaysAgo: number },
  ): Promise<Post> =>
    payload.create({
      collection: 'posts',
      depth: 0,
      context: { disableRevalidate: true },
      data: {
        ...content,
        _status: 'published',
        authors: [demoAuthor.id],
        categories: taxonomy.categories.map((title) => categories[title]),
        _h_tags: taxonomy.tags.map((title) => tags[title]),
        publishedAt: daysAgo(taxonomy.publishedDaysAgo),
      },
      overrideAccess: true,
      req,
    })

  // Created one at a time and in this order on purpose: posts are listed by `-createdAt`,
  // so the last one created (the Medusa store launch) appears first on /posts and on the home page.
  const whatsNewPost = await createPost(
    post1({ heroImage: media.payloadCover, blockImage: media.payloadAdminCover }),
    { categories: ['Content Management'], tags: ['Payload', 'Next.js'], publishedDaysAgo: 4 },
  )

  const gettingStartedPost = await createPost(
    post2({ heroImage: media.payloadAdminCover, blockImage: media.payloadCover }),
    {
      categories: ['Content Management', 'News'],
      tags: ['Payload', 'Railway', 'Tutorial'],
      publishedDaysAgo: 3,
    },
  )

  const seafilePost = await createPost(post4({ heroImage: media.seafileCover }), {
    categories: ['Self-hosting'],
    tags: ['Self-hosting', 'Open Source', 'Railway'],
    publishedDaysAgo: 2,
  })

  const vaultwardenPost = await createPost(post5({ heroImage: media.vaultwardenCover }), {
    categories: ['Self-hosting'],
    tags: ['Self-hosting', 'Privacy', 'Railway'],
    publishedDaysAgo: 1,
  })

  const mosPost = await createPost(
    post6({
      heroImage: media.mosInstall,
      catalogImage: media.mosCatalog,
      privacyImage: media.mosPrivacy,
    }),
    {
      categories: ['Self-hosting'],
      tags: ['Self-hosting', 'Privacy', 'Open Source'],
      publishedDaysAgo: 0.5,
    },
  )

  const medusaPost = await createPost(
    post3({
      heroImage: media.medusaServices,
      coverImage: media.medusaLaunchCover,
      stackImage: media.medusaStack,
    }),
    {
      categories: ['E-commerce'],
      tags: ['E-commerce', 'Railway', 'Open Source', 'Tutorial'],
      publishedDaysAgo: 0,
    },
  )

  const relatedPosts: [Post, Post[]][] = [
    [whatsNewPost, [gettingStartedPost, medusaPost]],
    [gettingStartedPost, [whatsNewPost, medusaPost]],
    [seafilePost, [mosPost, vaultwardenPost]],
    [vaultwardenPost, [mosPost, seafilePost]],
    [mosPost, [medusaPost, seafilePost, vaultwardenPost]],
    [medusaPost, [mosPost, gettingStartedPost]],
  ]

  for (const [post, related] of relatedPosts) {
    await payload.update({
      id: post.id,
      collection: 'posts',
      depth: 0,
      data: { relatedPosts: related.map((relatedPost) => relatedPost.id) },
      overrideAccess: true,
      req,
    })
  }

  payload.logger.info(`— Seeding comments...`)

  // No comments on the "What's New" post: the e2e tests use it and expect it to start empty.
  // Approved comments get a fixed `publishedAt` so they always appear in the same order.
  const comments: SeedComment[] = [
    {
      post: medusaPost,
      name: 'Priya Raman',
      content:
        'Used the Railway template for a client shop last month. Having the storefront and backend share the API key automatically saved me a surprising amount of fiddling.',
      status: 'approved',
      publishedDaysAgo: 1,
    },
    {
      post: mosPost,
      name: 'Jonas Becker',
      content:
        'Put this on an old ThinkPad over the weekend. Photos and passwords are moved over, and the privacy grades made picking apps a lot easier.',
      status: 'approved',
      publishedDaysAgo: 0.5,
    },
    {
      post: mosPost,
      name: 'Amara Okafor',
      content:
        'The part about verifying restores sold me. Most self-hosting guides stop at "make a backup" and never mention testing it.',
      status: 'approved',
      publishedDaysAgo: 0.25,
    },
    {
      post: mosPost,
      name: 'Lucas Martin',
      content: 'Does the USB installer work on ARM machines like a Raspberry Pi, or is it x86 only?',
      status: 'pending',
    },
  ]

  for (const comment of comments) {
    await payload.create({
      collection: 'comments',
      depth: 0,
      context: { disableRevalidate: true },
      data: {
        content: comment.content,
        author: {
          name: comment.name,
          email: `${slugify(comment.name)}@example.com`,
        },
        post: comment.post.id,
        status: comment.status,
        ...(comment.publishedDaysAgo !== undefined && {
          publishedAt: daysAgo(comment.publishedDaysAgo),
        }),
      },
      overrideAccess: true,
      req,
    })
  }

  payload.logger.info(`— Seeding contact form...`)

  const contactForm = await payload.create({
    collection: 'forms',
    depth: 0,
    data: contactFormData,
    overrideAccess: true,
    req,
  })

  payload.logger.info(`— Seeding pages...`)

  await payload.create({
    collection: 'pages',
    depth: 0,
    data: home({ heroImage: media.hero }),
    overrideAccess: true,
    req,
  })

  const contactPage = await payload.create({
    collection: 'pages',
    depth: 0,
    data: contactPageData({ contactForm }),
    overrideAccess: true,
    req,
  })

  payload.logger.info(`— Seeding globals...`)

  await payload.updateGlobal({
    slug: 'header',
    data: {
      navItems: [
        {
          link: {
            type: 'custom',
            label: 'Posts',
            url: '/posts',
          },
        },
        {
          link: {
            type: 'reference',
            label: 'Contact',
            reference: {
              relationTo: 'pages',
              value: contactPage.id,
            },
          },
        },
      ],
    },
    overrideAccess: true,
    req,
  })

  await payload.updateGlobal({
    slug: 'footer',
    data: {
      navItems: [
        {
          link: {
            type: 'custom',
            label: 'Admin',
            url: '/admin',
          },
        },
        {
          link: {
            type: 'custom',
            label: 'Source Code',
            newTab: true,
            url: 'https://github.com/rpuls/payload-4-boilerplate',
          },
        },
        {
          link: {
            type: 'custom',
            label: 'Payload 3 version',
            newTab: true,
            url: 'https://github.com/rpuls/payload-3-boilerplate',
          },
        },
        {
          link: {
            type: 'custom',
            label: 'Payload',
            newTab: true,
            url: 'https://payloadcms.com/',
          },
        },
      ],
    },
    overrideAccess: true,
    req,
  })

  payload.logger.info('Seeded database successfully!')
}
