'use client'

import React, { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

type Status = 'idle' | 'submitting' | 'success' | 'error'

export const CommentForm: React.FC<{ postId: number }> = ({ postId }) => {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [content, setContent] = useState('')
  const [website, setWebsite] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('submitting')
    setError('')

    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ author: { email, name }, content, post: postId, website }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.errors?.[0]?.message || 'Failed to submit comment')
      }

      setStatus('success')
      setContent('')
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Failed to submit comment. Please try again.')
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5"
    >
      <h3 className="text-xl font-semibold">Leave a comment</h3>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="comment-name">Name</Label>
          <Input
            id="comment-name"
            autoComplete="name"
            maxLength={100}
            onChange={(e) => setName(e.target.value)}
            required
            value={name}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="comment-email">Email (not published)</Label>
          <Input
            id="comment-email"
            autoComplete="email"
            onChange={(e) => setEmail(e.target.value)}
            required
            type="email"
            value={email}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="comment-content">Comment</Label>
        <Textarea
          id="comment-content"
          maxLength={2000}
          onChange={(e) => setContent(e.target.value)}
          required
          rows={4}
          value={content}
        />
      </div>

      {/* Honeypot for bots: hidden from people and screen readers */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="comment-website">Website</label>
        <input
          id="comment-website"
          autoComplete="off"
          onChange={(e) => setWebsite(e.target.value)}
          tabIndex={-1}
          value={website}
        />
      </div>

      {status === 'error' && <p className="text-red-600 dark:text-red-400">{error}</p>}
      {status === 'success' && (
        <p className="text-green-700 dark:text-green-400" role="status">
          Comment submitted successfully! It will appear after approval.
        </p>
      )}

      <div>
        <Button disabled={status === 'submitting'} type="submit">
          {status === 'submitting' ? 'Submitting...' : 'Submit comment'}
        </Button>
      </div>
    </form>
  )
}
