import type { Media } from '@/payload-types'

import type { PostContent } from './types'
import { a, banner, bullet, BOLD, CODE, code, demoDisclaimer, h, media, p, root, t } from './lexical'

const repoURL = 'https://github.com/rpuls/payload-4-boilerplate'

export const post2 = ({
  heroImage,
  blockImage,
}: {
  heroImage: Media
  blockImage: Media
}): PostContent => ({
  slug: 'getting-started-payload-4-template',
  title: 'Getting Started with the Payload 4 Template',
  heroImage: heroImage.id,
  content: root([
    h('h2', 'From one click on Railway to a running site with an admin panel, demo content and AI access.'),
    demoDisclaimer(),
    p(
      t(
        'This template is a complete website built on Payload 4, Next.js and PostgreSQL: pages built from blocks, a blog with nested categories and tags, comments with moderation, search, SEO fields, forms and an MCP endpoint for AI agents. Here is how to get it running and what to do first.',
      ),
    ),

    h('h2', '1. Deploy on Railway'),
    p(
      t('The quickest start is the '),
      t('Deploy on Railway', BOLD),
      t(' button in the '),
      a('repository README', repoURL),
      t('. The template provisions:'),
    ),
    bullet('The app', 'Payload and the Next.js website in a single service, with a health check'),
    bullet('PostgreSQL', 'the database, connected through DATABASE_URL'),
    bullet(
      'A Railway Bucket',
      'private storage for uploaded images, already connected through the S3_* variables, so uploads survive redeploys',
    ),
    bullet(
      'Optional: SMTP',
      'set SMTP_HOST and friends to send real emails such as password resets; without it, emails are written to the server log',
    ),
    p(t('Database migrations run automatically when the app starts, so there is nothing to run by hand.')),

    h('h2', '2. Create your admin account'),
    p(
      t('Open '),
      a('/admin', '/admin'),
      t(' on your new site and create the first user. '),
      t('The first account always becomes an admin.', BOLD),
      t(
        ' Everyone you invite afterwards starts as an editor: editors manage content, while admins also manage users and site setup.',
      ),
    ),

    h('h2', '3. Seed the demo content'),
    p(
      t('The dashboard shows a '),
      t('Seed your database', BOLD),
      t(
        ' button. It fills the site with the pages, posts, categories, tags, images and comments you are looking at right now. Seeding replaces existing content, so use it on a fresh site, and only admins can run it.',
      ),
    ),
    banner('warning', [
      p(
        t('Heads up:', BOLD),
        t(
          ' seeding deletes all pages, posts, media, categories, tags, comments and forms before recreating the demo content. Do not run it on a site with real content.',
        ),
      ),
    ]),

    media(blockImage),

    h('h2', '4. Moderate comments'),
    p(
      t('Visitors can comment on every post. New comments arrive as '),
      t('pending', BOLD),
      t(
        ' and only appear on the site once someone approves them. Approve them from the Comments collection or the Pending comments widget on the dashboard, or let an AI agent do it through the MCP ',
      ),
      t('moderateComment', CODE),
      t(' tool.'),
    ),

    h('h2', '5. Connect an AI agent over MCP'),
    p(
      t(
        'The site speaks the Model Context Protocol, so AI agents and other MCP clients can read and write content for you. In the admin, open your user, enable an API key, and point your MCP client at ',
      ),
      t('/api/mcp', CODE),
      t(' with this header:'),
    ),
    code('typescript', 'Authorization: users API-Key <your-api-key>'),
    p(
      t(
        'The agent acts as that user and gets exactly the same permissions, so consider creating a dedicated editor account for it. Deleting posts, pages and media is disabled over MCP: that stays a human decision.',
      ),
    ),

    h('h2', '6. Develop locally'),
    p(
      t(
        'You need Node.js 24 and Docker. Clone the repository, copy .env.example to .env, then install dependencies and start PostgreSQL and the dev server:',
      ),
    ),
    code(
      'typescript',
      ['corepack pnpm install', 'docker compose up -d postgres', 'corepack pnpm dev'].join('\n'),
    ),
    p(
      t('The site runs on '),
      t('http://localhost:3000', CODE),
      t(
        '. The project also ships Playwright end-to-end tests that walk through onboarding, seeding, the public site, comment moderation and MCP:',
      ),
    ),
    code('typescript', 'corepack pnpm test:e2e'),

    h('h2', 'Looking for Payload 3?'),
    p(
      t(
        'Payload 4 is still in beta. If you would rather build on the stable Payload 3 line, the sibling template has the same idea and the same Railway setup: ',
      ),
      a('payload-3-boilerplate', 'https://github.com/rpuls/payload-3-boilerplate'),
      t('. Issues, ideas and pull requests for this template are welcome on '),
      a('GitHub', repoURL),
      t('.'),
    ),
  ]),
  meta: {
    title: 'Getting Started with the Payload 4 Template',
    description:
      'Deploy the Payload 4 template on Railway, create your admin account, seed demo content, moderate comments, connect an MCP client and develop locally.',
    image: heroImage.id,
  },
})
