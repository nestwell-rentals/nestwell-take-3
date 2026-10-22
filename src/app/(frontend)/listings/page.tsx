import type { Metadata } from 'next'
import Link from 'next/link'
import { ListingGrid } from '@/components/Listings'
import { getApprovedListings } from '@/utilities/getListings'

export const metadata: Metadata = { title: 'Apartments for rent | Nestwell' }
export default async function ListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { page: requested } = await searchParams
  const page = Math.max(1, Math.min(10000, Number.parseInt(requested || '1', 10) || 1))
  const listings = await getApprovedListings(page)
  return (
    <main className="container pb-24 pt-12">
      <p className="text-sm uppercase tracking-widest text-muted-foreground">Find your place</p>
      <h1 className="mb-5 mt-3 text-5xl">Apartments for rent</h1>
      <p className="mb-10 text-muted-foreground">
        Explore available apartments reviewed by our team.
      </p>
      <ListingGrid listings={listings.docs} />
      <nav aria-label="Listing pages" className="mt-8 flex justify-between">
        {listings.hasPrevPage ? (
          <Link href={`/listings?page=${page - 1}`}>← Previous</Link>
        ) : (
          <span />
        )}
        {listings.hasNextPage && <Link href={`/listings?page=${page + 1}`}>Next →</Link>}
      </nav>
    </main>
  )
}
