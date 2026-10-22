import type { RequiredDataFromCollectionSlug } from 'payload'

import { a, h, p, root, t } from './lexical'

// Shown on the home page until the database has been seeded
export const homeStatic: RequiredDataFromCollectionSlug<'pages'> = {
  slug: 'home',
  _status: 'published',
  hero: {
    type: 'lowImpact',
    richText: root([
      h('h1', 'Payload 4 Website Template'),
      p(
        a('Visit /admin', '/admin'),
        t(' to create your first user, then use the "Seed your database" button to add demo content.'),
      ),
    ]),
  },
  meta: {
    description: 'An open-source website built with Payload 4, Next.js and PostgreSQL.',
    title: 'Payload 4 Website Template',
  },
  title: 'Home',
  layout: [],
}
