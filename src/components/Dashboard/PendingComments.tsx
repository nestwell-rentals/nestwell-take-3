import type { WidgetServerProps } from 'payload'

import { PayloadLink } from '@payloadcms/ui'
import React from 'react'

import './PendingComments.css'

/**
 * A custom widget for the Payload 4 modular dashboard. Editors can add, move and resize it
 * from the dashboard's "Edit" mode, next to the built-in widgets.
 */
export default async function PendingComments({ req }: WidgetServerProps) {
  const { totalDocs } = await req.payload.count({
    collection: 'comments',
    overrideAccess: false,
    req,
    where: { status: { equals: 'pending' } },
  })

  const href = `${req.payload.config.routes.admin}/collections/comments?where[status][equals]=pending`

  return (
    <div className="pending-comments-widget">
      <span className="pending-comments-widget__label">Comments waiting for review</span>
      <span className="pending-comments-widget__count">{totalDocs}</span>
      <PayloadLink className="pending-comments-widget__link" href={href}>
        {totalDocs > 0 ? 'Review comments' : 'View all comments'}
      </PayloadLink>
    </div>
  )
}
