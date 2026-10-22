import type { Media } from '@/payload-types'

import type { PostContent } from './types'
import { a, banner, BOLD, bullet, demoDisclaimer, h, p, root, t } from './lexical'

const articleURL = 'https://funkyton.com/i-self-hosted-my-password-manager-for-3-months-should-you/'
const deployURL = 'https://railway.com/deploy/vaultwarden-3?referralCode=-Yg50p'

export const post5 = ({ heroImage }: { heroImage: Media }): PostContent => ({
  slug: 'self-hosted-password-manager-vaultwarden',
  title: 'I self-hosted my password manager for 3 months. Should you?',
  heroImage: heroImage.id,
  content: root([
    h('h2', 'Vaultwarden replaced Google Password Manager, and with it the last reason to stay on Chrome.'),
    demoDisclaimer(),
    p(
      t(
        'Three months later the answer is yes, this setup is staying. But it is definitely not for everyone.',
      ),
    ),
    p(
      t(
        "Google Password Manager synced reliably across every device, which made it the hardest thing to leave behind when moving from Chrome to Firefox. Vaultwarden turned out to be a much easier move than photos or documents had been.",
      ),
    ),

    h('h2', 'Vaultwarden or Bitwarden?'),
    p(
      t('Bitwarden', BOLD),
      t(' is the official open-source password manager, with its own apps and hosted service. '),
      t('Vaultwarden', BOLD),
      t(
        ' is a lighter, unofficial server that works with the official Bitwarden apps and browser extensions. You keep the polished clients and run a server small enough for a home machine.',
      ),
    ),

    h('h2', 'The migration was easy'),
    p(
      t(
        'Vaultwarden imports from Google Password Manager, KeePass, 1Password, LastPass, Dashlane and more. Merging two sources and cleaning out duplicates took one evening.',
      ),
    ),
    banner(
      'warning',
      [
        p(
          t(
            'Password exports are usually unencrypted. Delete them as soon as the import is done, and never leave them in a synced folder.',
          ),
        ),
      ],
      'Careful with exports',
    ),

    h('h2', 'What it does better'),
    bullet('More than passwords', 'SSH keys, API keys, client IDs and secure notes live in the same vault'),
    bullet('Richer logins', 'hidden custom fields, several URLs per login and website icons'),
    bullet(
      'Smarter matching',
      'host-level matching stops credentials from showing up on unrelated subdomains, which matters when you self-host many apps',
    ),

    h('h2', 'The trade-offs'),
    p(
      t(
        'The Bitwarden extension does not always offer to save a new signup, so sometimes you create the login yourself and paste the generated password. The bigger trade-off is responsibility: security, updates, backups and recovery are now yours. That is the price of control.',
      ),
    ),

    h('h2', 'Try it yourself'),
    p(
      t(
        'Running a password manager at home is not a beginner project if you have to handle networking and security yourself. The easier ways in are a ',
      ),
      a('one-click Railway deployment', deployURL),
      t(' with HTTPS handled for you, or installing it through '),
      a('My Own Suite', 'https://myownsuite.org/'),
      t(
        ', which also takes care of nightly backups. Export your passwords, import them, use it on your phone and browser for half an hour, and then decide.',
      ),
    ),

    banner(
      'success',
      [
        p(
          t('Try it: ', BOLD),
          a('Deploy Vaultwarden on Railway', deployURL),
          t(' · '),
          a('Read the full article on FUNKYTON', articleURL),
        ),
      ],
      'Try it',
    ),
  ]),
  meta: {
    title: 'I self-hosted my password manager for 3 months. Should you?',
    description:
      'Three months with Vaultwarden instead of Google Password Manager: the migration, what works better, the trade-offs, and how to try it yourself.',
    image: heroImage.id,
  },
})
