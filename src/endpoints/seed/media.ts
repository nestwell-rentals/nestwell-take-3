import type { RequiredDataFromCollectionSlug } from 'payload'

import { a, p, root, t } from './lexical'

type SeedImage = {
  /** File name inside src/endpoints/seed/assets */
  file: string
  data: RequiredDataFromCollectionSlug<'media'>
}

const credit = (label: string, linkText: string, url: string) =>
  root([p(t(`${label} `), a(linkText, url), t('.'))])

// MOS screenshots come from https://github.com/rpuls/my-own-suite/tree/main/site/src/assets/screenshots
const mosCredit = (label: string, url: string) =>
  root([p(t(`${label} — screenshot from `), a('My Own Suite', url), t('.'))])

export const images = {
  hero: {
    file: 'hero.webp',
    data: {
      alt: 'Straight metallic shapes with a blue gradient',
    },
  },
  payloadCover: {
    file: 'payload-cover.webp',
    data: {
      alt: 'The Payload admin editing a page, its navigation menu and an image crop, next to the website it powers',
      caption: credit('Graphic by', 'Payload', 'https://payloadcms.com/'),
    },
  },
  payloadAdminCover: {
    file: 'payload-admin-cover.webp',
    data: {
      alt: 'The Payload admin panel with live preview of a page, side by side with the rendered website',
      caption: credit('Graphic by', 'Payload', 'https://payloadcms.com/'),
    },
  },
  medusaLaunchCover: {
    file: 'medusa-launch-cover.webp',
    data: {
      alt: 'Your own webshop in minutes: click Deploy template, the store is live in 3 minutes, then an AI assistant customizes an outdoor gear shop called Trailhead for your brand',
    },
  },
  medusaServices: {
    file: 'medusa-railway-services.webp',
    data: {
      alt: 'A Railway project with the Medusa storefront, backend, MeiliSearch, Postgres, Redis, bucket and bucket proxy all online',
      caption: credit(
        'One click, seven services online. Screenshot from the',
        'Medusa 2.0 Railway boilerplate',
        'https://github.com/rpuls/medusajs-2.0-for-railway-boilerplate',
      ),
    },
  },
  medusaStack: {
    file: 'medusa-railway-stack.webp',
    data: {
      alt: 'Architecture diagram: shoppers use the Next.js storefront, which calls the Medusa backend; the backend uses Postgres, Redis, MeiliSearch and a bucket inside one Railway project, and calls Stripe and Resend outside it',
      caption: credit(
        'How the services fit together. Diagram from the',
        'Medusa 2.0 Railway boilerplate',
        'https://github.com/rpuls/medusajs-2.0-for-railway-boilerplate',
      ),
    },
  },
  seafileCover: {
    file: 'seafile-onlyoffice-cover.webp',
    data: {
      alt: 'Seafile and ONLYOFFICE logos next to a private cloud file browser on desktop and phone',
      caption: credit(
        'Graphic by',
        'FUNKYTON',
        'https://funkyton.com/goodbye-google-drive-my-self-hosted-drive-and-docs-replacement/',
      ),
    },
  },
  vaultwardenCover: {
    file: 'vaultwarden-cover.webp',
    data: {
      alt: 'A road leaving a night-time city under the Chrome logo, crossing a bridge to a house with Bitwarden and Vaultwarden logos under a Firefox sun',
      caption: credit(
        'Graphic by',
        'FUNKYTON',
        'https://funkyton.com/i-self-hosted-my-password-manager-for-3-months-should-you/',
      ),
    },
  },
  mosInstall: {
    file: 'mos-app-detail-install.webp',
    data: {
      alt: 'An app detail view in My Own Suite showing what the app replaces, its privacy grade, and a single Install button',
      caption: mosCredit(
        'Every app says what it replaces, and installs in one click',
        'https://myownsuite.org/docs/apps/',
      ),
    },
  },
  mosCatalog: {
    file: 'mos-app-catalog.webp',
    data: {
      alt: 'The My Own Suite app catalog, listing self-hosted apps for photos, calendars, files, PDFs and passwords',
      caption: mosCredit('Pick apps from the browser, no terminal required', 'https://myownsuite.org/'),
    },
  },
  mosPrivacy: {
    file: 'mos-privacy-posture.webp',
    data: {
      alt: 'A My Own Suite privacy posture card grading an app on telemetry, external services, accounts, data processing and policies',
      caption: mosCredit(
        'Every catalog app is graded A to D, with the evidence published',
        'https://myownsuite.org/docs/privacy/how-we-assess/',
      ),
    },
  },
} satisfies Record<string, SeedImage>

export type SeedImageKey = keyof typeof images
