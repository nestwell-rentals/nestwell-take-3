import config from '@payload-config'
import { getPayload } from 'payload'

/** Public reads deliberately omit the authenticated visitor and never bypass access. */
export async function getApprovedListings(page = 1) {
  const payload = await getPayload({ config })
  return payload.find({
    collection: 'listings',
    overrideAccess: false,
    user: null,
    where: { status: { equals: 'approved' } },
    depth: 1,
    sort: '-createdAt',
    limit: 12,
    page,
  })
}
