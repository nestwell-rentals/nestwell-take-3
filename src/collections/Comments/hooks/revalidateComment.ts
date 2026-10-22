import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, PayloadRequest } from 'payload'

import { revalidatePath } from 'next/cache'

import type { Comment } from '../../../payload-types'

const revalidatePostOfComment = async (comment: Comment, req: PayloadRequest) => {
  const postID = typeof comment.post === 'object' ? comment.post?.id : comment.post
  if (!postID) return

  const post = await req.payload.findByID({
    collection: 'posts',
    id: postID,
    depth: 0,
    overrideAccess: true,
    req,
    select: { slug: true },
  })

  if (post?.slug) {
    req.payload.logger.info(`Revalidating comments on /posts/${post.slug}`)
    revalidatePath(`/posts/${post.slug}`)
  }
}

export const revalidateComment: CollectionAfterChangeHook<Comment> = async ({
  doc,
  previousDoc,
  req,
}) => {
  // Only approved comments are public, so only changes in or out of "approved" affect the site
  const wasPublic = previousDoc?.status === 'approved'
  const isPublic = doc.status === 'approved'

  if (!req.context.disableRevalidate && (wasPublic || isPublic)) {
    await revalidatePostOfComment(doc, req)
  }

  return doc
}

export const revalidateCommentDelete: CollectionAfterDeleteHook<Comment> = async ({ doc, req }) => {
  if (!req.context.disableRevalidate && doc?.status === 'approved') {
    await revalidatePostOfComment(doc, req)
  }

  return doc
}
