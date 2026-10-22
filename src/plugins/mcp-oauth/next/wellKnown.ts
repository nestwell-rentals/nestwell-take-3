import { metadataPreflight, metadataResponse } from '../server/http'
import { getAuthorizationServerMetadata, getProtectedResourceMetadata } from '../server/urls'

/**
 * Route handlers for the discovery documents. Next.js only finds route handlers under src/app,
 * so thin files there re-export these. Both documents are served at the root well-known path
 * and at the path-suffixed one MCP clients probe for a server at /api/mcp.
 */

/** RFC 9728 protected resource metadata for /api/mcp */
export const protectedResourceMetadata = {
  GET: () => metadataResponse(getProtectedResourceMetadata()),
  OPTIONS: () => metadataPreflight(),
}

/** RFC 8414 authorization server metadata; the issuer is the site origin */
export const authorizationServerMetadata = {
  GET: () => metadataResponse(getAuthorizationServerMetadata()),
  OPTIONS: () => metadataPreflight(),
}
