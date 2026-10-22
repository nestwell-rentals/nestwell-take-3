import React from 'react'

import type { Post } from '@/payload-types'

import { cn } from '@/utilities/ui'

/** Renders a post's Payload 4 tags (the `_h_tags` field created by `createTagField`). */
export const PostTags: React.FC<{ className?: string; tags: Post['_h_tags'] }> = ({
  className,
  tags,
}) => {
  const resolved = (tags || []).filter((tag) => typeof tag === 'object' && tag !== null)
  if (resolved.length === 0) return null

  return (
    <ul aria-label="Tags" className={cn('flex flex-wrap gap-2', className)}>
      {resolved.map((tag) => (
        <li
          key={tag.id}
          className="rounded-full border border-border bg-card px-3 py-1 text-sm text-muted-foreground"
        >
          #{tag.title}
        </li>
      ))}
    </ul>
  )
}
