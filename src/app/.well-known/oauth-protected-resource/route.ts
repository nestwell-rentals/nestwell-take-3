// OAuth discovery for /api/mcp (see src/plugins/mcp-oauth). Read env per request, not at build.
import { protectedResourceMetadata } from '@/plugins/mcp-oauth/next/wellKnown'

export const dynamic = 'force-dynamic'
export const GET = protectedResourceMetadata.GET
export const OPTIONS = protectedResourceMetadata.OPTIONS
