import type { Media } from '@/payload-types'

import type { PostContent } from './types'
import { a, banner, BOLD, bullet, h, ITALIC, media, p, root, t } from './lexical'

const guideURL = 'https://funkyton.com/medusajs-2-0-is-finally-here/'
const repoURL = 'https://github.com/rpuls/medusajs-2.0-for-railway-boilerplate'
const deployURL = 'https://railway.com/deploy/medusajs-2-0-storefront?referralCode=-Yg50p'
const trialURL = 'https://railway.com/deploy/medusajs-20-storefront-trial--Fb6KUX?referralCode=-Yg50p'
const medusaAIDocsURL = 'https://docs.medusajs.com/learn/introduction/build-with-llms-ai'

const prompt = (text: string) => p(t('• '), t(`“${text}”`, ITALIC))

// The cover has its own headline, so it is the card and social image and opens the article.
// The hero stays a dark screenshot, because the post title is printed on top of the hero.
export const post3 = ({
  heroImage,
  coverImage,
  stackImage,
}: {
  heroImage: Media
  coverImage: Media
  stackImage: Media
}): PostContent => ({
  slug: 'launch-online-store-medusa-railway',
  title: 'Launch a real online store in minutes, then let AI agents make it yours',
  heroImage: heroImage.id,
  content: root([
    h(
      'h2',
      'Vibe coding a webshop from scratch is the slow way to start a business. Deploy a proven commerce engine in one click, then point your AI agent at the parts that make your store different.',
    ),
    media(coverImage),

    p(
      t(
        'AI agents have made building software feel almost free. Describe an app, wait a few minutes, and something that looks finished appears on your screen. So it is tempting to open your agent and type: ',
      ),
      t('build me a webshop.', ITALIC),
    ),
    p(
      t(
        'You will get one. It will have product pages, a cart and a checkout button. It will look done. That is exactly the problem.',
      ),
    ),

    h('h2', "Why you shouldn't vibe code a webshop from zero"),
    p(
      t(
        "The storefront is the easy ten percent of e-commerce. The other ninety percent is invisible until it breaks, and when commerce breaks, it breaks with someone's money:",
      ),
    ),
    bullet(
      'Payments',
      'authorizing, capturing and refunding, 3-D Secure, and webhooks that arrive late, twice or out of order',
    ),
    bullet(
      'Checkout',
      'carts that live across sessions, discounts that stack, and taxes that depend on where the customer lives',
    ),
    bullet('Inventory', 'stock that stays right when two people buy the last item at the same moment'),
    bullet('Fulfilment', 'shipping options, partial shipments, returns, exchanges and claims'),
    bullet('Order emails', 'confirmations and password resets that have to arrive, every single time'),
    bullet('Admin', 'a dashboard where you, not a developer, manage products, orders and customers'),
    p(
      t(
        "An agent can write code for every one of these in an afternoon. What it can't do is test them the way a real store gets tested: with real cards, real carriers, real customers who do unexpected things, and months of edge cases. Checking all of that yourself takes weeks, and every bug you miss is a double charge, a lost order or a customer who never comes back.",
      ),
    ),

    h('h2', 'Medusa has already done the hard part'),
    p(
      a('Medusa', 'https://medusajs.com/'),
      t(
        ' is an open-source commerce platform used by businesses around the world. Payments, carts, taxes, regions and currencies, inventory across warehouses, fulfilment, returns, promotions, customer accounts and a full admin dashboard are all built in.',
      ),
    ),
    p(
      t(
        'More importantly, they are proven. Medusa has a large community, and its features have been stress-tested in more combinations of products, countries, payment providers and edge cases than any single team, or any agent, could ever simulate. When something does go wrong, someone has usually hit it before you, and the fix is already in a release.',
      ),
    ),
    p(
      t(
        "So you don't just get a head start. You get a foundation that is far more likely to still be standing in two years.",
      ),
    ),
    p(
      t('No flavors, on purpose. ', BOLD),
      t(
        'Out of the box the store is deliberately plain: a clean storefront and a complete backend, with no opinions about your brand or your business. That is exactly what you want to hand to an AI agent.',
      ),
    ),

    h('h2', 'A foundation built for AI-driven development'),
    p(
      t(
        'Agents do their best work on ground that is solid, well documented and testable. This template gives them all three:',
      ),
    ),
    bullet(
      'Plain, unforked Medusa',
      'the core is untouched, so the official docs apply, the patterns your agent already knows are the right ones, and new Medusa releases are a dependency update away',
    ),
    p(
      t('• Docs written for agents: ', BOLD),
      t('Medusa publishes an llms.txt index, a docs MCP server and agent skills. See '),
      a('Build with AI', medusaAIDocsURL),
      t(' in the Medusa docs.'),
    ),
    bullet(
      'Clear places to build',
      'modules, workflows, API routes, subscribers and admin widgets, so new features land where they belong instead of in a patched core',
    ),
    bullet(
      'TypeScript from end to end',
      'backend and Next.js storefront, so mistakes show up while the agent works, not when a customer checks out',
    ),
    bullet(
      'A safety net',
      'type checking and linting on every pull request, a Playwright suite for the main storefront flows, and a docker compose setup that mirrors the Railway services, so an agent can run the whole stack locally and check its own work',
    ),

    h('h2', 'Then tell your agent what makes your store yours'),
    p(
      t(
        'This is where it gets fun. You bring the idea, your agent brings the speed, and Medusa keeps the commerce honest. Some first prompts:',
      ),
    ),
    prompt('Restyle the storefront to match our brand: warm earth tones, a serif headline font and big product photos.'),
    prompt('Add a gift message field at checkout and include it in the order confirmation email.'),
    prompt('Create a Medusa module for product bundles, with an admin widget to manage them.'),
    prompt('Set up Stripe in test mode and add an end-to-end test that buys a product from start to finish.'),
    p(
      t(
        'Each of these is a focused change on top of a checkout thousands of stores already trust. Built from zero, each one would sit on top of a checkout nobody has tested.',
      ),
    ),

    h('h2', 'From one click to a live store in minutes'),
    p(
      t('The '),
      a('Medusa 2.0 Railway template', deployURL),
      t(
        " deploys the official Medusa release together with the Medusa team's Next.js storefront, and wires everything up for you:",
      ),
    ),
    bullet(
      'Seven connected services',
      'storefront, backend with admin, Postgres, Redis, MeiliSearch, a storage bucket and a small read-only image proxy',
    ),
    bullet(
      'Ready on first boot',
      'migrations run, demo products are seeded, and an admin user is created with a strong random password',
    ),
    bullet(
      'Keys handled',
      'the publishable API key is shared with the storefront, and the search key is created and the catalogue indexed',
    ),
    bullet('Health checks on every service', 'when Railway shows green, your store is live'),
    bullet('Payments and email ready to switch on', 'add your Stripe and Resend keys when you are ready to take real orders'),
    p(
      t('This is not a toy. ', BOLD),
      t(
        'The template has been deployed more than 3,800 times since 2023, and over 1,100 of those stores are still serving customers today.',
      ),
    ),
    media(stackImage),

    h('h2', 'What you need'),
    bullet('A GitHub account', 'and a Railway account connected to it'),
    bullet('Railway Hobby plan', '$5 a month, to run the store in the cloud'),
    bullet('Optional', 'Stripe and Resend API keys, to take payments and send order emails'),
    p(
      t('Just want to look around first? A '),
      a('trial version', trialURL),
      t(
        " fits inside Railway's free tier. It leaves out search and file storage, so use it to explore, not to sell.",
      ),
    ),
    p(
      t('Selling wholesale, or hosting many sellers on one storefront? There are sibling templates for '),
      a('Medusa B2B', 'https://github.com/rpuls/medusa-b2b-for-railway'),
      t(' and the '),
      a('MercurJS marketplace', 'https://github.com/rpuls/mercurjs-for-railway-boilerplate'),
      t('.'),
    ),

    h('h2', 'Your store could be live before your coffee gets cold'),
    p(
      t(
        "Every online business starts the same way: with a store that works. Skip the weeks of plumbing and testing, deploy a commerce engine that is already proven in production, and spend your time, and your agent's, on the part only you can build: your brand, your products and your customers.",
      ),
    ),

    banner(
      'success',
      [
        p(
          t('Launch your store: ', BOLD),
          a('Deploy on Railway', deployURL),
          t(' · '),
          a('Source on GitHub', repoURL),
          t(' · '),
          a('Step-by-step guide and video', guideURL),
        ),
      ],
      'Launch your store',
    ),
  ]),
  meta: {
    title: 'Launch a real online store in minutes, then let AI agents make it yours',
    description:
      "Don't vibe code a webshop from zero. Deploy a proven Medusa store on Railway in one click, then let your AI agent shape it into your business.",
    image: coverImage.id,
  },
})
