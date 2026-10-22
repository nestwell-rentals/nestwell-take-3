import type { Media } from '@/payload-types'

import type { PostContent } from './types'
import { a, banner, BOLD, bullet, demoDisclaimer, h, p, root, t } from './lexical'

const articleURL = 'https://funkyton.com/goodbye-google-drive-my-self-hosted-drive-and-docs-replacement/'
const deployURL = 'https://railway.com/deploy/seafile-onlyoffice?referralCode=-Yg50p'

export const post4 = ({ heroImage }: { heroImage: Media }): PostContent => ({
  slug: 'goodbye-google-drive-seafile-onlyoffice',
  title: 'Goodbye Google Drive: a self-hosted Drive and Docs replacement',
  heroImage: heroImage.id,
  content: root([
    h('h2', 'After two years of testing self-hosted cloud storage, Seafile and ONLYOFFICE are the first setup worth switching to.'),
    demoDisclaimer(),
    p(
      t(
        'Replacing Google Drive is not just about storing files. A real alternative has to do three things well: store files, sync them across every device, and let you edit documents in the browser. Most self-hosted tools get one or two of those right.',
      ),
    ),

    h('h2', 'What did not stick'),
    bullet(
      'Nextcloud',
      'does everything, but the interface is crowded, iOS photo backup failed silently, and the office integration was fragile',
    ),
    bullet('Cloudreve', 'a polished interface, but no proper office suite integration'),
    bullet('Filebrowser', 'great for quick file access, but no sync, sharing or editing'),
    bullet('Syncthing', 'excellent pure file sync, but no cloud interface, sharing or documents'),

    h('h2', 'Why Seafile and ONLYOFFICE made the cut'),
    p(
      t('Seafile', BOLD),
      t(
        ' handles files and nothing else, and does it well: fast sync, clean organization, password-protected share links and rock-solid stability.',
      ),
    ),
    p(
      t('ONLYOFFICE', BOLD),
      t(
        ' adds the Docs part: Word, Excel and PowerPoint files open straight from Seafile in the browser, with real-time collaboration, comments and track changes.',
      ),
    ),
    p(
      t(
        'As a bonus, ONLYOFFICE can connect to an AI provider of your choice, or a model you host yourself, for translation, grammar and writing help. Your documents are not locked into one vendor\'s AI.',
      ),
    ),

    h('h2', 'The trade-offs'),
    p(
      t(
        "Seafile's interface is good, but not the most modern, and Cloudreve wins on looks. There were a few small caching quirks along the way. None of it got in the way of daily use.",
      ),
    ),

    h('h2', 'Try it in minutes'),
    p(
      t('The '),
      a('Seafile + ONLYOFFICE Railway template', deployURL),
      t(
        ' deploys both apps already connected to each other. Railway’s free trial is enough to try it; keeping it running needs the Hobby plan. After the deploy, open the public URL, sign in with the generated Seafile credentials and create your own user.',
      ),
    ),
    p(
      t('Seafile and ONLYOFFICE are also part of '),
      a('My Own Suite', 'https://myownsuite.org/'),
      t(', which installs them on a machine you own with a single click.'),
    ),

    banner(
      'success',
      [
        p(
          t('Try it: ', BOLD),
          a('Deploy on Railway', deployURL),
          t(' · '),
          a('Read the full article on FUNKYTON', articleURL),
        ),
      ],
      'Try it',
    ),
  ]),
  meta: {
    title: 'Goodbye Google Drive: a self-hosted Drive and Docs replacement',
    description:
      'Seafile and ONLYOFFICE together replace Google Drive and Docs: file sync, sharing and real-time document editing on your own server.',
    image: heroImage.id,
  },
})
