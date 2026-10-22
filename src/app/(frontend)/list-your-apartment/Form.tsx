'use client'

import { useState, type FormEvent } from 'react'

const fields = [
  ['title', 'Listing title', 'text'],
  ['monthlyRent', 'Monthly rent', 'number'],
  ['deposit', 'Deposit', 'number'],
  ['availableFrom', 'Available from', 'date'],
  ['streetAddress', 'Street address', 'text'],
  ['city', 'City', 'text'],
  ['size', 'Size (m²)', 'number'],
  ['rooms', 'Rooms', 'number'],
  ['landlordName', 'Your name', 'text'],
  ['landlordEmail', 'Your email', 'email'],
  ['landlordPhone', 'Your phone number', 'tel'],
] as const

export function SubmissionForm() {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [confirmation, setConfirmation] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const data: Record<string, unknown> = Object.fromEntries(form)
    for (const field of ['monthlyRent', 'deposit', 'size', 'rooms'])
      data[field] = Number(form.get(field))
    data.furnished = form.has('furnished')
    data.petsAllowed = form.has('petsAllowed')
    setPending(true)
    setError('')
    try {
      const response = await fetch('/api/listing-submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Please try again.')
      setConfirmation(result.message)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Please try again.')
    } finally {
      setPending(false)
    }
  }
  if (confirmation)
    return (
      <div
        role="status"
        className="rounded-2xl border border-green-700/30 bg-green-50 p-8 text-green-950"
      >
        <h2 className="mb-3 text-2xl">You’re on the list.</h2>
        <p>{confirmation}</p>
      </div>
    )
  return (
    <form action="/api/listing-submissions" method="post" onSubmit={submit} className="space-y-8">
      <div className="grid gap-6 sm:grid-cols-2">
        {fields.map(([name, label, type]) => (
          <label key={name} className="flex flex-col gap-2 text-sm font-medium">
            {label}
            <input
              name={name}
              type={type}
              required
              min={name === 'size' || name === 'rooms' ? 1 : type === 'number' ? 0 : undefined}
              step={type === 'number' ? '0.01' : undefined}
              maxLength={
                name === 'title' || name === 'landlordName'
                  ? 150
                  : name === 'landlordPhone'
                    ? 50
                    : name === 'city'
                      ? 100
                      : 250
              }
              className="rounded-lg border bg-background px-4 py-3 font-normal"
            />
          </label>
        ))}
      </div>
      <div className="flex flex-wrap gap-8">
        <label className="flex items-center gap-3">
          <input type="checkbox" name="furnished" />
          Furnished
        </label>
        <label className="flex items-center gap-3">
          <input type="checkbox" name="petsAllowed" />
          Pets allowed
        </label>
      </div>
      <label className="flex flex-col gap-2 text-sm font-medium">
        Description
        <textarea
          name="description"
          required
          maxLength={10000}
          rows={7}
          className="rounded-lg border bg-background px-4 py-3 font-normal"
          placeholder="Tell us about the apartment, its layout and the neighborhood. Please leave contact details out of the description."
        />
      </label>
      <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
        <label>
          Leave this empty
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <p className="text-sm text-muted-foreground">
        Your contact details are only visible to our staff. Our team will review your submission and
        add photos before publishing.
      </p>
      {error && (
        <p role="alert" className="text-red-600">
          {error}
        </p>
      )}
      <button
        disabled={pending}
        type="submit"
        className="rounded-full bg-[#24392c] px-8 py-4 font-medium text-white disabled:opacity-60"
      >
        {pending ? 'Submitting…' : 'Submit your apartment'}
      </button>
    </form>
  )
}
