import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { ListingGrid } from '@/components/Listings'
import { getApprovedListings } from '@/utilities/getListings'

export const metadata: Metadata = {
  title: 'Nestwell — Find your next home',
  description:
    'Find a space that feels like you. Discover apartments reviewed by the Nestwell team, or list your apartment with us.',
}

export default async function HomePage() {
  const { docs } = await getApprovedListings()
  return (
    <main>
      <section className="container pb-16 pt-8">
        <div className="relative overflow-hidden rounded-3xl bg-[#e8ede5] px-7 py-16 text-[#24392c] md:px-16 md:py-24">
          <p className="mb-6 text-sm font-semibold uppercase tracking-[0.22em]">
            Nestwell · Room for your next chapter
          </p>
          <h1 className="max-w-3xl text-5xl font-medium leading-[1.06] tracking-tight md:text-7xl">
            Find your
            <br />
            next home
          </h1>
          <p className="mt-7 max-w-lg text-lg leading-relaxed">
            A new neighborhood. A little more room. A place to settle in. Discover an apartment you
            can make your own.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              href="/listings"
              className="rounded-full bg-[#24392c] px-7 py-4 font-medium text-white"
            >
              Explore apartments <ArrowUpRight className="ml-2 inline" size={18} />
            </Link>
            <Link
              href="/list-your-apartment"
              className="rounded-full border border-[#24392c]/30 px-7 py-4 font-medium"
            >
              List your apartment
            </Link>
          </div>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-24 -right-12 hidden h-96 w-80 rounded-t-full border-[36px] border-[#24392c]/10 lg:block"
          />
        </div>
      </section>
      <section className="container pb-24" aria-labelledby="apartments-heading">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-sm uppercase tracking-widest text-muted-foreground">
              Make yourself at home
            </p>
            <h2 id="apartments-heading" className="text-3xl font-medium">
              Apartments to call your own
            </h2>
          </div>
          <Link href="/listings" className="underline underline-offset-4">
            View all listings
          </Link>
        </div>
        <ListingGrid listings={docs} />
      </section>
      <section className="border-t bg-muted/30 py-16">
        <div className="container flex flex-wrap items-center justify-between gap-8">
          <div>
            <h2 className="text-3xl">Have a place to share?</h2>
            <p className="mt-3 text-muted-foreground">
              Tell us about your apartment. Our team will review it before it goes live.
            </p>
          </div>
          <Link href="/list-your-apartment" className="rounded-full border px-7 py-4">
            List your apartment
          </Link>
        </div>
      </section>
    </main>
  )
}
