import clsx from 'clsx'
import React from 'react'

interface Props {
  className?: string
}

/**
 * A self-contained wordmark (no external image). It is drawn in white like the original
 * Payload logo; the header inverts it in light mode. Swap in your own brand here.
 */
export const Logo = ({ className }: Props) => {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-2 text-white text-lg font-semibold tracking-tight',
        className,
      )}
    >
      <svg aria-hidden="true" height="28" viewBox="0 0 28 28" width="28">
        <rect
          fill="none"
          height="24"
          rx="6"
          stroke="currentColor"
          strokeWidth="2.5"
          width="24"
          x="2"
          y="2"
        />
        <path
          d="M7 13l7-6 7 6v8h-5v-6h-4v6H7z"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.5"
        />
      </svg>
      <span>Nestwell</span>
    </span>
  )
}
