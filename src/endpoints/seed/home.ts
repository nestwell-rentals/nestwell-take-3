import type { RequiredDataFromCollectionSlug } from 'payload'
import type { Media } from '@/payload-types'

import { a, BOLD, h, p, root, t } from './lexical'

const repoURL = 'https://github.com/rpuls/payload-4-boilerplate'
// Points at the README's Railway section, which holds the one-click deploy button
const deployURL = `${repoURL}#railway-setup`

type HomeArgs = {
  heroImage: Media
}

const feature = (title: string, text: string) => ({
  size: 'oneThird' as const,
  enableLink: false,
  richText: root([h('h3', title), p(t(text))]),
})

export const home = ({ heroImage }: HomeArgs): RequiredDataFromCollectionSlug<'pages'> => ({
  slug: 'home',
  _status: 'published',
  title: 'Home',
  hero: {
    type: 'highImpact',
    media: heroImage.id,
    richText: root([
      h('h1', 'Payload 4 + Railway Website Starter'),
      p(
        t(
          'A complete website built on Payload 4, Next.js and PostgreSQL: pages, a blog with nested categories and tags, moderated comments, search, SEO and an MCP endpoint for AI agents. Deploy it on Railway in one click, then make it yours from the ',
        ),
        a('admin panel', '/admin'),
        t('.'),
      ),
    ]),
    links: [
      {
        link: {
          type: 'custom',
          appearance: 'default',
          label: 'Read the posts',
          url: '/posts',
        },
      },
      {
        link: {
          type: 'custom',
          appearance: 'outline',
          label: 'Open the admin',
          url: '/admin',
        },
      },
    ],
  },
  layout: [
    {
      blockName: 'Payload 4 features',
      blockType: 'content',
      columns: [
        {
          size: 'full',
          richText: root([
            h('h2', 'Payload 4, put to work'),
            p(
              t('Every feature below is configured and running on this site. '),
              a("Read what's new in Payload 4", '/posts/whats-new-in-payload-4'),
              t(' for the full tour.'),
            ),
          ]),
        },
        feature(
          'Redesigned admin',
          'A rebuilt admin UI styled with CSS tokens, and a modular dashboard with a Pending comments widget added by this template.',
        ),
        feature(
          'Nested categories and tags',
          'Built-in hierarchy turns categories into a tree you can rearrange, and tags label posts across categories.',
        ),
        feature(
          'Media folders and variants',
          'Organise uploads in folders with a grid view. Sharp generates responsive image variants, stored on disk or in an S3 bucket.',
        ),
        feature(
          'AI agents over MCP',
          'MCP clients can draft posts and moderate comments with a user API key, following per-collection instructions and the same access control as that user.',
        ),
        feature(
          'Scheduled publishing',
          'Schedule posts and pages to go live later. The jobs queue runs inside the server, so there is no extra worker to deploy.',
        ),
        feature(
          'Safe defaults',
          'Versions and authorship on every document, and Local API access control that is enforced unless code explicitly opts out.',
        ),
      ],
    },
    {
      blockName: 'Latest posts',
      blockType: 'archive',
      populateBy: 'collection',
      relationTo: 'posts',
      categories: [],
      limit: 3,
      introContent: root([
        h('h2', 'Latest posts'),
        p(
          t('Posts are listed with an '),
          t('Archive', BOLD),
          t(
            ' block: it can pull in the newest posts automatically, filter them by category, or show a hand-picked selection. ',
          ),
          a('See all posts', '/posts'),
          t('.'),
        ),
      ]),
    },
    {
      blockName: 'Get the template',
      blockType: 'cta',
      richText: root([
        h('h3', 'Launch your own site in minutes'),
        p(
          t(
            'This template is open source under the MIT license. Deploy it on Railway with PostgreSQL included, or clone it and build on it locally.',
          ),
        ),
      ]),
      links: [
        {
          link: {
            type: 'custom',
            appearance: 'default',
            label: 'Deploy on Railway',
            newTab: true,
            url: deployURL,
          },
        },
        {
          link: {
            type: 'custom',
            appearance: 'outline',
            label: 'View on GitHub',
            newTab: true,
            url: repoURL,
          },
        },
      ],
    },
  ],
  meta: {
    title: 'Payload 4 Website Template',
    description:
      'An open-source Payload 4, Next.js and PostgreSQL website template with nested categories, tags, moderated comments and MCP, ready to deploy on Railway.',
    image: heroImage.id,
  },
})
