import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import RichText from '@/components/RichText'
import { ApartmentPhoto, formatAmount, listingPhotos } from '@/components/Listings'

export const metadata: Metadata = { title: 'Apartment | Nestwell' }
export default async function ListingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'listings',
    overrideAccess: false,
    user: null,
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 1,
  })
  const listing = docs[0]
  if (!listing) notFound()
  const photos = listingPhotos(listing)
  const facts = [
    ['Monthly rent', `${formatAmount(listing.monthlyRent)} / month`],
    ['Deposit', formatAmount(listing.deposit)],
    ['Rooms', listing.rooms],
    ['Size', `${listing.size} m²`],
    [
      'Available from',
      new Date(listing.availableFrom).toLocaleDateString('en-GB', { timeZone: 'UTC' }),
    ],
    ['Furnished', listing.furnished ? 'Yes' : 'No'],
    ['Pets allowed', listing.petsAllowed ? 'Yes' : 'No'],
  ]
  return (
    <main className="container pb-24 pt-10">
      <Link className="text-sm underline underline-offset-4" href="/listings">
        ← All apartments
      </Link>
      <div className="my-8">
        <p className="mb-3 text-sm uppercase tracking-widest text-muted-foreground">
          {listing.city} · {listing.status === 'rented' ? 'Rented' : 'Available to rent'}
        </p>
        <h1 className="text-4xl md:text-5xl">{listing.title}</h1>
        <p className="mt-4 text-muted-foreground">
          {listing.streetAddress}, {listing.city}
        </p>
      </div>
      <section aria-label="Apartment photo gallery" className="grid gap-4 md:grid-cols-2">
        {photos.length ? (
          photos.map((photo) => (
            <div key={photo.id} className="aspect-[4/3] overflow-hidden rounded-2xl">
              <ApartmentPhoto photo={photo} title={listing.title} />
            </div>
          ))
        ) : (
          <div className="aspect-[2/1] overflow-hidden rounded-2xl md:col-span-2">
            <ApartmentPhoto title={listing.title} />
          </div>
        )}
      </section>
      {listing.status === 'rented' && (
        <p className="mt-6 rounded-xl bg-muted p-5">
          This apartment has been rented.{' '}
          <Link className="underline" href="/listings">
            Explore available apartments.
          </Link>
        </p>
      )}
      <section className="my-10 rounded-2xl border p-7" aria-label="Apartment facts">
        <dl className="grid grid-cols-2 gap-7 md:grid-cols-4">
          {facts.map(([label, value]) => (
            <div key={label}>
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="mt-2 text-lg font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section>
        <h2 className="mb-6 text-2xl">About this home</h2>
        <RichText data={listing.description} enableGutter={false} />
      </section>
    </main>
  )
}
