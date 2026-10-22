import { expect, test } from '@playwright/test'

import {
  checkClientIdURL,
  fetchClientMetadataDocument,
  isPublicAddress,
  metadataCacheTTL,
} from '../../src/plugins/mcp-oauth/server/cimd'
import { validateClientMetadata } from '../../src/plugins/mcp-oauth/server/clientMetadata'
import { redirectUriMatches, validateRedirectUri } from '../../src/plugins/mcp-oauth/server/redirectUris'

/**
 * Client ID Metadata Documents need an HTTPS document on a public host, which the e2e server
 * cannot provide. These tests exercise the same code with the network injected, including the
 * SSRF guards, against a document shaped like ChatGPT's https://chatgpt.com/oauth/client.json.
 */

const chatgptClientId = 'https://chatgpt.com/oauth/client.json'

const chatgptDocument = {
  client_id: chatgptClientId,
  client_name: 'ChatGPT',
  client_uri: 'https://chatgpt.com',
  grant_types: ['authorization_code', 'refresh_token'],
  logo_uri: 'https://chatgpt.com/favicon.ico',
  redirect_uris: ['https://chatgpt.com/connector_platform_oauth_redirect'],
  response_types: ['code'],
  token_endpoint_auth_method: 'private_key_jwt',
  token_endpoint_auth_methods_supported: ['none', 'private_key_jwt'],
}

const publicLookup = async () => ['104.18.32.47', '2606:4700::6812:202f']

const jsonResponse = (body: unknown, headers: Record<string, string> = {}) =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    headers: { 'content-type': 'application/json', ...headers },
    status: 200,
  })

const fetchReturning = (response: Response | (() => Response)) => {
  const calls: Array<{ init?: RequestInit; url: string }> = []
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ init, url: String(input) })
    return typeof response === 'function' ? response() : response
  }) as unknown as typeof fetch
  return { calls, fetchImpl }
}

test.describe('client ID metadata documents', () => {
  test('only https URLs with a path on a public host name are accepted as client ids', () => {
    expect(checkClientIdURL(chatgptClientId).ok).toBe(true)
    for (const bad of [
      'http://chatgpt.com/oauth/client.json',
      'https://chatgpt.com',
      'https://chatgpt.com/',
      'https://chatgpt.com/oauth/client.json#frag',
      'https://user:pw@chatgpt.com/oauth/client.json',
      'https://127.0.0.1/client.json',
      'https://[::1]/client.json',
      'https://localhost/client.json',
      'https://intranet/client.json',
      'https://printer.local/client.json',
      'not a url',
    ]) {
      expect(checkClientIdURL(bad).ok, bad).toBe(false)
    }
  })

  test('private, loopback and link-local addresses are never fetched', () => {
    for (const address of ['10.0.0.1', '127.0.0.1', '169.254.169.254', '172.16.5.5', '192.168.1.1', '0.0.0.0', '100.64.0.1', '::1', '::', 'fd00::1', 'fe80::1', '::ffff:10.0.0.1', '64:ff9b::192.168.0.1']) {
      expect(isPublicAddress(address), address).toBe(false)
    }
    for (const address of ['8.8.8.8', '104.18.32.47', '2606:4700::6812:202f', '2a00:1450:4001:80b::200e']) {
      expect(isPublicAddress(address), address).toBe(true)
    }
  })

  test('a ChatGPT-shaped document is accepted and cached per its max-age', async () => {
    const { calls, fetchImpl } = fetchReturning(jsonResponse(chatgptDocument, { 'cache-control': 'public, max-age=600' }))
    const now = 1_700_000_000_000
    const result = await fetchClientMetadataDocument(chatgptClientId, { fetch: fetchImpl, lookup: publicLookup, now: () => now })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.metadata.clientName).toBe('ChatGPT')
    expect(result.metadata.redirectUris).toEqual(['https://chatgpt.com/connector_platform_oauth_redirect'])
    // ChatGPT prefers private_key_jwt but can also use none, which is what this server supports
    expect(result.metadata.tokenEndpointAuthMethod).toBe('none')
    expect(result.expiresAt.getTime()).toBe(now + 600 * 1000)
    expect(calls).toHaveLength(1)
    expect(calls[0]!.url).toBe(chatgptClientId)
    expect((calls[0]!.init as { redirect?: string }).redirect).toBe('error')
  })

  test('documents are rejected when the host resolves to a private address', async () => {
    const { calls, fetchImpl } = fetchReturning(jsonResponse(chatgptDocument))
    const result = await fetchClientMetadataDocument(chatgptClientId, { fetch: fetchImpl, lookup: async () => ['104.18.32.47', '10.0.0.5'] })
    expect(result.ok).toBe(false)
    expect(calls).toHaveLength(0)
  })

  test('documents must match their URL and only allow https or loopback redirects', async () => {
    const mismatch = await fetchClientMetadataDocument(chatgptClientId, {
      fetch: fetchReturning(jsonResponse({ ...chatgptDocument, client_id: 'https://evil.example/client.json' })).fetchImpl,
      lookup: publicLookup,
    })
    expect(mismatch.ok).toBe(false)

    const badRedirect = await fetchClientMetadataDocument(chatgptClientId, {
      fetch: fetchReturning(jsonResponse({ ...chatgptDocument, redirect_uris: ['http://chatgpt.com/callback'] })).fetchImpl,
      lookup: publicLookup,
    })
    expect(badRedirect.ok).toBe(false)

    const noPublicClientFlow = await fetchClientMetadataDocument(chatgptClientId, {
      fetch: fetchReturning(jsonResponse({ ...chatgptDocument, token_endpoint_auth_methods_supported: ['private_key_jwt'] })).fetchImpl,
      lookup: publicLookup,
    })
    expect(noPublicClientFlow.ok).toBe(false)

    const notJSON = await fetchClientMetadataDocument(chatgptClientId, {
      fetch: fetchReturning(jsonResponse('<html>')).fetchImpl,
      lookup: publicLookup,
    })
    expect(notJSON.ok).toBe(false)

    const serverError = await fetchClientMetadataDocument(chatgptClientId, {
      fetch: fetchReturning(new Response('nope', { status: 500 })).fetchImpl,
      lookup: publicLookup,
    })
    expect(serverError.ok).toBe(false)
  })

  test('oversized documents are refused before they are parsed', async () => {
    const huge = { ...chatgptDocument, client_name: 'x'.repeat(70 * 1024) }
    const result = await fetchClientMetadataDocument(chatgptClientId, {
      fetch: fetchReturning(jsonResponse(huge)).fetchImpl,
      lookup: publicLookup,
    })
    expect(result.ok).toBe(false)
  })

  test('cache lifetimes are clamped to sane bounds', () => {
    expect(metadataCacheTTL(null)).toBe(60 * 60 * 1000)
    expect(metadataCacheTTL('max-age=10')).toBe(5 * 60 * 1000)
    expect(metadataCacheTTL('max-age=99999999')).toBe(24 * 60 * 60 * 1000)
    expect(metadataCacheTTL('public, max-age=7200')).toBe(2 * 60 * 60 * 1000)
  })
})

test.describe('client metadata and redirect URIs', () => {
  test('dynamic registration defaults follow RFC 7591, metadata documents default to public clients', () => {
    const dynamic = validateClientMetadata({ redirect_uris: ['https://app.example.com/cb'] }, 'dynamic')
    expect(dynamic.ok).toBe(true)
    if (dynamic.ok) {
      expect(dynamic.metadata.tokenEndpointAuthMethod).toBe('client_secret_basic')
      expect(dynamic.metadata.grantTypes).toEqual(['authorization_code'])
      expect(dynamic.metadata.clientName).toBe('app.example.com')
    }

    const document = validateClientMetadata({ redirect_uris: ['https://app.example.com/cb'] }, 'metadata_document')
    expect(document.ok && document.metadata.tokenEndpointAuthMethod).toBe('none')

    const unsupported = validateClientMetadata(
      { redirect_uris: ['https://app.example.com/cb'], token_endpoint_auth_method: 'private_key_jwt' },
      'dynamic',
    )
    expect(unsupported.ok).toBe(false)
    expect(!unsupported.ok && unsupported.error).toBe('invalid_client_metadata')

    const implicit = validateClientMetadata(
      { redirect_uris: ['https://app.example.com/cb'], response_types: ['token'] },
      'dynamic',
    )
    expect(implicit.ok).toBe(false)
  })

  test('redirect URIs must be https or loopback http, without fragments', () => {
    expect(validateRedirectUri('https://chatgpt.com/connector_platform_oauth_redirect')).toBeNull()
    expect(validateRedirectUri('http://localhost:6274/oauth/callback')).toBeNull()
    expect(validateRedirectUri('http://127.0.0.1:3999/callback')).toBeNull()
    expect(validateRedirectUri('http://[::1]:3999/callback')).toBeNull()
    expect(validateRedirectUri('http://example.com/callback')).not.toBeNull()
    expect(validateRedirectUri('https://example.com/callback#frag')).not.toBeNull()
    expect(validateRedirectUri('cursor://callback')).not.toBeNull()
    expect(validateRedirectUri('javascript:alert(1)')).not.toBeNull()
    expect(validateRedirectUri('')).not.toBeNull()
  })

  test('redirect URIs match exactly, except for the port of loopback IP literals', () => {
    const registered = ['https://chatgpt.com/connector_platform_oauth_redirect', 'http://127.0.0.1:3999/callback', 'http://localhost:4000/callback']
    expect(redirectUriMatches(registered, 'https://chatgpt.com/connector_platform_oauth_redirect')).toBe(true)
    expect(redirectUriMatches(registered, 'https://chatgpt.com/connector_platform_oauth_redirect/')).toBe(false)
    expect(redirectUriMatches(registered, 'https://chatgpt.com/other')).toBe(false)
    expect(redirectUriMatches(registered, 'http://127.0.0.1:51234/callback')).toBe(true)
    expect(redirectUriMatches(registered, 'http://127.0.0.1:51234/other')).toBe(false)
    expect(redirectUriMatches(registered, 'http://localhost:4000/callback')).toBe(true)
    expect(redirectUriMatches(registered, 'http://localhost:4001/callback')).toBe(false)
  })
})
