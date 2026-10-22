// OAuth discovery for /api/mcp (see src/plugins/mcp-oauth). Read env per request, not at build.
import { authorizationServerMetadata } from '@/plugins/mcp-oauth/next/wellKnown'

export const dynamic = 'force-dynamic'
export const GET = authorizationServerMetadata.GET
export const OPTIONS = authorizationServerMetadata.OPTIONS
