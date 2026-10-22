import configPromise from '@payload-config'
import { getPayload } from 'payload'
import React from 'react'

import { formatDateTime } from '@/utilities/formatDateTime'
import { cn } from '@/utilities/ui'

import { CommentForm } from './CommentForm'

type Props = {
  className?: string
  postId: number
}

export const Comments: React.FC<Props> = async ({ className, postId }) => {
  const payload = await getPayload({ config: configPromise })

  // Runs as an anonymous visitor (overrideAccess: false), so the collection's access
  // control only returns approved comments and never exposes author emails.
  const { docs: comments } = await payload.find({
    collection: 'comments',
    depth: 0,
    limit: 100,
    overrideAccess: false,
    pagination: false,
    select: { author: true, content: true, createdAt: true, publishedAt: true },
    sort: 'publishedAt',
    where: {
      post: { equals: postId },
      status: { equals: 'approved' },
    },
  })

  return (
    <section aria-labelledby="comments-heading" className={cn('flex flex-col gap-8', className)}>
      <h2 id="comments-heading" className="text-2xl font-semibold">
        Comments {comments.length > 0 && <span className="text-muted-foreground">({comments.length})</span>}
      </h2>

      {comments.length > 0 ? (
        <ul className="flex flex-col gap-4">
          {comments.map((comment) => (
            <li key={comment.id} className="rounded-lg border border-border bg-card p-5">
              <div className="mb-2 flex items-baseline justify-between gap-4">
                <span className="font-medium">{comment.author?.name}</span>
                <time
                  className="text-sm text-muted-foreground"
                  dateTime={comment.publishedAt || comment.createdAt}
                >
                  {formatDateTime(comment.publishedAt || comment.createdAt)}
                </time>
              </div>
              <p className="whitespace-pre-line leading-relaxed">{comment.content}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">No comments yet. Be the first to share your thoughts!</p>
      )}

      <CommentForm postId={postId} />
    </section>
  )
}
