/**
 * Processes media resource URL to ensure proper formatting
 * @param url The original URL from the resource
 * @param cacheTag Optional cache tag to append to the URL
 * @returns Properly formatted URL with cache tag if provided
 *
 * Local paths (e.g. `/api/media/file/image.webp`) are kept relative so
 * Next.js image optimization treats them as local rather than fetching
 * through `remotePatterns`, which blocks private IPs since Next.js 16.
 *
 * Storage adapters can return URLs that already have a query string (the S3 adapter
 * adds `?prefix=media`), so the cache tag is appended with `&` in that case. A second
 * `?` would corrupt the prefix and make Payload look up a file that does not exist.
 */
export const getMediaUrl = (url: string | null | undefined, cacheTag?: string | null): string => {
  if (!url) return ''
  if (!cacheTag) return url

  const separator = url.includes('?') ? '&' : '?'

  return `${url}${separator}${encodeURIComponent(cacheTag)}`
}
