import Link from 'next/link'
import { Home, MapPin, BedDouble, Expand } from 'lucide-react'
import type { Listing, Media } from '@/payload-types'
import { getMediaUrl } from '@/utilities/getMediaUrl'

export const formatAmount = (value: number) =>
  new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(value)
export const listingPhotos = (listing: Listing): Media[] =>
  (listing.photos || []).filter(
    (photo): photo is Media => typeof photo === 'object' && photo !== null && Boolean(photo.url),
  )

export function ApartmentPhoto({
  photo,
  title,
  className = '',
}: {
  photo?: Media
  title: string
  className?: string
}) {
  return photo?.url ? (
    // Preserve S3 query strings and avoid optimizing private bucket URLs through Next's remote fetcher.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={getMediaUrl(photo.url, photo.updatedAt)}
      alt={photo.alt || title}
      className={`h-full w-full object-cover ${className}`}
      loading="lazy"
    />
  ) : (
    <div
      role="img"
      aria-label={`Photos coming soon for ${title}`}
      className={`flex h-full min-h-52 flex-col items-center justify-center gap-3 bg-stone-100 text-stone-500 dark:bg-stone-900 ${className}`}
    >
      <Home size={42} strokeWidth={1} />
      <span className="text-sm">A place to make your own</span>
    </div>
  )
}

export function ListingGrid({ listings }: { listings: Listing[] }) {
  if (!listings.length)
    return (
      <div className="rounded-2xl border border-dashed p-12 text-center">
        <h3 className="text-xl">Your next home is on its way.</h3>
        <p className="mt-3 text-muted-foreground">
          New apartments will appear here once our team has reviewed them.
        </p>
      </div>
    )
  return (
    <div className="grid gap-7 md:grid-cols-2 lg:grid-cols-3">
      {listings.map((listing) => (
        <Link
          key={listing.id}
          href={`/listings/${listing.slug}`}
          className="group overflow-hidden rounded-2xl border bg-card transition-shadow hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          <div className="aspect-[4/3] overflow-hidden">
            <ApartmentPhoto
              photo={listingPhotos(listing)[0]}
              title={listing.title}
              className="transition-transform duration-300 group-hover:scale-105"
            />
          </div>
          <div className="space-y-4 p-6">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin size={15} />
              {listing.city}
            </p>
            <h3 className="text-xl font-semibold">{listing.title}</h3>
            <p>
              <strong className="text-2xl">{formatAmount(listing.monthlyRent)}</strong>
              <span className="text-muted-foreground"> / month</span>
            </p>
            <div className="flex gap-5 border-t pt-4 text-sm">
              <span className="flex items-center gap-2">
                <BedDouble size={17} />
                {listing.rooms} rooms
              </span>
              <span className="flex items-center gap-2">
                <Expand size={17} />
                {listing.size} m²
              </span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}
