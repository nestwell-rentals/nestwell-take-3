import type { RequiredDataFromCollectionSlug } from 'payload'

/**
 * What each post file provides. Authors, categories, tags, publish date and status are
 * assigned in index.ts so the relationships between posts are visible in one place.
 */
export type PostContent = Pick<
  RequiredDataFromCollectionSlug<'posts'>,
  'slug' | 'title' | 'heroImage' | 'content' | 'meta'
>
