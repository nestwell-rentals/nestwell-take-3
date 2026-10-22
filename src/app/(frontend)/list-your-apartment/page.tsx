import type { Metadata } from 'next'
import { SubmissionForm } from './Form'

export const metadata: Metadata = { title: 'List your apartment | Nestwell' }
export default async function ListYourApartment({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string }>
}) {
  const { submitted } = await searchParams
  return (
    <main className="container max-w-3xl pb-24 pt-12">
      <p className="text-sm uppercase tracking-widest text-muted-foreground">
        A home for someone’s next chapter
      </p>
      <h1 className="mb-5 mt-4 text-4xl md:text-5xl">List your apartment</h1>
      <p className="mb-10 text-lg text-muted-foreground">
        Have a place to rent? Share the details below. No account needed, no photos to upload. We’ll
        take it from here.
      </p>
      {submitted === '1' ? (
        <div
          role="status"
          className="rounded-2xl border border-green-700/30 bg-green-50 p-8 text-green-950"
        >
          <h2 className="mb-3 text-2xl">You’re on the list.</h2>
          <p>
            Thank you! Your apartment has been submitted. Our team will review it before it appears
            on Nestwell.
          </p>
        </div>
      ) : (
        <SubmissionForm />
      )}
    </main>
  )
}
