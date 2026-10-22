import { randomBytes } from 'crypto'

import type {
  BannerBlock,
  CodeBlock,
  LexicalRichText,
  Media,
  MediaBlock_D6C44817,
  SerializedBlockNode,
  SerializedHeadingNode,
  SerializedLinkNode,
  SerializedParagraphNode,
  SerializedTextNode,
} from '@/payload-types'

// Lexical JSON is verbose. These helpers build the same node shapes the admin editor saves,
// so the seed content reads like the article it is instead of hundreds of lines of JSON.

export const BOLD = 1
export const ITALIC = 2
export const CODE = 16

type Inline = SerializedTextNode | SerializedLinkNode<SerializedTextNode>
type HeadingTag = 'h1' | 'h2' | 'h3' | 'h4'

/** Plain text, optionally formatted (combine flags: `BOLD | ITALIC`). */
export const t = (text: string, format: number = 0): SerializedTextNode => ({
  type: 'text',
  detail: 0,
  format,
  mode: 'normal',
  style: '',
  text,
  version: 1,
})

/** A link. External links (http...) open in a new tab, internal paths stay in the same tab. */
export const a = (
  text: string,
  url: string,
  format: number = 0,
): SerializedLinkNode<SerializedTextNode> => ({
  type: 'link',
  children: [t(text, format)],
  direction: 'ltr',
  fields: {
    linkType: 'custom',
    newTab: url.startsWith('http'),
    url,
  },
  format: '',
  indent: 0,
  version: 3,
})

export const p = (...children: Inline[]): SerializedParagraphNode<Inline> => ({
  type: 'paragraph',
  children,
  direction: 'ltr',
  format: '',
  indent: 0,
  textFormat: 0,
  textStyle: '',
  version: 1,
})

export const h = <Tag extends HeadingTag>(
  tag: Tag,
  text: string,
): SerializedHeadingNode<SerializedTextNode, Tag> => ({
  type: 'heading',
  children: [t(text)],
  direction: 'ltr',
  format: '',
  indent: 0,
  tag,
  version: 1,
})

/** A bullet-style line. Post content has no list feature, so lists are written as paragraphs. */
export const bullet = (label: string, text: string) => p(t(`• ${label}: `, BOLD), t(text))

/** Wraps nodes in a rich text root. The node types are checked against the target field. */
export const root = <Node>(children: Node[]): LexicalRichText<Node> => ({
  root: {
    type: 'root',
    children,
    direction: 'ltr',
    format: '',
    indent: 0,
    version: 1,
  },
})

const blockID = () => randomBytes(12).toString('hex')

export const banner = (
  style: BannerBlock['style'],
  children: SerializedParagraphNode<Inline>[],
  blockName = '',
): SerializedBlockNode<BannerBlock> => ({
  type: 'block',
  fields: {
    id: blockID(),
    blockName,
    blockType: 'banner',
    content: root(children),
    style,
  },
  format: '',
  version: 2,
})

export const media = (doc: Media): SerializedBlockNode<MediaBlock_D6C44817> => ({
  type: 'block',
  fields: {
    id: blockID(),
    blockName: '',
    blockType: 'mediaBlock',
    media: doc.id,
  },
  format: '',
  version: 2,
})

export const code = (
  language: NonNullable<CodeBlock['language']>,
  source: string,
): SerializedBlockNode<CodeBlock> => ({
  type: 'block',
  fields: {
    id: blockID(),
    blockName: '',
    blockType: 'code',
    code: source,
    language,
  },
  format: '',
  version: 2,
})

/** The "this is demo content" banner shown at the top of every seeded post. */
export const demoDisclaimer = () =>
  banner(
    'info',
    [
      p(
        t('Demo content:', BOLD),
        t(' this post was created by the seed script to show off the template. To edit it, '),
        a('open the admin panel', '/admin'),
        t('.'),
      ),
    ],
    'Disclaimer',
  )
