'use client'

import React, { useEffect } from 'react'

/**
 * Reloads the consent page from this origin. A navigation started by this document is
 * same-origin, so Payload accepts the login cookie that it ignores on the cross-site arrival.
 */
export const SameOriginBounce: React.FC<{ href: string }> = ({ href }) => {
  useEffect(() => {
    window.location.replace(href)
  }, [href])

  return (
    <main className="container py-24 text-center">
      <p>
        Continuing to sign in…{' '}
        <a className="underline" href={href}>
          Click here if nothing happens.
        </a>
      </p>
    </main>
  )
}
