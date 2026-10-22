import { s3Storage } from '@payloadcms/storage-s3'
import type { StorageAdapter } from 'payload'

/**
 * Uploads go to an S3-compatible bucket when S3_BUCKET is set (Railway Bucket, AWS S3,
 * Cloudflare R2, MinIO, ...). Otherwise they are written to local disk in public/media,
 * which is fine for local development but is wiped on every Railway redeploy.
 *
 * Files are still served through Payload at /api/media/file/<filename>, so private buckets
 * work and the collection's read access is enforced.
 */
export const storage: StorageAdapter[] = [
  s3Storage({
    enabled: Boolean(process.env.S3_BUCKET),
    bucket: process.env.S3_BUCKET || '',
    collections: {
      media: { prefix: 'media' },
    },
    config: {
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
      },
      endpoint: process.env.S3_ENDPOINT || undefined,
      region: process.env.S3_REGION || 'auto',
      // MinIO and some other self-hosted providers need path-style URLs
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
    },
  }),
]
