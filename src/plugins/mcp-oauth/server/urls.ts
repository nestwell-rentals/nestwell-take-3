import { getServerSideURL } from '@/utilities/getURL'

/**
 * The site itself is the OAuth authorization server, and `/api/mcp` is the protected resource.
 * Both identifiers derive from NEXT_PUBLIC_SERVER_URL, so one env var configures everything.
 */
export const getIssuer = (): string => getServerSideURL().replace(/\/+$/, '')

export const getMCPResourceURL = (): string => `${getIssuer()}/api/mcp`

export const oauthPaths = {
  // The consent page lives in the website's Next.js app, so it gets the site's look
  authorize: '/oauth/authorize',
  // The rest are Payload endpoints, served under the REST API prefix
  decision: '/api/oauth/authorize',
  switchAccount: '/api/oauth/switch-account',
  token: '/api/oauth/token',
  register: '/api/oauth/register',
  revoke: '/api/oauth/revoke',
  grants: '/api/oauth/grants',
  protectedResourceMetadata: '/.well-known/oauth-protected-resource/api/mcp',
  authorizationServerMetadata: '/.well-known/oauth-authorization-server',
} as const

export const getProtectedResourceMetadataURL = (): string =>
  `${getIssuer()}${oauthPaths.protectedResourceMetadata}`

/**
 * Canonical form used to compare RFC 8707 `resource` values: lowercase scheme and host,
 * no default port, no trailing slash, no fragment. Returns null for anything that is not an
 * absolute http(s) URL.
 */
export const normalizeResource = (value: string): string | null => {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  if (url.hash) return null
  // URL already lowercases scheme and host and drops default ports
  return url.toString().replace(/\/+$/, '')
}

export const isThisMCPResource = (value: string): boolean =>
  normalizeResource(value) === normalizeResource(getMCPResourceURL())

const DOCS_URL = 'https://github.com/rpuls/payload-4-boilerplate#connect-an-ai-agent-mcp'

/** The RFC 9728 document served at /.well-known/oauth-protected-resource[/api/mcp] */
export const getProtectedResourceMetadata = () => ({
  resource: getMCPResourceURL(),
  authorization_servers: [getIssuer()],
  bearer_methods_supported: ['header'],
  resource_name: 'Payload CMS MCP server',
  resource_documentation: DOCS_URL,
})

/** The RFC 8414 document served at /.well-known/oauth-authorization-server[/api/mcp] */
export const getAuthorizationServerMetadata = () => {
  const issuer = getIssuer()

  return {
    issuer,
    authorization_endpoint: `${issuer}${oauthPaths.authorize}`,
    token_endpoint: `${issuer}${oauthPaths.token}`,
    registration_endpoint: `${issuer}${oauthPaths.register}`,
    revocation_endpoint: `${issuer}${oauthPaths.revoke}`,
    response_types_supported: ['code'],
    response_modes_supported: ['query'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    // Public clients prove themselves with PKCE alone; dynamically registered clients may hold a secret
    token_endpoint_auth_methods_supported: ['none', 'client_secret_basic', 'client_secret_post'],
    revocation_endpoint_auth_methods_supported: ['none', 'client_secret_basic', 'client_secret_post'],
    code_challenge_methods_supported: ['S256'],
    // Clients such as ChatGPT identify themselves with an HTTPS URL that hosts their metadata
    client_id_metadata_document_supported: true,
    // Every authorization response carries `iss` (RFC 9207)
    authorization_response_iss_parameter_supported: true,
    service_documentation: DOCS_URL,
  }
}

/**
 * The `WWW-Authenticate` challenge for /api/mcp (RFC 6750 §3, RFC 9728 §5.1). It points clients
 * at the protected resource metadata, from which they discover this authorization server.
 */
export const buildBearerChallenge = (args?: {
  error?: string
  errorDescription?: string
}): string => {
  const parts = [`resource_metadata="${getProtectedResourceMetadataURL()}"`]
  if (args?.error) parts.push(`error="${args.error}"`)
  if (args?.errorDescription) {
    const safe = args.errorDescription.replace(/[^\x20-\x21\x23-\x5b\x5d-\x7e]/g, ' ')
    parts.push(`error_description="${safe}"`)
  }
  return `Bearer ${parts.join(', ')}`
}
