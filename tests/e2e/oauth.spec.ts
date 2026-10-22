import {
  type APIRequestContext,
  type Browser,
  expect,
  type Page,
  type PlaywrightWorkerArgs,
  test,
} from '@playwright/test'

import { adminEmail, adminPassword, baseURL } from './env'
import {
  CallbackServer,
  callMCP,
  callTool,
  createPKCE,
  mcpResource,
  parseChallenge,
  type TokenResponse,
  toolText,
} from './oauth-helpers'

/**
 * The OAuth sign-in for /api/mcp, as ChatGPT or any other MCP client would drive it:
 * discovery, client registration, login and consent in the browser, the code exchange, MCP calls
 * with the user's permissions, refresh, and revocation from the admin. Then the ways it must fail.
 *
 * Runs after app.spec.ts, which creates the admin and seeds content, but can also run alone.
 */
test.describe.configure({ mode: 'serial' })

const mariaEmail = 'maria@example.com'
const mariaPassword = 'LettingAgent123!'
const mariaName = 'Maria Jensen'

// The pretend MCP client: a tiny server that just receives the browser after consent
const callbackServer = new CallbackServer(3999)
const clientRedirectUri = callbackServer.redirectUri
const clientName = 'Playwright Agent'

let api: APIRequestContext
let adminApi: APIRequestContext
let mariaPage: Page
let adminPage: Page
let mariaId: number
let clientId: string
let tokens: TokenResponse

async function signInAdmin(playwright: PlaywrightWorkerArgs['playwright']) {
  const context = await playwright.request.newContext({ baseURL })
  const login = await context.post('/api/users/login', {
    data: { email: adminEmail, password: adminPassword },
  })
  if (!login.ok()) {
    // Running on a fresh database without app.spec.ts: onboard the admin first
    const first = await context.post('/api/users/first-register', {
      data: { email: adminEmail, name: 'Playwright Admin', password: adminPassword },
    })
    expect(first.ok(), 'admin onboarding').toBeTruthy()
  }
  return context
}

async function ensureMaria() {
  const existing = await adminApi.get('/api/users', {
    params: { depth: '0', 'where[email][equals]': mariaEmail },
  })
  const docs = (await existing.json()).docs as Array<{ id: number }>
  if (docs[0]) return docs[0].id

  const created = await adminApi.post('/api/users', {
    data: { email: mariaEmail, name: mariaName, password: mariaPassword, roles: ['editor'] },
  })
  expect(created.ok(), 'creating the editor account').toBeTruthy()
  return (await created.json()).doc.id as number
}

async function newPage(browser: Browser) {
  return (await browser.newContext()).newPage()
}

/** Signs Maria in through Payload's login form when the page is on it */
async function loginIfAsked(page: Page) {
  if (!/\/admin\/login/.test(page.url())) return
  await page.waitForLoadState('networkidle')
  await page.locator('input[name="email"]').fill(mariaEmail)
  await page.locator('input[name="password"]').fill(mariaPassword)
  await page.getByRole('button', { name: /^login$/i }).click()
}

/**
 * Starts an authorization request in Maria's browser and resolves with the callback URL the
 * client would receive. `decision` picks the consent button.
 */
async function authorize(
  page: Page,
  {
    challenge,
    decision = 'allow',
    overrides = {},
    state = `state-${Date.now()}`,
  }: {
    challenge: string
    decision?: 'allow' | 'deny'
    overrides?: Record<string, string>
    state?: string
  },
): Promise<URL> {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    redirect_uri: clientRedirectUri,
    resource: mcpResource,
    state,
    ...overrides,
  })

  const atCallback = (url: URL) => url.href.startsWith(clientRedirectUri)

  await page.goto(`/oauth/authorize?${params.toString()}`)
  await loginIfAsked(page)

  // Errors the server can report to the client skip the consent page entirely
  if (!atCallback(new URL(page.url()))) {
    await expect(page).toHaveURL(/\/oauth\/authorize\?/, { timeout: 30000 })
    await expect(page.getByTestId('consent-title')).toContainText(`${clientName} wants to act as`)
    await page.getByRole('button', { name: decision === 'allow' ? 'Allow' : 'Deny' }).click()
  }

  await page.waitForURL(atCallback, { timeout: 30000 })
  return new URL(page.url())
}

const exchange = (form: Record<string, string>) =>
  api.post('/api/oauth/token', {
    form: {
      client_id: clientId,
      grant_type: 'authorization_code',
      redirect_uri: clientRedirectUri,
      resource: mcpResource,
      ...form,
    },
  })

/** A full allow round-trip, returning the code and the verifier that goes with it */
async function freshCode() {
  const { challenge, verifier } = createPKCE()
  const callback = await authorize(mariaPage, { challenge })
  const code = callback.searchParams.get('code')
  expect(code).toBeTruthy()
  return { code: code!, verifier }
}

test.beforeAll(async ({ browser, playwright }) => {
  await callbackServer.start()
  api = await playwright.request.newContext({ baseURL })
  adminApi = await signInAdmin(playwright)
  mariaId = await ensureMaria()
  mariaPage = await newPage(browser)
  adminPage = await (await browser.newContext({ storageState: await adminApi.storageState() })).newPage()
})

test.afterAll(async () => {
  await api?.dispose()
  await adminApi?.dispose()
  await callbackServer.stop()
})

test('an anonymous MCP request is challenged and points at the discovery documents', async () => {
  const response = await callMCP(api, undefined, 'tools/list')
  expect(response.status()).toBe(401)

  const challenge = parseChallenge(response.headers()['www-authenticate'])
  expect(challenge.resource_metadata).toBe(`${baseURL}/.well-known/oauth-protected-resource/api/mcp`)
  // No credentials were sent, so no error code either (RFC 6750 §3.1)
  expect(challenge.error).toBeUndefined()

  for (const path of ['/.well-known/oauth-protected-resource/api/mcp', '/.well-known/oauth-protected-resource']) {
    const metadata = await (await api.get(path)).json()
    expect(metadata.resource).toBe(mcpResource)
    expect(metadata.authorization_servers).toEqual([baseURL])
  }

  for (const path of ['/.well-known/oauth-authorization-server', '/.well-known/oauth-authorization-server/api/mcp']) {
    const metadata = await (await api.get(path)).json()
    expect(metadata.issuer).toBe(baseURL)
    expect(metadata.authorization_endpoint).toBe(`${baseURL}/oauth/authorize`)
    expect(metadata.token_endpoint).toBe(`${baseURL}/api/oauth/token`)
    expect(metadata.registration_endpoint).toBe(`${baseURL}/api/oauth/register`)
    expect(metadata.code_challenge_methods_supported).toEqual(['S256'])
    expect(metadata.token_endpoint_auth_methods_supported).toContain('none')
    expect(metadata.client_id_metadata_document_supported).toBe(true)
    expect(metadata.authorization_response_iss_parameter_supported).toBe(true)
  }

  // Browser-based clients such as the MCP Inspector read these cross-origin
  const preflight = await api.fetch('/.well-known/oauth-authorization-server', { method: 'OPTIONS' })
  expect(preflight.status()).toBe(204)
  expect(preflight.headers()['access-control-allow-origin']).toBe('*')

  // A bad bearer token is a 401 with an error code, never a 500
  const bogus = await callMCP(api, 'Bearer not-a-real-token', 'tools/list')
  expect(bogus.status()).toBe(401)
  expect(parseChallenge(bogus.headers()['www-authenticate']).error).toBe('invalid_token')
})

test('an MCP client can register itself, within the rules', async () => {
  const registration = await api.post('/api/oauth/register', {
    data: {
      client_name: clientName,
      grant_types: ['authorization_code', 'refresh_token'],
      redirect_uris: [clientRedirectUri],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    },
  })
  expect(registration.status()).toBe(201)
  const body = await registration.json()
  expect(body.client_id).toMatch(/^mcp_/)
  expect(body.client_secret).toBeUndefined()
  expect(body.redirect_uris).toEqual([clientRedirectUri])
  expect(body.token_endpoint_auth_method).toBe('none')
  clientId = body.client_id

  const insecure = await api.post('/api/oauth/register', {
    data: { redirect_uris: ['http://agent.example.com/callback'] },
  })
  expect(insecure.status()).toBe(400)
  expect((await insecure.json()).error).toBe('invalid_redirect_uri')

  const unsupported = await api.post('/api/oauth/register', {
    data: { redirect_uris: ['https://agent.example.com/callback'], token_endpoint_auth_method: 'private_key_jwt' },
  })
  expect(unsupported.status()).toBe(400)
  expect((await unsupported.json()).error).toBe('invalid_client_metadata')

  // Confidential clients get a secret and must present it
  const confidential = await api.post('/api/oauth/register', {
    data: { client_name: 'Secret Agent', redirect_uris: ['https://agent.example.com/callback'] },
  })
  expect(confidential.status()).toBe(201)
  const confidentialBody = await confidential.json()
  expect(confidentialBody.token_endpoint_auth_method).toBe('client_secret_basic')
  expect(confidentialBody.client_secret).toMatch(/^[A-Za-z0-9_-]{40,}$/)
  expect(confidentialBody.client_secret_expires_at).toBe(0)

  const wrongSecret = await api.post('/api/oauth/token', {
    form: { code: 'whatever', code_verifier: 'x'.repeat(43), grant_type: 'authorization_code' },
    headers: {
      Authorization: `Basic ${Buffer.from(`${confidentialBody.client_id}:wrong`).toString('base64')}`,
    },
  })
  expect(wrongSecret.status()).toBe(401)
  expect((await wrongSecret.json()).error).toBe('invalid_client')
  expect(wrongSecret.headers()['www-authenticate']).toMatch(/^Basic /)
})

test('Maria signs in, allows the client, and the code is exchanged with PKCE', async () => {
  const { challenge, verifier } = createPKCE()
  const state = 'tutorial-state'
  const callback = await authorize(mariaPage, { challenge, state })

  expect(callback.origin + callback.pathname).toBe(clientRedirectUri)
  expect(callback.searchParams.get('state')).toBe(state)
  expect(callback.searchParams.get('iss')).toBe(baseURL)
  expect(callback.searchParams.get('error')).toBeNull()
  const code = callback.searchParams.get('code')
  expect(code).toBeTruthy()

  const response = await exchange({ code: code!, code_verifier: verifier })
  expect(response.status()).toBe(200)
  expect(response.headers()['cache-control']).toContain('no-store')
  tokens = await response.json()
  expect(tokens.token_type).toBe('Bearer')
  expect(tokens.expires_in).toBe(3600)
  expect(tokens.access_token).toMatch(/^[A-Za-z0-9_-]{40,}$/)
  expect(tokens.refresh_token).toMatch(/^[A-Za-z0-9_-]{40,}$/)

  // Codes are single-use; a replay fails and revokes what the first exchange produced
  const replay = await exchange({ code: code!, code_verifier: verifier })
  expect(replay.status()).toBe(400)
  expect((await replay.json()).error).toBe('invalid_grant')
  const revoked = await callMCP(api, `Bearer ${tokens.access_token}`, 'tools/list')
  expect(revoked.status()).toBe(401)

  // So do it once more for the rest of the suite
  const second = await freshCode()
  const again = await exchange({ code: second.code, code_verifier: second.verifier })
  expect(again.status()).toBe(200)
  tokens = await again.json()
})

test('the token lets an agent act as Maria, with exactly her permissions', async () => {
  const list = await callMCP(api, `Bearer ${tokens.access_token}`, 'tools/list')
  expect(list.ok()).toBeTruthy()
  const toolNames = ((await list.json()).result.tools as Array<{ name: string }>).map((tool) => tool.name)
  expect(toolNames).toEqual(expect.arrayContaining(['siteOverview', 'createDocuments', 'moderateComment']))

  const overview = await callTool(api, tokens.access_token, 'siteOverview')
  expect(overview.isError).toBeFalsy()
  expect(toolText(overview)).toContain('Published posts:')

  // Permitted: editors manage content, and the change is recorded in Maria's name
  const tagTitle = `Maria via OAuth ${Date.now()}`
  const created = await callTool(api, tokens.access_token, 'createDocuments', {
    slug: 'tags',
    documents: [{ data: { slug: `maria-via-oauth-${Date.now()}`, title: tagTitle } }],
  })
  expect(created.isError, toolText(created)).toBeFalsy()
  const tags = await adminApi.get('/api/tags', {
    params: { depth: '0', 'where[title][equals]': tagTitle },
  })
  const [tag] = (await tags.json()).docs as Array<{
    createdBy?: null | number | { relationTo: string; value: number }
  }>
  expect(tag, 'the tag exists').toBeTruthy()
  // Authorship is a polymorphic relationship, so it arrives as { relationTo, value }
  const author = typeof tag!.createdBy === 'object' ? tag!.createdBy?.value : tag!.createdBy
  expect(author).toBe(mariaId)

  // Forbidden: user management is not available to agents at all
  const forbidden = await callTool(api, tokens.access_token, 'createDocuments', {
    slug: 'users',
    documents: [{ data: { email: 'intruder@example.com', password: 'Intruder123!' } }],
  })
  expect(forbidden.isError).toBe(true)
  expect(toolText(forbidden)).toMatch(/not enabled/i)
  const intruder = await adminApi.get('/api/users', {
    params: { 'where[email][equals]': 'intruder@example.com' },
  })
  expect((await intruder.json()).totalDocs).toBe(0)

  // Nor is the OAuth bookkeeping, whichever way it is asked for
  for (const slug of ['oauth-clients', 'oauth-tokens', 'oauth-grants', 'oauth-authorization-codes']) {
    const peek = await callTool(api, tokens.access_token, 'findDocuments', { slug })
    expect(peek.isError, slug).toBe(true)
    const rest = await adminApi.get(`/api/${slug}`)
    expect(rest.ok(), `REST ${slug}`).toBeFalsy()
  }
  const graphql = await adminApi.post('/api/graphql', {
    data: { query: '{ OauthTokens { docs { tokenHash } } }' },
  })
  expect((await graphql.json()).errors?.length ?? 0).toBeGreaterThan(0)

  // An MCP access token is not a session: the REST API does not know who this is
  const me = await api.get('/api/users/me', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })
  expect((await me.json()).user).toBeNull()
})

test('refresh tokens rotate', async () => {
  const refreshed = await api.post('/api/oauth/token', {
    form: { client_id: clientId, grant_type: 'refresh_token', refresh_token: tokens.refresh_token },
  })
  expect(refreshed.status()).toBe(200)
  const next: TokenResponse = await refreshed.json()
  expect(next.access_token).not.toBe(tokens.access_token)
  expect(next.refresh_token).not.toBe(tokens.refresh_token)

  const works = await callMCP(api, `Bearer ${next.access_token}`, 'tools/list')
  expect(works.ok()).toBeTruthy()

  // The connection stays alive on the new pair; the old pair is tested for reuse at the very end
  tokens = next
})

test('connected apps are listed in the admin and can be revoked', async () => {
  // Admins see everyone's connections
  await adminPage.goto('/admin/connected-apps')
  await expect(adminPage.getByRole('heading', { name: 'Connected apps' })).toBeVisible()
  await expect(adminPage.getByText(clientName).first()).toBeVisible()
  await expect(adminPage.getByText(`acting as ${mariaName}`).first()).toBeVisible()
  await adminPage.goto('/admin')
  await expect(adminPage.locator('#nav-connected-apps')).toBeVisible()

  // Editors do not get the site-wide view, only their own account
  await mariaPage.goto('/admin/connected-apps')
  await expect(mariaPage.getByText(/only admins can see/i)).toBeVisible()
  await expect(mariaPage.locator('#nav-connected-apps')).toHaveCount(0)

  await mariaPage.goto('/admin/account')
  const connectedApps = mariaPage.locator('#connected-apps')
  await expect(connectedApps.getByText(clientName)).toBeVisible()
  await expect(connectedApps.getByText(/returns to 127\.0\.0\.1:3999/i)).toBeVisible()

  mariaPage.once('dialog', (dialog) => void dialog.accept())
  await connectedApps.getByRole('button', { name: 'Revoke' }).click()
  await expect(connectedApps.getByText(/no apps are connected to your account/i)).toBeVisible({
    timeout: 15000,
  })

  const afterRevoke = await callMCP(api, `Bearer ${tokens.access_token}`, 'tools/list')
  expect(afterRevoke.status()).toBe(401)
  expect(parseChallenge(afterRevoke.headers()['www-authenticate']).error).toBe('invalid_token')

  const refreshAfterRevoke = await api.post('/api/oauth/token', {
    form: { client_id: clientId, grant_type: 'refresh_token', refresh_token: tokens.refresh_token },
  })
  expect(refreshAfterRevoke.status()).toBe(400)
  expect((await refreshAfterRevoke.json()).error).toBe('invalid_grant')
})

test('a wrong PKCE verifier, a foreign resource or a wrong client are refused', async () => {
  const { code, verifier } = await freshCode()

  const wrongVerifier = await exchange({ code, code_verifier: `${verifier.slice(1)}x` })
  expect(wrongVerifier.status()).toBe(400)
  expect((await wrongVerifier.json()).error).toBe('invalid_grant')

  const otherResource = await exchange({ code, code_verifier: verifier, resource: 'https://other.example.com/mcp' })
  expect(otherResource.status()).toBe(400)
  expect((await otherResource.json()).error).toBe('invalid_target')

  const otherClient = await api.post('/api/oauth/register', {
    data: { client_name: 'Other Agent', redirect_uris: [clientRedirectUri], token_endpoint_auth_method: 'none' },
  })
  const stolen = await exchange({ client_id: (await otherClient.json()).client_id, code, code_verifier: verifier })
  expect(stolen.status()).toBe(400)
  expect((await stolen.json()).error).toBe('invalid_grant')

  const wrongRedirect = await exchange({ code, code_verifier: verifier, redirect_uri: 'http://127.0.0.1:3999/other' })
  expect(wrongRedirect.status()).toBe(400)
  expect((await wrongRedirect.json()).error).toBe('invalid_grant')

  // None of the failures burned the code; the rightful client can still use it exactly once
  const rightful = await exchange({ code, code_verifier: verifier })
  expect(rightful.status()).toBe(200)
  tokens = await rightful.json()
})

test('unregistered redirect URIs and unknown clients never cause a redirect', async () => {
  const { challenge } = createPKCE()
  const base = {
    response_type: 'code',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    resource: mcpResource,
    state: 'nope',
  }

  const attempts: Array<[string, Record<string, string>]> = [
    ['an unregistered path', { client_id: clientId, redirect_uri: 'http://127.0.0.1:3999/other' }],
    ['an attacker host', { client_id: clientId, redirect_uri: 'https://evil.example.com/callback' }],
    ['an unknown client', { client_id: 'mcp_does_not_exist', redirect_uri: clientRedirectUri }],
    ['a plain-http metadata document', { client_id: 'http://chatgpt.com/oauth/client.json', redirect_uri: clientRedirectUri }],
    ['a loopback metadata document', { client_id: 'https://localhost/client.json', redirect_uri: clientRedirectUri }],
    ['an unresolvable metadata document', { client_id: 'https://client.invalid/client.json', redirect_uri: clientRedirectUri }],
  ]

  for (const [label, overrides] of attempts) {
    const response = await api.get('/oauth/authorize', { maxRedirects: 0, params: { ...base, ...overrides } })
    expect(response.status(), label).toBe(200)
    expect(await response.text(), label).toContain('This sign-in request is not valid')
  }
})

test('other bad requests are reported to the client with state and issuer', async () => {
  const { challenge } = createPKCE()

  const foreignResource = await authorize(mariaPage, {
    challenge,
    overrides: { resource: 'https://other.example.com/mcp' },
    state: 'foreign',
  })
  expect(foreignResource.searchParams.get('error')).toBe('invalid_target')
  expect(foreignResource.searchParams.get('state')).toBe('foreign')
  expect(foreignResource.searchParams.get('iss')).toBe(baseURL)
  expect(foreignResource.searchParams.get('code')).toBeNull()

  const plainPKCE = await authorize(mariaPage, {
    challenge,
    overrides: { code_challenge_method: 'plain' },
    state: 'plain',
  })
  expect(plainPKCE.searchParams.get('error')).toBe('invalid_request')
  expect(plainPKCE.searchParams.get('state')).toBe('plain')

  const denied = await authorize(mariaPage, { challenge, decision: 'deny', state: 'denied' })
  expect(denied.searchParams.get('error')).toBe('access_denied')
  expect(denied.searchParams.get('state')).toBe('denied')
  expect(denied.searchParams.get('iss')).toBe(baseURL)
  expect(denied.searchParams.get('code')).toBeNull()
})

test('the consent form rejects forged and cross-site submissions', async () => {
  const crossSite = await api.post('/api/oauth/authorize', {
    form: { decision: 'allow', request: 'forged' },
    headers: { Origin: 'https://evil.example.com' },
    maxRedirects: 0,
  })
  expect(crossSite.status()).toBe(403)

  const forged = await api.post('/api/oauth/authorize', {
    form: { decision: 'allow', request: 'forged.signature' },
    maxRedirects: 0,
  })
  expect(forged.status()).toBe(303)
  expect(forged.headers()['location']).toBe('/oauth/authorize?reason=expired')
})

test('"Not you?" signs out and brings the right person back to the request', async () => {
  const { challenge } = createPKCE()
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    redirect_uri: clientRedirectUri,
    resource: mcpResource,
  })
  await mariaPage.goto(`/oauth/authorize?${params.toString()}`)
  await expect(mariaPage.getByTestId('consent-title')).toBeVisible()

  await mariaPage.getByRole('link', { name: 'Not you?' }).click()
  await expect(mariaPage).toHaveURL(/\/admin\/login\?redirect=/)

  await loginIfAsked(mariaPage)
  await expect(mariaPage).toHaveURL(/\/oauth\/authorize\?/, { timeout: 30000 })
  await expect(mariaPage.getByTestId('consent-title')).toContainText(mariaName)
})

test('reusing a spent refresh token revokes the whole connection', async () => {
  const refreshed = await api.post('/api/oauth/token', {
    form: { client_id: clientId, grant_type: 'refresh_token', refresh_token: tokens.refresh_token },
  })
  expect(refreshed.status()).toBe(200)
  const next: TokenResponse = await refreshed.json()

  const reused = await api.post('/api/oauth/token', {
    form: { client_id: clientId, grant_type: 'refresh_token', refresh_token: tokens.refresh_token },
  })
  expect(reused.status()).toBe(400)
  expect((await reused.json()).error).toBe('invalid_grant')

  // Reuse means the token leaked, so even the freshly issued pair is dead
  const dead = await callMCP(api, `Bearer ${next.access_token}`, 'tools/list')
  expect(dead.status()).toBe(401)

  // API keys still work as before, independent of OAuth
  const apiKey = `e2e-${Date.now()}-oauth-spec-key`
  const keyed = await adminApi.patch(`/api/users/${mariaId}`, { data: { apiKey } })
  expect(keyed.ok()).toBeTruthy()
  const viaKey = await callMCP(api, `users API-Key ${apiKey}`, 'tools/list')
  expect(viaKey.ok()).toBeTruthy()
})
